import { noStore, type ApiRequest, type ApiResponse } from './_lib/http.js';

/**
 * TEMPORARY setup check. Remove this file once uploads work.
 * Reports what the server environment looks like WITHOUT revealing any secret:
 * only the address host, the kind and length of each key, and Supabase's own reply.
 */
function kindOf(key: string | undefined): string {
  if (!key) return 'missing';
  if (key.startsWith('sb_secret_')) return 'sb_secret';
  if (key.startsWith('sb_publishable_')) return 'sb_publishable';
  if (key.startsWith('eyJ')) return 'legacy-jwt';
  return 'unrecognised';
}

function jwtInfo(key: string | undefined): { role?: string; projectRef?: string } {
  if (!key || !key.startsWith('eyJ')) return {};
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      role?: string;
      ref?: string;
    };
    return { role: payload.role, projectRef: payload.ref };
  } catch {
    return {};
  }
}

export default async function handler(_req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res);
  const rawUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const urlSource = process.env.SUPABASE_URL ? 'SUPABASE_URL' : process.env.VITE_SUPABASE_URL ? 'VITE_SUPABASE_URL' : 'none';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;

  let host = 'missing';
  try {
    if (rawUrl) host = new URL(rawUrl.trim()).host;
  } catch {
    host = 'not a valid address';
  }

  const out: Record<string, unknown> = {
    urlSource,
    urlHost: host,
    urlHasExtraSpaceOrSlash: rawUrl ? rawUrl !== rawUrl.trim() || rawUrl.endsWith('/') : null,
    otherUrlHost: (() => {
      try {
        return process.env.VITE_SUPABASE_URL ? new URL(process.env.VITE_SUPABASE_URL.trim()).host : 'missing';
      } catch {
        return 'not a valid address';
      }
    })(),
    serviceKey: {
      kind: kindOf(key),
      length: key?.length ?? 0,
      hasSpaceOrLineBreak: key ? key !== key.trim() || /\s/.test(key) : null,
      ...jwtInfo(key),
    },
    anonKey: { kind: kindOf(anon), length: anon?.length ?? 0 },
    serviceKeySameAsAnonKey: Boolean(key && anon && key === anon),
  };

  if (rawUrl && key) {
    try {
      const r = await fetch(`${rawUrl.trim().replace(/\/$/, '')}/rest/v1/weddings?select=id&limit=1`, {
        headers: { apikey: key.trim(), Authorization: `Bearer ${key.trim()}` },
      });
      const body = (await r.json().catch(() => null)) as { message?: string; hint?: string } | unknown[] | null;
      out.supabaseReply = {
        httpStatus: r.status,
        worked: r.ok,
        message: Array.isArray(body) ? `ok, ${body.length} wedding row(s) visible` : body?.message,
      };
    } catch (e) {
      out.supabaseReply = { error: e instanceof Error ? e.message : 'request failed' };
    }
  }

  res.status(200).json(out);
}
