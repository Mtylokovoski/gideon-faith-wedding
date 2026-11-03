import { useCallback, useEffect, useRef, useState } from 'react';
import type { CategoryId, GalleryPhoto, GalleryResponse } from '../types';
import { fetchGallery, subscribeToGallery } from '../services/photoService';
import { errorMessage } from '../lib/format';

/**
 * Merge a freshly fetched "top of the gallery" page into what we already show:
 *  - new photos appear at the top, edited captions/categories update,
 *  - photos that vanished from that range (rejected/deleted) are removed,
 *  - existing signed image URLs are kept so images don't reload.
 */
export function mergeTop(prev: GalleryPhoto[], fresh: GalleryPhoto[], freshIsFull: boolean): GalleryPhoto[] {
  const freshIds = new Set(fresh.map((p) => p.id));
  const prevById = new Map(prev.map((p) => [p.id, p]));
  const floor = freshIsFull && fresh.length > 0 ? fresh[fresh.length - 1]!.uploaded_at : null;

  const merged: GalleryPhoto[] = fresh.map((f) => {
    const old = prevById.get(f.id);
    return old ? { ...f, url: old.url || f.url, thumb_url: old.thumb_url || f.thumb_url } : f;
  });
  for (const p of prev) {
    if (freshIds.has(p.id)) continue;
    // Keep only items older than the fetched range; anything newer that is missing was removed.
    if (floor !== null && p.uploaded_at < floor) merged.push(p);
  }
  merged.sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : a.uploaded_at > b.uploaded_at ? -1 : 0));
  return merged;
}

export function useGallery(token: string, category: CategoryId | 'all') {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [wedding, setWedding] = useState<GalleryResponse['wedding'] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const photosRef = useRef<GalleryPhoto[]>([]);
  photosRef.current = photos;
  const hasMoreRef = useRef(false);
  hasMoreRef.current = hasMore;
  const busyMore = useRef(false);
  const requestId = useRef(0);
  const cat = category === 'all' ? undefined : category;

  const loadFirst = useCallback(async () => {
    const id = (requestId.current += 1);
    setLoading(true);
    setError(null);
    try {
      const r = await fetchGallery({ token, category: cat });
      if (id !== requestId.current) return;
      setPhotos(r.photos);
      setWedding(r.wedding);
      setTotal(r.total);
      setHasMore(r.hasMore);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(errorMessage(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [token, cat]);

  const refreshTop = useCallback(async () => {
    try {
      const r = await fetchGallery({ token, category: cat });
      setWedding(r.wedding);
      setTotal(r.total);
      setPhotos((prev) => mergeTop(prev, r.photos, r.hasMore));
      setError(null);
    } catch {
      /* keep showing what we have */
    }
  }, [token, cat]);

  const loadMore = useCallback(async () => {
    if (busyMore.current || !hasMoreRef.current) return;
    const last = photosRef.current[photosRef.current.length - 1];
    if (!last) return;
    busyMore.current = true;
    setLoadingMore(true);
    try {
      const r = await fetchGallery({ token, category: cat, before: last.uploaded_at });
      setPhotos((prev) => {
        const have = new Set(prev.map((p) => p.id));
        return [...prev, ...r.photos.filter((p) => !have.has(p.id))];
      });
      setHasMore(r.hasMore);
      setTotal(r.total);
    } catch {
      /* the user can scroll again to retry */
    } finally {
      busyMore.current = false;
      setLoadingMore(false);
    }
  }, [token, cat]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  // Live updates (broadcast) + safety nets (periodic refresh, refresh when the tab becomes visible).
  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refreshTop(), 500);
    };
    const unsubscribe = subscribeToGallery(token, schedule, setLive);
    const poll = window.setInterval(() => void refreshTop(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshTop();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [token, refreshTop]);

  return { photos, wedding, total, hasMore, loading, loadingMore, error, live, loadMore, reload: loadFirst };
}
