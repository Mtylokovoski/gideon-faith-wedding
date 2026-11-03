import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const missingFrontendEnv: string[] = [
  ...(url ? [] : ['VITE_SUPABASE_URL']),
  ...(anonKey ? [] : ['VITE_SUPABASE_ANON_KEY']),
];

export const isSupabaseConfigured = missingFrontendEnv.length === 0;
export const SUPABASE_URL = url ?? '';
export const SUPABASE_ANON_KEY = anonKey ?? '';

/**
 * Browser client. It only ever holds the public anon/publishable key — guests have no table
 * access with it; administrators gain access by signing in (Row Level Security enforces this).
 * Placeholders keep the app from crashing so we can show a clear "setup needed" screen instead.
 */
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
