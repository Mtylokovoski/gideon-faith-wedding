import { randomUUID } from 'node:crypto';
import { clientIp, noStore, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { checkAndRecordUpload, hashIp } from './_lib/ratelimit.js';
import { BUCKET, ConfigError, getAdminClient } from './_lib/supabaseAdmin.js';
import { verifyTurnstile } from './_lib/turnstile.js';
import { parseUploadInit } from './_lib/validate.js';

/**
 * Step 1 of an upload.
 * Validates the request, applies abuse protection, creates an UNFINALIZED photo row and returns
 * two short-lived signed upload URLs (full image + thumbnail). The browser then uploads the
 * files straight to Supabase Storage. Nothing is visible to anyone until /api/upload-complete
 * has verified the files.
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Method not allowed.');
  }

  try {
    const parsed = parseUploadInit(req.body);
    if (!parsed.ok) return sendError(res, 400, parsed.error);
    const v = parsed.value;

    const ip = clientIp(req);
    const human = await verifyTurnstile(v.captchaToken, ip);
    if (!human) {
      return sendError(res, 403, 'The security check did not pass. Please try again.', { code: 'captcha' });
    }

    const db = getAdminClient();

    const { data: wedding, error: wErr } = await db
      .from('weddings')
      .select('id, upload_enabled, auto_approve')
      .eq('wedding_slug', v.slug)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!wedding) return sendError(res, 404, 'We could not find this wedding.');
    if (!wedding.upload_enabled) {
      return sendError(res, 403, 'Photo sharing has closed. The gallery is still open to view.', { code: 'closed' });
    }

    const limit = await checkAndRecordUpload(db, wedding.id as string, hashIp(ip));
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return sendError(res, 429, 'Too many photos from this connection right now. Please wait a few minutes and try again.', {
        code: 'rate_limited',
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const photoId = randomUUID();
    const storagePath = `${wedding.id}/${photoId}.jpg`;
    const thumbPath = `${wedding.id}/thumbs/${photoId}.jpg`;
    const status = wedding.auto_approve ? 'approved' : 'pending';

    const { error: insErr } = await db.from('photos').insert({
      id: photoId,
      wedding_id: wedding.id,
      storage_path: storagePath,
      thumb_path: thumbPath,
      caption: v.caption,
      category: v.category,
      guest_name: v.guestName,
      approval_status: status,
      finalized: false,
      width: v.width,
      height: v.height,
    });
    if (insErr) throw insErr;

    const [full, thumb] = await Promise.all([
      db.storage.from(BUCKET).createSignedUploadUrl(storagePath),
      db.storage.from(BUCKET).createSignedUploadUrl(thumbPath),
    ]);
    if (full.error || thumb.error || !full.data || !thumb.data) {
      await db.from('photos').delete().eq('id', photoId);
      throw full.error ?? thumb.error ?? new Error('Could not create upload URLs');
    }

    res.status(200).json({
      photoId,
      status,
      full: { path: storagePath, token: full.data.token, signedUrl: full.data.signedUrl },
      thumb: { path: thumbPath, token: thumb.data.token, signedUrl: thumb.data.signedUrl },
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error('[upload-init] configuration error:', e.message);
      return sendError(res, 503, e.message, { code: 'config' });
    }
    console.error('[upload-init] failed:', e);
    sendError(res, 500, 'Something went wrong on our side. Please try again.');
  }
}
