import { noStore, queryString, sendError, type ApiRequest, type ApiResponse } from './_lib/http.js';
import { BUCKET, ConfigError, getAdminClient } from './_lib/supabaseAdmin.js';
import { TOKEN_RE, isCategory, parseCursor } from './_lib/validate.js';

const SIGNED_URL_SECONDS = 6 * 60 * 60;

/**
 * Read-only gallery feed. The secret gallery token is the key: without the exact 64-character
 * token nothing is returned. Only APPROVED, finalized photos are listed, and each image is
 * served through a signed URL that expires after 6 hours (the bucket itself is private).
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed.');
  }

  try {
    const token = queryString(req, 'token') ?? '';
    if (!TOKEN_RE.test(token)) return sendError(res, 404, 'This gallery link is not valid.');

    const limitRaw = Number.parseInt(queryString(req, 'limit') ?? '36', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 60) : 36;
    const before = parseCursor(queryString(req, 'before'));
    const categoryRaw = queryString(req, 'category');
    const category = categoryRaw && isCategory(categoryRaw) ? categoryRaw : undefined;

    const db = getAdminClient();
    const { data: wedding, error: wErr } = await db
      .from('weddings')
      .select('id, bride_name, groom_name, wedding_date, wedding_slug, upload_enabled')
      .eq('gallery_token', token)
      .maybeSingle();
    if (wErr) throw wErr;
    if (!wedding) return sendError(res, 404, 'This gallery link is not valid.');

    let query = db
      .from('photos')
      .select('id, caption, category, guest_name, uploaded_at, width, height, storage_path, thumb_path')
      .eq('wedding_id', wedding.id)
      .eq('approval_status', 'approved')
      .eq('finalized', true)
      .order('uploaded_at', { ascending: false })
      .limit(limit + 1);
    if (before) query = query.lt('uploaded_at', before);
    if (category) query = query.eq('category', category);

    let countQuery = db
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('wedding_id', wedding.id)
      .eq('approval_status', 'approved')
      .eq('finalized', true);
    if (category) countQuery = countQuery.eq('category', category);

    const [{ data: rows, error: pErr }, { count, error: cErr }] = await Promise.all([query, countQuery]);
    if (pErr) throw pErr;
    if (cErr) throw cErr;

    const page = (rows ?? []).slice(0, limit);
    const hasMore = (rows ?? []).length > limit;

    let urls: { signedUrl: string | null }[] = [];
    if (page.length > 0) {
      const paths = page.flatMap((p) => [p.storage_path as string, p.thumb_path as string]);
      const { data: signed, error: sErr } = await db.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (sErr) throw sErr;
      urls = (signed ?? []).map((s) => ({ signedUrl: s.signedUrl }));
    }

    const photos = page.map((p, i) => ({
      id: p.id,
      caption: p.caption,
      category: p.category,
      guest_name: p.guest_name,
      uploaded_at: p.uploaded_at,
      width: p.width,
      height: p.height,
      url: urls[i * 2]?.signedUrl ?? '',
      thumb_url: urls[i * 2 + 1]?.signedUrl ?? '',
    }));

    res.status(200).json({
      wedding: {
        bride_name: wedding.bride_name,
        groom_name: wedding.groom_name,
        wedding_date: wedding.wedding_date,
        wedding_slug: wedding.wedding_slug,
        upload_enabled: wedding.upload_enabled,
      },
      photos,
      hasMore,
      total: count ?? 0,
    });
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error('[gallery] configuration error:', e.message);
      return sendError(res, 503, e.message, { code: 'config' });
    }
    console.error('[gallery] failed:', e);
    sendError(res, 500, 'Something went wrong on our side. Please try again.');
  }
}
