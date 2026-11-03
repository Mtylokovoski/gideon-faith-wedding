import type { CategoryId, GalleryEvent, GalleryResponse, PublicWedding } from '../types';
import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function readJson<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const obj = (data ?? {}) as { error?: string; code?: string };
    throw new ApiError(obj.error ?? 'Something went wrong. Please try again.', res.status, obj.code);
  }
  return data as T;
}

/** Public details for the guest booth page (names, upload switch, approved-photo counter). */
export async function fetchPublicWedding(slug: string): Promise<PublicWedding | null> {
  const { data, error } = await supabase.rpc('get_public_wedding', { p_slug: slug });
  if (error) throw error;
  return (data as PublicWedding | null) ?? null;
}

export async function fetchGallery(args: {
  token: string;
  before?: string;
  category?: CategoryId;
  limit?: number;
}): Promise<GalleryResponse> {
  const q = new URLSearchParams({ token: args.token });
  if (args.before) q.set('before', args.before);
  if (args.category) q.set('category', args.category);
  if (args.limit) q.set('limit', String(args.limit));
  const res = await fetch(`/api/gallery?${q.toString()}`, { headers: { Accept: 'application/json' } });
  return readJson<GalleryResponse>(res);
}

/**
 * Live updates. The database broadcasts a tiny "something changed" message on a channel named
 * after the secret gallery token; we then re-fetch through the token-checked API.
 */
export function subscribeToGallery(
  token: string,
  onEvent: (e: GalleryEvent) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  const channel = supabase
    .channel(`gallery:${token}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'photo_changed' }, (msg) => onEvent(msg.payload as GalleryEvent))
    .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'));
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Save a photo to the visitor's device. */
export async function downloadPhoto(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download this photo.');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}
