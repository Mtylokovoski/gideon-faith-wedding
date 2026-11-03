// Pure file helpers (testable without a browser).
import { MAX_ORIGINAL_BYTES } from './constants';

export type ImageKind = 'jpeg' | 'png' | 'webp';

export interface FileLike {
  type: string;
  name: string;
  size: number;
}

export function detectImageKind(file: Pick<FileLike, 'type' | 'name'>): ImageKind | null {
  const t = file.type.toLowerCase();
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpeg';
  if (t === 'image/png') return 'png';
  if (t === 'image/webp') return 'webp';
  // Some Android browsers report an empty type — fall back to the file extension.
  if (!t) {
    const n = file.name.toLowerCase();
    if (/\.jpe?g$/.test(n)) return 'jpeg';
    if (/\.png$/.test(n)) return 'png';
    if (/\.webp$/.test(n)) return 'webp';
  }
  return null;
}

/** Returns a friendly message if the file can't be used, otherwise null. */
export function validateImageFile(file: FileLike): string | null {
  const kind = detectImageKind(file);
  if (!kind) {
    if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
      return 'This photo format (HEIC) is not supported. Please choose a JPEG, PNG or WebP picture.';
    }
    return 'Only JPEG, PNG and WebP pictures can be shared.';
  }
  if (file.size <= 0) return 'This file is empty.';
  if (file.size > MAX_ORIGINAL_BYTES) {
    return `This photo is too large (over ${Math.round(MAX_ORIGINAL_BYTES / 1024 / 1024)} MB).`;
  }
  return null;
}
