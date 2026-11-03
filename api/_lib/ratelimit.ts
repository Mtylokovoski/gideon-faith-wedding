import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT ?? 'wedding-booth-default-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Two limits, both counted in the database so they work across serverless instances:
 *   - per visitor (hashed IP): RATE_LIMIT_MAX uploads per RATE_LIMIT_WINDOW_MINUTES
 *   - per wedding overall:     RATE_LIMIT_GLOBAL_MAX uploads in the same window
 * Defaults are generous because wedding guests often share one venue Wi-Fi address.
 */
export async function checkAndRecordUpload(
  db: SupabaseClient,
  weddingId: string,
  ipHash: string,
): Promise<RateLimitResult> {
  const max = intEnv('RATE_LIMIT_MAX', 120);
  const globalMax = intEnv('RATE_LIMIT_GLOBAL_MAX', 3000);
  const windowMinutes = intEnv('RATE_LIMIT_WINDOW_MINUTES', 10);
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const retryAfterSeconds = windowMinutes * 60;

  const perIp = await db
    .from('upload_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if (perIp.error) throw perIp.error;
  if ((perIp.count ?? 0) >= max) return { allowed: false, retryAfterSeconds };

  const overall = await db
    .from('upload_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('wedding_id', weddingId)
    .gte('created_at', since);
  if (overall.error) throw overall.error;
  if ((overall.count ?? 0) >= globalMax) return { allowed: false, retryAfterSeconds };

  const ins = await db.from('upload_attempts').insert({ wedding_id: weddingId, ip_hash: ipHash });
  if (ins.error) throw ins.error;
  return { allowed: true, retryAfterSeconds: 0 };
}
