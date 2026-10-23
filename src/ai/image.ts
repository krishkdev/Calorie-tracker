export interface DownscaledImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

interface Options {
  maxEdge?: number;
  quality?: number;
}

/**
 * Shrink a photo client-side before sending it to the model: a 12 MP phone
 * photo becomes a ~100-200 KB JPEG, which is cheaper, faster, and plenty for
 * food recognition. Honors EXIF orientation where the browser supports it.
 */
export async function downscaleImage(file: Blob, opts: Options = {}): Promise<DownscaledImage> {
  const maxEdge = opts.maxEdge ?? 1024;
  const quality = opts.quality ?? 0.8;
  const source = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.drawImage(source.image, 0, 0, width, height);
  } finally {
    source.release();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) throw new Error('Could not encode the image.');
  const dataUrl = await blobToDataUrl(blob);
  return { blob, dataUrl, width, height };
}

interface LoadedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadImage(file: Blob): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // Fall through to the <img> path (e.g. unsupported option or format).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(
          new Error(
            'This image format could not be decoded. If it is a HEIC photo, choose JPEG in your camera settings or share a screenshot.',
          ),
        );
      el.src = url;
    });
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
