import type { AdminPhoto, AdminStats, ApprovalStatus, CategoryId, PhotoRow, Wedding } from '../types';
import { CATEGORY_LABEL, STORAGE_BUCKET } from '../lib/constants';
import { supabase } from './supabase';

const store = () => supabase.storage.from(STORAGE_BUCKET);

export interface AdminContext {
  role: string;
  wedding: Wedding;
}

/** Returns the wedding this signed-in user administers, or null if they are not an administrator. */
export async function fetchAdminContext(): Promise<AdminContext | null> {
  // Row Level Security only returns rows for the signed-in user.
  const { data: admins, error } = await supabase.from('administrators').select('wedding_id, role').limit(1);
  if (error) throw error;
  const admin = admins?.[0];
  if (!admin) return null;
  const { data: wedding, error: wErr } = await supabase
    .from('weddings')
    .select('*')
    .eq('id', admin.wedding_id)
    .single();
  if (wErr) throw wErr;
  return { role: admin.role as string, wedding: wedding as Wedding };
}

export async function fetchStats(weddingId: string): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats', { p_wedding_id: weddingId });
  if (error) throw error;
  return data as AdminStats;
}

export interface PhotoFilters {
  status: ApprovalStatus | 'all';
  category: CategoryId | 'all';
  search: string;
}

function safeSearch(s: string): string {
  // Remove characters that have special meaning inside a PostgREST filter expression.
  return s.replace(/[,()%*\\_:"']/g, ' ').trim().slice(0, 60);
}

export async function listPhotos(
  weddingId: string,
  filters: PhotoFilters,
  offset: number,
  pageSize: number,
): Promise<{ rows: AdminPhoto[]; total: number }> {
  let q = supabase
    .from('photos')
    .select('*', { count: 'exact' })
    .eq('wedding_id', weddingId)
    .eq('finalized', true)
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (filters.status !== 'all') q = q.eq('approval_status', filters.status);
  if (filters.category !== 'all') q = q.eq('category', filters.category);
  const term = safeSearch(filters.search);
  if (term) q = q.or(`caption.ilike.%${term}%,guest_name.ilike.%${term}%`);

  const { data, error, count } = await q;
  if (error) throw error;
  const rows = (data ?? []) as PhotoRow[];
  const signed = await signPaths(rows.flatMap((r) => [r.thumb_path, r.storage_path]), 3600);
  return {
    rows: rows.map((r, i) => ({ ...r, thumbUrl: signed[i * 2], url: signed[i * 2 + 1] })),
    total: count ?? 0,
  };
}

async function signPaths(paths: string[], seconds: number): Promise<string[]> {
  if (paths.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data, error } = await store().createSignedUrls(chunk, seconds);
    if (error) throw error;
    (data ?? []).forEach((d) => out.push(d.signedUrl ?? ''));
  }
  return out;
}

export async function setStatus(ids: string[], status: ApprovalStatus): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('photos').update({ approval_status: status }).in('id', ids);
  if (error) throw error;
}

export async function setCategory(ids: string[], category: CategoryId): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('photos').update({ category }).in('id', ids);
  if (error) throw error;
}

/** Deletes the image files first, then the database rows, so nothing is left behind. */
export async function deletePhotos(photos: Pick<PhotoRow, 'id' | 'storage_path' | 'thumb_path'>[]): Promise<void> {
  if (photos.length === 0) return;
  const paths = photos.flatMap((p) => [p.storage_path, p.thumb_path]);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await store().remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
  const { error } = await supabase
    .from('photos')
    .delete()
    .in('id', photos.map((p) => p.id));
  if (error) throw error;
}

export async function updateWedding(
  id: string,
  patch: Partial<Pick<Wedding, 'upload_enabled' | 'auto_approve' | 'booth_shows_gallery' | 'wedding_date'>>,
): Promise<Wedding> {
  const { data, error } = await supabase.from('weddings').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Wedding;
}

export async function regenerateGalleryToken(weddingId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_gallery_token', { p_wedding_id: weddingId });
  if (error) throw error;
  return data as string;
}

// ───────────────────────── downloads ─────────────────────────

type ZipSource = Pick<PhotoRow, 'id' | 'storage_path' | 'category' | 'uploaded_at' | 'caption' | 'guest_name'>;

function stamp(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function csvCell(v: string | null): string {
  const s = v ?? '';
  // Prefix risky leading characters so spreadsheets don't treat guest text as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function photoFileName(p: Pick<PhotoRow, 'id' | 'uploaded_at'>): string {
  return `${stamp(p.uploaded_at)}_${p.id.slice(0, 8)}.jpg`;
}

export async function downloadOne(p: Pick<PhotoRow, 'id' | 'uploaded_at' | 'storage_path'>): Promise<void> {
  const { data, error } = await store().createSignedUrl(p.storage_path, 300, { download: photoFileName(p) });
  if (error || !data) throw error ?? new Error('Could not prepare the download.');
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = photoFileName(p);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function triggerBlobDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export interface ZipProgress {
  done: number;
  total: number;
  part: number;
  parts: number;
}

const ZIP_CHUNK = 120;

/** Downloads the given photos as one or more ZIP files (split every 120 photos to keep memory safe). */
export async function downloadZips(
  photos: ZipSource[],
  baseName: string,
  onProgress?: (p: ZipProgress) => void,
): Promise<void> {
  if (photos.length === 0) return;
  const { default: JSZip } = await import('jszip');
  const parts = Math.ceil(photos.length / ZIP_CHUNK);
  let done = 0;

  for (let part = 0; part < parts; part += 1) {
    const chunk = photos.slice(part * ZIP_CHUNK, (part + 1) * ZIP_CHUNK);
    const urls = await signPaths(chunk.map((p) => p.storage_path), 900);
    const zip = new JSZip();
    const csv: string[] = ['file,category,caption,guest_name,uploaded_at'];

    let next = 0;
    const worker = async () => {
      while (next < chunk.length) {
        const idx = next;
        next += 1;
        const p = chunk[idx]!;
        const res = await fetch(urls[idx]!);
        if (!res.ok) throw new Error(`Could not fetch a photo (${res.status}).`);
        const blob = await res.blob();
        const folder = CATEGORY_LABEL[p.category].replace(/[^\w\s&-]/g, '').trim() || 'Photos';
        const file = `${folder}/${photoFileName(p)}`;
        zip.file(file, blob);
        csv.push([csvCell(file), csvCell(CATEGORY_LABEL[p.category]), csvCell(p.caption), csvCell(p.guest_name), csvCell(p.uploaded_at)].join(','));
        done += 1;
        onProgress?.({ done, total: photos.length, part: part + 1, parts });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    zip.file('photos.csv', csv.join('\n'));
    const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    triggerBlobDownload(out, parts === 1 ? `${baseName}.zip` : `${baseName}-part-${part + 1}-of-${parts}.zip`);
    if (part < parts - 1) await new Promise((r) => setTimeout(r, 800));
  }
}

/** Collects every finalized photo for the wedding (optionally only some statuses), paging past the 1000-row API limit. */
export async function fetchAllForDownload(weddingId: string, statuses?: ApprovalStatus[]): Promise<ZipSource[]> {
  const out: ZipSource[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = supabase
      .from('photos')
      .select('id, storage_path, category, uploaded_at, caption, guest_name')
      .eq('wedding_id', weddingId)
      .eq('finalized', true)
      .order('uploaded_at', { ascending: true })
      .range(from, from + size - 1);
    if (statuses && statuses.length) q = q.in('approval_status', statuses);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as ZipSource[]));
    if (!data || data.length < size) break;
  }
  return out;
}
