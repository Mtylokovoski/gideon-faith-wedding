import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CheckCircle2, Images, Loader2, Lock, Send } from 'lucide-react';
import CameraCapture from '../components/CameraCapture';
import { FloatingHearts, WeddingBackdrop } from '../components/Decor';
import PhotoUploader from '../components/PhotoUploader';
import UploadProgress from '../components/UploadProgress';
import WeddingHeader from '../components/WeddingHeader';
import { useTurnstile } from '../hooks/useTurnstile';
import { useWedding } from '../hooks/useWedding';
import { CONSENT_TEXT, MAX_GUEST_NAME, MAX_QUEUE } from '../lib/constants';
import { couple, errorMessage } from '../lib/format';
import { uploadPhoto } from '../services/uploadService';
import type { CategoryId, PendingUpload } from '../types';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export default function GuestUpload() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const { wedding, loading, notFound } = useWedding(slug);
  const turnstile = useTurnstile();

  const [items, setItems] = useState<PendingUpload[]>([]);
  const [cameraOpen, setCameraOpen] = useState(params.get('mode') === 'camera');
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [lastCategory, setLastCategory] = useState<CategoryId>('other');

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Free preview memory when leaving the page.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    },
    [],
  );

  // Warn before closing the page in the middle of sharing.
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [busy]);

  const patch = useCallback((id: string, p: Partial<PendingUpload>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const addItems = useCallback(
    (entries: { blob: Blob; name: string; source: 'camera' | 'file'; caption?: string; category?: CategoryId }[]) => {
      setNotice(null);
      setItems((prev) => {
        const room = Math.max(0, MAX_QUEUE - prev.length);
        if (entries.length > room) {
          setNotice({
            kind: 'warn',
            text: `You can share up to ${MAX_QUEUE} photos at a time. Share these first, then add more.`,
          });
        }
        const added: PendingUpload[] = entries.slice(0, room).map((e) => ({
          id: uid(),
          blob: e.blob,
          previewUrl: URL.createObjectURL(e.blob),
          name: e.name,
          source: e.source,
          caption: e.caption ?? '',
          category: e.category ?? lastCategory,
          status: 'ready',
          progress: 0,
        }));
        return [...prev, ...added];
      });
    },
    [lastCategory],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const runUploads = useCallback(
    async (ids?: string[]) => {
      const targets = itemsRef.current.filter(
        (i) => (i.status === 'ready' || i.status === 'error') && (!ids || ids.includes(i.id)),
      );
      if (targets.length === 0) return;
      setBusy(true);
      setNotice(null);

      const queue = [...targets];
      let ok = 0;
      let failed = 0;
      let awaitingApproval = 0;

      const worker = async () => {
        for (;;) {
          const item = queue.shift();
          if (!item) return;
          patch(item.id, { status: 'processing', progress: 0, error: undefined });
          try {
            const r = await uploadPhoto(
              item.blob,
              { slug, caption: item.caption, category: item.category, guestName: guestName.trim() },
              {
                getCaptchaToken: turnstile.getToken,
                onStage: (s) => patch(item.id, { status: s }),
                onProgress: (p) => patch(item.id, { progress: p }),
              },
            );
            ok += 1;
            if (r.status === 'pending') awaitingApproval += 1;
            patch(item.id, { status: 'done', progress: 100 });
          } catch (e) {
            failed += 1;
            patch(item.id, { status: 'error', error: errorMessage(e, 'This photo could not be shared.') });
          }
        }
      };

      await Promise.all([worker(), worker()]);
      setBusy(false);

      if (ok > 0 && failed === 0) {
        setNotice({
          kind: 'ok',
          text:
            awaitingApproval > 0
              ? `Thank you! ${ok === 1 ? 'Your photo is' : `Your ${ok} photos are`} shared and will appear in the gallery once the couple has approved ${ok === 1 ? 'it' : 'them'}. 💜`
              : `Thank you! ${ok === 1 ? 'Your photo is' : `All ${ok} photos are`} now in the wedding gallery. 💜`,
        });
      } else if (ok > 0) {
        setNotice({ kind: 'warn', text: `${ok} shared, ${failed} did not go through. Tap “Try again” on the ones marked below.` });
      } else if (failed > 0) {
        setNotice({ kind: 'warn', text: 'Nothing was shared yet. Please check the messages below and try again.' });
      }
    },
    [guestName, patch, slug, turnstile.getToken],
  );

  const pendingCount = items.filter((i) => i.status === 'ready' || i.status === 'error').length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const names = wedding ? couple(wedding) : 'Gideon & Faith';
  const closed = wedding ? !wedding.upload_enabled : false;

  return (
    <div className="relative min-h-[100dvh] pb-16">
      <WeddingBackdrop />
      <FloatingHearts count={6} />
      <WeddingHeader names={names} subtitle="Share your photos" backTo={`/wedding/${slug}`} backLabel="Home" />

      <main className="relative z-10 mx-auto max-w-xl px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-20 text-lavender-600">
            <Loader2 className="h-10 w-10 animate-spin" aria-label="Loading" />
          </div>
        ) : notFound ? (
          <p className="card p-6 text-center">We could not find this wedding page. Please scan the QR code again.</p>
        ) : closed ? (
          <div className="card space-y-4 p-6 text-center">
            <Lock className="mx-auto h-10 w-10 text-champagne-600" aria-hidden />
            <h2 className="text-3xl font-bold">Photo sharing has closed</h2>
            <p>Thank you for being part of our day. The gallery is still open for everyone to enjoy.</p>
            {wedding?.gallery_token && (
              <Link to={`/gallery/${wedding.gallery_token}`} className="btn-primary">
                <Images className="h-5 w-5" aria-hidden /> View wedding gallery
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4">
              <button type="button" onClick={() => setCameraOpen(true)} disabled={busy} className="btn-primary min-h-[64px] text-lg">
                <Camera className="h-6 w-6" aria-hidden /> TAKE A PHOTO 📸
              </button>
              <div className="flex items-center gap-3 text-sm text-lavender-600" aria-hidden>
                <span className="h-px flex-1 bg-champagne-300" /> or <span className="h-px flex-1 bg-champagne-300" />
              </div>
              <PhotoUploader
                disabled={busy}
                onFiles={(files) => addItems(files.map((f) => ({ blob: f, name: f.name, source: 'file' as const })))}
              />
            </div>

            <AnimatePresence>
              {notice && (
                <motion.div
                  key="notice"
                  role="status"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`card flex items-start gap-3 p-4 ${notice.kind === 'ok' ? '!border-green-300 !bg-green-50' : '!border-amber-300 !bg-amber-50'}`}
                >
                  {notice.kind === 'ok' && <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" aria-hidden />}
                  <p className="text-base">{notice.text}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {items.length > 0 && (
              <section aria-label="Your photos" className="space-y-4">
                <h2 className="font-serif text-2xl font-bold text-lavender-900">
                  Your photos ({items.length})
                  {doneCount > 0 && <span className="ml-2 text-base font-semibold text-green-700">{doneCount} shared</span>}
                </h2>
                <UploadProgress
                  items={items}
                  disabled={busy}
                  onChange={(id, p) => {
                    patch(id, p);
                    if (p.category) setLastCategory(p.category);
                  }}
                  onRemove={removeItem}
                  onRetry={(id) => void runUploads([id])}
                />

                {pendingCount > 0 && (
                  <div className="card space-y-3 p-4">
                    <div>
                      <label htmlFor="guest-name" className="label">
                        Your name <span className="font-normal text-lavender-600">(optional)</span>
                      </label>
                      <input
                        id="guest-name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        maxLength={MAX_GUEST_NAME}
                        autoComplete="off"
                        placeholder="You can leave this empty"
                        className="input"
                      />
                    </div>
                    <p className="rounded-2xl bg-lavender-50 p-3 text-sm text-lavender-800">{CONSENT_TEXT}</p>
                    <button type="button" onClick={() => void runUploads()} disabled={busy} className="btn-gold w-full min-h-[64px] text-lg">
                      {busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Send className="h-6 w-6" aria-hidden />}
                      {busy ? 'Sharing…' : `AGREE & SHARE ${pendingCount} ${pendingCount === 1 ? 'PHOTO' : 'PHOTOS'}`}
                    </button>
                  </div>
                )}

                {doneCount > 0 && pendingCount === 0 && !busy && (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      className="btn-primary flex-1"
                      onClick={() => {
                        items.filter((i) => i.status === 'done').forEach((i) => URL.revokeObjectURL(i.previewUrl));
                        setItems((prev) => prev.filter((i) => i.status !== 'done'));
                        setNotice(null);
                        setCameraOpen(true);
                      }}
                    >
                      <Camera className="h-5 w-5" aria-hidden /> Share more photos
                    </button>
                    {wedding?.gallery_token && (
                      <Link to={`/gallery/${wedding.gallery_token}`} className="btn-outline flex-1">
                        <Images className="h-5 w-5" aria-hidden /> View gallery
                      </Link>
                    )}
                  </div>
                )}
              </section>
            )}

            {items.length === 0 && (
              <p className="px-2 text-center text-sm text-lavender-700">{CONSENT_TEXT}</p>
            )}
          </div>
        )}

        {/* Invisible security check mount point (only used if Turnstile is configured) */}
        <div ref={turnstile.containerRef} className="mt-4 flex justify-center" />
      </main>

      {cameraOpen && !closed && (
        <CameraCapture
          keptCount={items.filter((i) => i.source === 'camera' && i.status !== 'done').length}
          defaultCategory={lastCategory}
          onAdd={(blob, caption, category) => {
            setLastCategory(category);
            addItems([{ blob, name: 'camera.jpg', source: 'camera', caption, category }]);
          }}
          onFiles={(files) => addItems(files.map((f) => ({ blob: f, name: f.name, source: 'camera' as const })))}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
