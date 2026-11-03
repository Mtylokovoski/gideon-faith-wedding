import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BUCKET = 'wedding-photos';

export class ConfigError extends Error {}

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Runs ONLY inside serverless functions — the key is read from the
 * server environment and is never bundled into frontend code.
 */
export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length || !url || !key) {
    throw new ConfigError(`Server is missing environment variable(s): ${missing.join(', ')}`);
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
