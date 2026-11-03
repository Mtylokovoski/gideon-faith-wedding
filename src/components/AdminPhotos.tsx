import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Eye, Loader2, Package, Search, Trash2, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import PhotoViewer from './PhotoViewer';
import { CATEGORIES, CATEGORY_LABEL } from '../lib/constants';
import { cx, errorMessage, formatBytes, formatDateTime } from '../lib/format';
import * as api from '../services/adminService';
import type { AdminPhoto, ApprovalStatus, CategoryId, Wedding } from '../types';

const PAGE = 24;

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<ApprovalStatus, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

interface Props {
  wedding: Wedding;
  initialStatus: ApprovalStatus | 'all';
  /** Bump this number to make the list refresh itself quietly (live updates). */
  reloadSignal: number;
  onChanged: () => void;
  notify: (kind: 'ok' | 'err', text: string) => void;
}

type Pending = { title: string; body: string; confirmLabel: string; danger?: boolean; run: () => Promise<void> };

export default function AdminPhotos({ wedding, initialStatus, reloadSignal, onChanged, notify }: Props) {
  const [status, setStatus] = useState<ApprovalStatus | 'all'>(initialStatus);
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const [rows, setRows] = useState<AdminPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [zip, setZip] = useState<{ done: number; total: number; part: number; parts: number } | null>(null);

  const reqId = useRef(0);
  const countRef = useRef(0);
  countRef.current = rows.length;

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (mode: 'reset' | 'more' | 'silent') => {
      const id = ++reqId.current;
      if (mode === 'reset') setLoading(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const offset = mode === 'more' ? countRef.current : 0;
        const size = mode === 'silent' ? Math.min(500, Math.max(PAGE, countRef.current)) : PAGE;
        const res = await api.listPhotos(wedding.id, { status, category, search: debounced }, offset, size);
        if (id !== reqId.current) return;
        setRows((prev) => (mode === 'more' ? [...prev, ...res.rows.filter((r) => !prev.some((p) => p.id === r.id))] : res.rows));
        setTotal(res.total);
        setError(null);
      } catch (e) {
        if (id === reqId.current && mode !== 'silent') setError(errorMessage(e));
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [wedding.id, status, category, debounced],
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setSelected(new Set());
    void load('reset');
  }, [load]);

  useEffect(() => {
    if (reloadSignal > 0) void loadRef.current('silent');
  }, [reloadSignal]);

  async function act(fn: () => Promise<void>, okText: string) {
    setBusy(true);
    try {
      await fn();
      notify('ok', okText);
      setSelected(new Set());
      await load('silent');
      onChanged();
    } catch (e) {
      notify('err', errorMessage(e));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const ids = (list: AdminPhoto[]) => list.map((p) => p.id);
  const chosen = rows.filter((r) => selected.has(r.id));
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setStatusFor = (list: AdminPhoto[], s: ApprovalStatus) =>
    act(
      () => api.setStatus(ids(list), s),
      s === 'approved' ? (list.length === 1 ? 'Photo approved.' : `${list.length} photos approved.`) : list.length === 1 ? 'Photo rejected.' : `${list.length} photos rejected.`,
    );

  const askDelete = (list: AdminPhoto[]) =>
    setPending({
      title: list.length === 1 ? 'Delete this photo?' : `Delete ${list.length} photos?`,
      body: 'This permanently removes the photo from the gallery and from storage. It cannot be undone. Download it first if you want to keep a copy.',
      confirmLabel: 'Delete',
      danger: true,
      run: () => act(() => api.deletePhotos(list), list.length === 1 ? 'Photo deleted.' : `${list.length} photos deleted.`),
    });

  async function downloadZip(list: Parameters<typeof api.downloadZips>[0], name: string) {
    setBusy(true);
    setZip({ done: 0, total: list.length, part: 1, parts: 1 });
    try {
      await api.downloadZips(list, name, setZip);
      notify('ok', 'Your download is ready.');
    } catch (e) {
      notify('err', errorMessage(e));
    } finally {
      setZip(null);
      setBusy(false);
    }
  }

  async function downloadAll(onlyApproved: boolean) {
    setBusy(true);
    try {
      const list = await api.fetchAllForDownload(wedding.id, onlyApproved ? ['approved'] : undefined);
      setBusy(false);
      if (list.length === 0) {
        notify('err', 'There are no photos to download yet.');
        return;
      }
      await downloadZip(list, `${wedding.wedding_slug}-${onlyApproved ? 'approved-photos' : 'all-photos'}`);
    } catch (e) {
      notify('err', errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div>
      {/* filters */}
      <div className="card grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <label htmlFor="photo-search" className="label">
            Search captions and names
          </label>
          <Search className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 text-lavender-400" aria-hidden />
          <input id="photo-search" className="input pl-12" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
        </div>
        <div>
          <label htmlFor="photo-status" className="label">
            Status
          </label>
          <select id="photo-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as ApprovalStatus | 'all')}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label htmlFor="photo-category" className="label">
            Category
          </label>
          <select id="photo-category" className="input" value={category} onChange={(e) => setCategory(e.target.value as CategoryId | 'all')}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* download everything */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-gold btn-sm" disabled={busy} onClick={() => void downloadAll(false)}>
          <Package className="h-4 w-4" aria-hidden /> Download all photos (ZIP)
        </button>
        <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => void downloadAll(true)}>
          <Package className="h-4 w-4" aria-hidden /> Approved only
        </button>
        {zip && (
          <p role="status" className="flex items-center gap-2 text-sm font-bold text-lavender-700">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Preparing {zip.done} of {zip.total}
            {zip.parts > 1 && ` (file ${zip.part} of ${zip.parts})`}… please keep this page open.
          </p>
        )}
      </div>

      {/* bulk bar */}
      <div className="sticky top-0 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-lavender-100/95 px-4 py-3 backdrop-blur">
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="h-5 w-5 accent-lavender-600"
            checked={allOnPage}
            onChange={() => setSelected(allOnPage ? new Set() : new Set(ids(rows)))}
          />
          Select all shown
        </label>
        <span className="text-sm text-lavender-700">
          {selected.size > 0 ? `${selected.size} selected` : `${rows.length} of ${total.toLocaleString()} shown`}
        </span>
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => void setStatusFor(chosen, 'approved')}>
              <Check className="h-4 w-4" aria-hidden /> Approve
            </button>
            <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => void setStatusFor(chosen, 'rejected')}>
              <X className="h-4 w-4" aria-hidden /> Reject
            </button>
            <select
              aria-label="Move selected photos to a category"
              className="input min-h-[44px] w-auto py-0 text-sm"
              value=""
              disabled={busy}
              onChange={(e) => {
                const c = e.target.value as CategoryId;
                if (c) void act(() => api.setCategory(ids(chosen), c), `Moved to “${CATEGORY_LABEL[c]}”.`);
              }}
            >
              <option value="">Move to…</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => void downloadZip(chosen, `${wedding.wedding_slug}-selected`)}>
              <Download className="h-4 w-4" aria-hidden /> Download
            </button>
            <button type="button" className="btn-danger btn-sm" disabled={busy} onClick={() => askDelete(chosen)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </button>
          </div>
        )}
      </div>

      {/* grid */}
      {loading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading photos">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-72 rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <div className="card mt-4 p-6 text-center">
          <p>{error}</p>
          <button type="button" className="btn-primary btn-sm mt-4" onClick={() => void load('reset')}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-lavender-800">No photos match these filters yet.</div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p, i) => (
            <li key={p.id} className={cx('card overflow-hidden', selected.has(p.id) && 'ring-4 ring-lavender-400')}>
              <div className="relative">
                <button type="button" onClick={() => setViewer(i)} className="block w-full" aria-label="View full size">
                  <img src={p.thumbUrl} alt={p.caption ?? 'Wedding photo'} loading="lazy" className="h-56 w-full bg-lavender-100 object-cover" />
                </button>
                <label className="absolute left-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow">
                  <input
                    type="checkbox"
                    className="h-6 w-6 accent-lavender-600"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label="Select photo"
                  />
                </label>
                <span className={cx('absolute right-2 top-2 rounded-full px-3 py-1 text-xs font-extrabold', STATUS_STYLE[p.approval_status])}>
                  {STATUS_LABEL[p.approval_status]}
                </span>
              </div>
              <div className="space-y-2 p-4">
                <p className="min-h-[1.5rem] break-words text-sm font-bold">{p.caption || <span className="font-normal text-lavender-500">No caption</span>}</p>
                <p className="text-xs text-lavender-700">
                  {p.guest_name ? `${p.guest_name} · ` : ''}
                  {formatDateTime(p.uploaded_at)} · {formatBytes(p.size_bytes)}
                </p>
                <select
                  aria-label="Category"
                  className="input min-h-[44px] text-sm"
                  value={p.category}
                  disabled={busy}
                  onChange={(e) => {
                    const c = e.target.value as CategoryId;
                    void act(() => api.setCategory([p.id], c), `Moved to “${CATEGORY_LABEL[c]}”.`);
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2 pt-1">
                  {p.approval_status !== 'approved' && (
                    <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => void setStatusFor([p], 'approved')}>
                      <Check className="h-4 w-4" aria-hidden /> Approve
                    </button>
                  )}
                  {p.approval_status !== 'rejected' && (
                    <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => void setStatusFor([p], 'rejected')}>
                      <X className="h-4 w-4" aria-hidden /> Reject
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => void api.downloadOne(p).catch((e: unknown) => notify('err', errorMessage(e)))}
                    aria-label="Download photo"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setViewer(i)} aria-label="View full size">
                    <Eye className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className="btn-ghost btn-sm text-red-700" disabled={busy} onClick={() => askDelete([p])} aria-label="Delete photo">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && rows.length < total && (
        <div className="mt-6 text-center">
          <button type="button" className="btn-outline" disabled={loadingMore} onClick={() => void load('more')}>
            {loadingMore && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />} Show more photos
          </button>
        </div>
      )}

      {viewer !== null && rows.length > 0 && (
        <PhotoViewer
          photos={rows.map((p) => ({
            id: p.id,
            url: p.url ?? p.thumbUrl ?? '',
            caption: p.caption,
            category: p.category,
            uploaded_at: p.uploaded_at,
          }))}
          index={Math.min(viewer, rows.length - 1)}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
        />
      )}

      {pending && (
        <ConfirmDialog
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          danger={pending.danger}
          busy={busy}
          onConfirm={() => void pending.run()}
          onCancel={() => !busy && setPending(null)}
        />
      )}
    </div>
  );
}
