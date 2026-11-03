import { useCallback, useEffect, useState } from 'react';
import type { Wedding } from '../types';
import { fetchAdminContext } from '../services/adminService';
import { supabase } from '../services/supabase';
import { errorMessage } from '../lib/format';

export type AdminSessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'notAdmin'; email: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; email: string; role: string; wedding: Wedding };

export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>({ status: 'loading' });

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      setState({ status: 'signedOut' });
      return;
    }
    try {
      const ctx = await fetchAdminContext();
      if (!ctx) setState({ status: 'notAdmin', email: user.email ?? '' });
      else setState({ status: 'ready', email: user.email ?? '', role: ctx.role, wedding: ctx.wedding });
    } catch (e) {
      setState({ status: 'error', message: errorMessage(e) });
    }
  }, []);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState({ status: 'signedOut' });
      else if (event === 'SIGNED_IN') void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const setWedding = useCallback((wedding: Wedding) => {
    setState((s) => (s.status === 'ready' ? { ...s, wedding } : s));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ status: 'signedOut' });
  }, []);

  return { state, setWedding, signOut, reload: load };
}
