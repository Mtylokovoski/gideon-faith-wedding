import type { CategoryId } from '../types';
import { processImage } from '../lib/image';
import { ApiError, readJson } from './photoService';
import { STORAGE_BUCKET } from '../lib/constants';
import { SUPABASE_ANON_KEY, supabase } from './supabase';

export interface UploadMeta {
  slug: string;
  caption: string;
  category: CategoryId;
  guestName: string;
}

export interface UploadHooks {
  getCaptchaToken?: () => Promise<string | undefined>;
  onStage?: (stage: 'processing' | 'uploading') => void;
  onProgress?: (percent: number) => void;
}

interface InitResponse {
  photoId: string;
  status: 'pending' | 'approved';
  full: { path: string; token: string; signedUrl: string };
  thumb: { path: string; token: string; signedUrl: string };
}

export class UploadError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** PUT with real progress events (fetch cannot report upload progress). */
function putWithProgress(
  url: string,
  blob: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.timeout = 180_000;
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    xhr.setRequestHeader('Cache-Control', 'max-age=31536000');
    if (SUPABASE_ANON_KEY) {
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
      xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(blob);
  });
}

/** Upload one file to its signed URL; falls back to the official SDK method if the direct PUT fails. */
async function putFile(
  target: { path: string; token: string; signedUrl: string },
  blob: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  try {
    await putWithProgress(target.signedUrl, blob, onProgress);
  } catch {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .uploadToSignedUrl(target.path, target.token, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    onProgress(1);
  }
}

async function attempt(
  blob: Blob,
  meta: UploadMeta,
  hooks: UploadHooks,
): Promise<{ status: 'pending' | 'approved' }> {
  hooks.onStage?.('processing');
  hooks.onProgress?.(0);
  let processed;
  try {
    processed = await processImage(blob);
  } catch (e) {
    throw new UploadError(e instanceof Error ? e.message : 'This photo could not be read.', false);
  }

  const captchaToken = hooks.getCaptchaToken ? await hooks.getCaptchaToken() : undefined;

  let init: InitResponse;
  try {
    const res = await fetch('/api/upload-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: meta.slug,
        contentType: 'image/jpeg',
        size: processed.full.size,
        thumbSize: processed.thumb.size,
        width: processed.width,
        height: processed.height,
        caption: meta.caption,
        category: meta.category,
        guestName: meta.guestName,
        captchaToken,
      }),
    });
    init = await readJson<InitResponse>(res);
  } catch (e) {
    if (e instanceof ApiError) {
      const retryable = e.status >= 500 || e.status === 429;
      throw new UploadError(e.message, retryable);
    }
    throw new UploadError('No connection. Please check your internet and try again.', true);
  }

  hooks.onStage?.('uploading');
  try {
    // Thumbnail first (tiny), then the full picture: progress is 10% / 90% of the bar.
    await putFile(init.thumb, processed.thumb, (f) => hooks.onProgress?.(Math.round(f * 10)));
    await putFile(init.full, processed.full, (f) => hooks.onProgress?.(10 + Math.round(f * 85)));
  } catch {
    throw new UploadError('The upload was interrupted. Please check your connection and try again.', true);
  }

  try {
    const res = await fetch('/api/upload-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: init.photoId }),
    });
    const done = await readJson<{ ok: true; status: 'pending' | 'approved' }>(res);
    hooks.onProgress?.(100);
    return { status: done.status };
  } catch (e) {
    if (e instanceof ApiError) {
      throw new UploadError(e.message, e.status >= 500 || e.status === 409);
    }
    throw new UploadError('No connection while finishing. Please try again.', true);
  }
}

/** Compress, upload and confirm one photo, retrying temporary failures automatically. */
export async function uploadPhoto(
  blob: Blob,
  meta: UploadMeta,
  hooks: UploadHooks = {},
): Promise<{ status: 'pending' | 'approved' }> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      return await attempt(blob, meta, hooks);
    } catch (e) {
      lastError = e;
      if (!(e instanceof UploadError) || !e.retryable || i === maxAttempts - 1) break;
      await sleep(1200 * (i + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new UploadError('Upload failed.', true);
}
