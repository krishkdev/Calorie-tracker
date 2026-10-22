import { useEffect, useRef, useState } from 'react';
import {
  describeCameraError,
  hasCamera,
  startScanner,
  type ScanControls,
} from '../barcode/detector';

interface Props {
  onDetected: (code: string) => void;
}

/**
 * Mount it to start the camera, unmount it to stop. The parent remounts it for
 * each new scan, so all state here is per-attempt.
 */
export default function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const noCamera = !hasCamera();
  const [cameraError, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(!noCamera);
  const error = noCamera
    ? 'This browser has no camera access. Type the barcode below instead.'
    : cameraError;
  const latest = useRef(onDetected);
  useEffect(() => {
    latest.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || noCamera) return;
    let controls: ScanControls | undefined;
    let cancelled = false;
    startScanner(
      video,
      (code) => {
        if (cancelled) return;
        if ('vibrate' in navigator) navigator.vibrate?.(60);
        latest.current(code);
      },
      (e) => {
        if (!cancelled) setError(describeCameraError(e));
      },
    )
      .then((c) => {
        controls = c;
        if (cancelled) c.stop();
      })
      .catch((e: Error) => {
        if (!cancelled) setError(describeCameraError(e));
      })
      .finally(() => {
        if (!cancelled) setStarting(false);
      });
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [noCamera]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '3 / 4' }}>
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
      {!error && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="h-28 w-64 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      )}
      {starting && !error && (
        <p className="absolute inset-x-0 bottom-3 text-center text-sm text-white/90">
          Starting camera…
        </p>
      )}
      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-900/90 p-4 text-center text-sm text-white"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
