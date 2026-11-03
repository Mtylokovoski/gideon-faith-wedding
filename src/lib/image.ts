// Browser-side image processing: decode (respecting phone rotation), resize, re-encode as JPEG.
// Re-encoding also strips EXIF metadata such as GPS location — a privacy benefit for guests.

export const FULL_MAX_DIMENSION = 2560;
export const FULL_QUALITY = 0.88;
export const THUMB_MAX_DIMENSION = 640;
export const THUMB_QUALITY = 0.78;
const MAX_PIXELS = 120_000_000; // refuse absurdly large images (memory protection)

export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('This file could not be read as a picture.'));
    img.src = url;
  });
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

function render(d: Decoded, maxDim: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxDim / Math.max(d.width, d.height));
  const width = Math.max(1, Math.round(d.width * scale));
  const height = Math.max(1, Math.round(d.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Your browser could not process this photo.'));
  ctx.fillStyle = '#ffffff'; // flatten transparency (PNG/WebP) onto white
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(d.source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Free the canvas memory right away (important on phones).
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve({ blob, width, height });
        else reject(new Error('Your browser could not process this photo.'));
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function processImage(input: Blob): Promise<ProcessedImage> {
  const d = await decode(input);
  try {
    if (d.width * d.height > MAX_PIXELS) throw new Error('This picture is too large to process.');
    const full = await render(d, FULL_MAX_DIMENSION, FULL_QUALITY);
    const thumb = await render(d, THUMB_MAX_DIMENSION, THUMB_QUALITY);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    d.close();
  }
}
