import { useCallback, useEffect, useState } from 'react';
import type { PublicWedding } from '../types';
import { fetchPublicWedding } from '../services/photoService';
import { errorMessage } from '../lib/format';

export function useWedding(slug: string) {
  const [wedding, setWedding] = useState<PublicWedding | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        const w = await fetchPublicWedding(slug);
        setWedding(w);
        setNotFound(w === null);
        setError(null);
      } catch (e) {
        if (!silent) setError(errorMessage(e, 'We could not load this page. Please check your connection.'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    void load(false);
    // Keep the live photo counter fresh.
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return { wedding, loading, notFound, error, reload: () => load(false) };
}
