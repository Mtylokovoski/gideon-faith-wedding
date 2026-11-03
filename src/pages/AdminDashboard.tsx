import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, HardDrive, Images, Loader2, LogOut, QrCode, ShieldX, ThumbsDown, XCircle } from 'lucide-react';
import AdminPhotos from '../components/AdminPhotos';
import AdminSettings from '../components/AdminSettings';
import SharingTab from '../components/SharingTab';
import { useAdminSession } from '../hooks/useAdminSession';
import { cx, couple, errorMessage, formatBytes, formatDateTime } from '../lib/format';
import { DEFAULT_SLUG } from '../lib/site';
import { fetchStats, listPhotos } from '../services/adminService';
import { subscribeToGallery } from '../services/photoService';
import type { AdminPhoto, AdminStats, ApprovalStatus, Wedding } from '../types';

type Tab = 'overview' | 'photos' | 'share';
type Notice = { kind: 'ok' | 'err'; text: string; id: number };

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="card p-4">
      <div className={cx('flex items-center gap-2 text-sm font-bold', tone ?? 'text-lavender-700')}>
        {icon} {label}
      </div>
      <p className="mt-1 font-serif text-4xl font-bold">{value}</p>
    </div>
  );
}

function Dashboard({
  wedding,
  email,
  onWeddingChange,
  onSignOut,
}: {
  wedding: Wedding;
  email: string;
  onWeddingChange: (w: Wedding) => void;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [photosStatus, setPhotosStatus] = useState<ApprovalStatus | 'all'>('all');
  const [photosKey, setPhotosKey] = useState(0);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recent, setRecent] = useState<AdminPhoto[]>([]);
  const [reloadSignal, setReloadSignal] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const notify = useCallback((kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), notice.kind === 'err' ? 8000 : 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const refreshOverview = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        fetchStats(wedding.id),
        listPhotos(wedding.id, { status: 'all', category: 'all', search: '' }, 0, 8),
      ]);
      setStats(s);
      setRecent(r.rows);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [wedding.id]);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  // Live: when a guest uploads (or anything changes) refresh the numbers and the open list.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = subscribeToGallery(wedding.gallery_token, () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void refreshOverview();
        setReloadSignal((n) => n + 1);
      }, 800);
    });
    return () => {
      window.clearTimeout(timer.current);
      unsubscribe();
    };
  }, [wedding.gallery_token, refreshOverview]);

  const goPending = () => {
    setPhotosStatus('pending');
    setPhotosKey((k) => k + 1);
    setTab('photos');
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Images className="h-5 w-5" aria-hidden /> },
    { id: 'photos', label: 'Photos', icon: <CheckCircle2 className="h-5 w-5" aria-hidden /> },
    { id: 'share', label: 'QR code & sharing', icon: <QrCode className="h-5 w-5" aria-hidden /> },
  ];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-lavender-50 to-ivory pb-24">
      <header className="border-b border-champagne-300/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-script text-4xl leading-none text-lavender-800">{couple(wedding)}</h1>
            <p className="text-xs text-lavender-600">Couple dashboard · {email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/wedding/${wedding.wedding_slug}`} className="btn-ghost btn-sm">
              Guest page
            </Link>
            <button type="button" onClick={onSignOut} className="btn-outline btn-sm">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3" role="tablist" aria-label="Dashboard sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'flex min-h-[48px] shrink-0 items-center gap-2 border-b-4 px-4 text-sm font-bold transition',
                tab === t.id ? 'border-lavender-600 text-lavender-800' : 'border-transparent text-lavender-500 hover:text-lavender-700',
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6">
        {tab === 'overview' && (
          <div className="space-y-6">
            {loadError && (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {loadError}
              </p>
            )}
            <section aria-label="Numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat icon={<Images className="h-4 w-4" aria-hidden />} label="Uploaded" value={stats ? stats.total.toLocaleString() : '…'} />
              <Stat icon={<Clock className="h-4 w-4" aria-hidden />} label="Pending" value={stats ? stats.pending.toLocaleString() : '…'} tone="text-amber-700" />
              <Stat icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} label="Approved" value={stats ? stats.approved.toLocaleString() : '…'} tone="text-green-700" />
              <Stat icon={<ThumbsDown className="h-4 w-4" aria-hidden />} label="Rejected" value={stats ? stats.rejected.toLocaleString() : '…'} tone="text-red-700" />
              <Stat icon={<HardDrive className="h-4 w-4" aria-hidden />} label="Storage used" value={stats ? formatBytes(stats.bytes) : '…'} />
            </section>

            {stats && stats.pending > 0 && (
              <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="font-bold">
                  {stats.pending} {stats.pending === 1 ? 'photo is' : 'photos are'} waiting for your approval.
                </p>
                <button type="button" className="btn-primary btn-sm" onClick={goPending}>
                  Review pending photos
                </button>
              </div>
            )}

            <section aria-labelledby="recent-h">
              <h2 id="recent-h" className="text-2xl font-bold">
                Recent uploads
              </h2>
              {recent.length === 0 ? (
                <p className="card mt-3 p-6 text-center text-lavender-800">No photos yet. They will show up here as soon as guests share them.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {recent.map((p) => (
                    <li key={p.id} className="card overflow-hidden">
                      <img src={p.thumbUrl} alt={p.caption ?? 'Recent upload'} loading="lazy" className="h-32 w-full bg-lavender-100 object-cover" />
                      <p className="px-3 py-2 text-xs text-lavender-700">
                        {formatDateTime(p.uploaded_at)}
                        <span className="ml-1 font-bold">· {p.approval_status}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="settings-h">
              <h2 id="settings-h" className="mb-3 text-2xl font-bold">
                Settings
              </h2>
              <AdminSettings wedding={wedding} onWeddingChange={onWeddingChange} notify={notify} />
            </section>
          </div>
        )}

        {tab === 'photos' && (
          <AdminPhotos
            key={photosKey}
            wedding={wedding}
            initialStatus={photosStatus}
            reloadSignal={reloadSignal}
            onChanged={() => void refreshOverview()}
            notify={notify}
          />
        )}

        {tab === 'share' && <SharingTab wedding={wedding} onWeddingChange={onWeddingChange} notify={notify} />}
      </main>

      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role={notice.kind === 'err' ? 'alert' : 'status'}
            className={cx(
              'fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-xl',
              notice.kind === 'ok' ? 'bg-lavender-700' : 'bg-red-600',
            )}
          >
            {notice.kind === 'ok' ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> : <XCircle className="h-5 w-5 shrink-0" aria-hidden />}
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminDashboard() {
  const { state, setWedding, signOut, reload } = useAdminSession();

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-lavender-600">
        <Loader2 className="h-10 w-10 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (state.status === 'signedOut') return <Navigate to="/admin/login" replace />;

  if (state.status === 'notAdmin') {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <ShieldX className="h-14 w-14 text-red-500" aria-hidden />
        <h1 className="mt-3 text-3xl font-bold">No access</h1>
        <p className="mt-2">
          {state.email} is signed in, but is not an administrator of this wedding. Ask the person who set up the website to add
          this account (see “Set up administrator accounts” in the README).
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => void signOut()} className="btn-primary">
            Sign out
          </button>
          <Link to={`/wedding/${DEFAULT_SLUG}`} className="btn-outline">
            Photo booth
          </Link>
        </div>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg">{state.message}</p>
        <button type="button" onClick={() => void reload()} className="btn-primary mt-5">
          Try again
        </button>
      </main>
    );
  }

  return <Dashboard wedding={state.wedding} email={state.email} onWeddingChange={setWedding} onSignOut={() => void signOut()} />;
}
