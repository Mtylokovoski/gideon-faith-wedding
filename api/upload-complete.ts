import { noStore, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { BUCKET, ConfigError, getAdminClient } from './_lib/supabaseAdmin.js';
import { MAX_FULL_BYTES, MAX_THUMB_BYTES, isJpeg } from './_lib/validate.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Db = ReturnType<typeof getAdminClient>;

async function objectSize(db: Db, path: string): Promise<number | null> {
  const slash = path.lastIndexOf('/');
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await db.storage.from(BUCKET).list(folder, { limit: 5, search: name });
  if (error) throw error;
  const file = data?.find((o) => o.name === name);
  const size = (file?.metadata as { size?: number } | null | undefined)?.size;
  return typeof size === 'number' ? size : null;
}

async function looksLikeJpeg(db: Db, path: string): Promise<boolean> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) throw error ?? new Error('No signed URL');
  const r = await fetch(data.signedUrl, { headers: { Range: 'bytes=0-15' } });
  if (!r.ok) return false;
  const buf = new Uint8Array(await r.arrayBuffer());
  return isJpeg(buf.subarray(0, 16));
}

async function discard(db: Db, photoId: string, paths: string[]): Promise<void> {
  await db.storage.from(BUCKET).remove(paths);
  await db.from('photos').delete().eq('id', photoId);
}

/**
 * Step 2 of an upload.
 * Confirms both files really arrived, are within size limits and are genuine JPEG data, then
 * marks the photo "finalized". Only then can it appear in a gallery. Invalid uploads are deleted.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed.');
  }

  try {
    const body = req.body as { photoId?: unknown } | null | undefined;
    const photoId = typeof body?.photoId === 'string' ? body.photoId.toLowerCase() : '';
    if (!UUID_RE.test(photoId)) return sendError(res, 400, 'Invalid request.');

    const db = getAdminClient();
    const { data: photo, error } = await db
      .from('photos')
      .select('id, storage_path, thumb_path, approval_status, finalized')
      .eq('id', photoId)
      .maybeSingle();
    if (error) throw error;
    if (!photo) return sendError(res, 404, 'Upload not found.');
    if (photo.finalized) {
      return res.status(200).json({ ok: true, status: photo.approval_status });
    }

    const paths = [photo.storage_path as string, photo.thumb_path as string];
    const [fullSize, thumbSize] = await Promise.all([objectSize(db, paths[0]!), objectSize(db, paths[1]!)]);

    if (fullSize === null || thumbSize === null) {
      // The browser has not finished uploading (or it failed). Keep the row so a retry can still work.
      return sendError(res, 409, 'The upload is not complete yet.', { code: 'incomplete' });
    }
    if (fullSize > MAX_FULL_BYTES || thumbSize > MAX_THUMB_BYTES || fullSize < 100 || thumbSize < 100) {
      await discard(db, photoId, paths);
      return sendError(res, 422, 'That photo could not be accepted (size).', { code: 'invalid' });
    }

    const [fullOk, thumbOk] = await Promise.all([looksLikeJpeg(db, paths[0]!), looksLikeJpeg(db, paths[1]!)]);
    if (!fullOk || !thumbOk) {
      await discard(db, photoId, paths);
      return sendError(res, 422, 'That file is not a valid photo.', { code: 'invalid' });
    }

    const { error: updErr } = await db
      .from('photos')
      .update({ finalized: true, size_bytes: fullSize + thumbSize })
      .eq('id', photoId);
    if (updErr) throw updErr;

    res.status(200).json({ ok: true, status: photo.approval_status });
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error('[upload-complete] configuration error:', e.message);
      return sendError(res, 503, e.message, { code: 'config' });
    }
    console.error('[upload-complete] failed:', e);
    sendError(res, 500, 'Something went wrong on our side. Please try again.');
  }
}
