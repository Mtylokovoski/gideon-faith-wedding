import { firstHeader, noStore, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { BUCKET, ConfigError, getAdminClient } from './_lib/supabaseAdmin.js';

/**
 * Daily housekeeping (scheduled in vercel.json):
 *  - removes uploads that were started but never finished (older than 24 hours) and their files
 *  - removes rate-limit records older than 2 days
 * Vercel calls this with "Authorization: Bearer $CRON_SECRET".
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res);
  const secret = process.env.CRON_SECRET;
  if (!secret) return sendError(res, 503, 'CRON_SECRET is not configured.');
  if (firstHeader(req, 'authorization') !== `Bearer ${secret}`) return sendError(res, 401, 'Unauthorized.');

  try {
    const db = getAdminClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stale, error } = await db
      .from('photos')
      .select('id, storage_path, thumb_path')
      .eq('finalized', false)
      .lt('uploaded_at', cutoff)
      .limit(500);
    if (error) throw error;

    let removed = 0;
    if (stale && stale.length > 0) {
      const paths = stale.flatMap((p) => [p.storage_path as string, p.thumb_path as string]);
      await db.storage.from(BUCKET).remove(paths);
      const { error: delErr } = await db
        .from('photos')
        .delete()
        .in('id', stale.map((p) => p.id as string));
      if (delErr) throw delErr;
      removed = stale.length;
    }

    const attemptsCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await db.from('upload_attempts').delete().lt('created_at', attemptsCutoff);

    res.status(200).json({ ok: true, removedIncompleteUploads: removed });
  } catch (e) {
    if (e instanceof ConfigError) return sendError(res, 503, e.message);
    console.error('[cron-cleanup] failed:', e);
    sendError(res, 500, 'Cleanup failed.');
  }
}
