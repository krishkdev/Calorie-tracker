/**
 * Camera barcode scanning with two backends:
 *  - the native BarcodeDetector API (Chrome, Edge, Android WebView)
 *  - @zxing/browser as a lazy-loaded fallback (Safari, Firefox)
 */

export interface ScanControls {
  stop(): void;
}

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

export function hasCamera(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

async function nativeDetector(): Promise<BarcodeDetectorCtor | null> {
  const ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!ctor) return null;
  try {
    const supported = await ctor.getSupportedFormats();
    return supported.includes('ean_13') ? ctor : null;
  } catch {
    return null;
  }
}

/**
 * Start scanning into the given <video>. Calls onResult once with the first
 * decoded value, then stops the camera. Caller must also call stop() on unmount.
 */
export async function startScanner(
  video: HTMLVideoElement,
  onResult: (code: string) => void,
  onError: (err: Error) => void,
): Promise<ScanControls> {
  const Native = await nativeDetector();
  if (Native) return startNative(Native, video, onResult, onError);
  return startZxing(video, onResult, onError);
}

async function startNative(
  Native: BarcodeDetectorCtor,
  video: HTMLVideoElement,
  onResult: (code: string) => void,
  onError: (err: Error) => void,
): Promise<ScanControls> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  let detector: BarcodeDetectorLike;
  try {
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();
    detector = new Native({ formats: FORMATS });
  } catch (e) {
    // Never leave the camera running if setup fails after permission was granted.
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    throw e;
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2) {
        const codes = await detector.detect(video);
        const hit = codes.find((c) => c.rawValue);
        if (hit) {
          stop();
          onResult(hit.rawValue);
          return;
        }
      }
    } catch (e) {
      stop();
      onError(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    timer = setTimeout(() => void tick(), 180);
  };
  void tick();
  return { stop };
}

async function startZxing(
  video: HTMLVideoElement,
  onResult: (code: string) => void,
  onError: (err: Error) => void,
): Promise<ScanControls> {
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 });
  let done = false;
  try {
    const controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      video,
      (result, _err, ctl) => {
        if (done) return;
        if (result) {
          done = true;
          ctl.stop();
          onResult(result.getText());
        }
      },
    );
    return {
      stop: () => {
        done = true;
        controls.stop();
      },
    };
  } catch (e) {
    onError(e instanceof Error ? e : new Error(String(e)));
    return { stop: () => undefined };
  }
}

export function describeCameraError(e: Error): string {
  if (e.name === 'NotAllowedError')
    return 'Camera permission was denied. Allow camera access for this site, or type the barcode instead.';
  if (e.name === 'NotFoundError')
    return 'No camera was found on this device. Type the barcode instead.';
  if (e.name === 'NotReadableError') return 'The camera is in use by another app.';
  return e.message || 'Could not start the camera.';
}
