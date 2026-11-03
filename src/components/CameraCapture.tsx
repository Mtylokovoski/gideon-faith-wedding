import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CheckCircle2, ImageIcon, Loader2, RotateCcw, SwitchCamera, X } from 'lucide-react';
import { useCamera } from '../hooks/useCamera';
import type { CategoryId } from '../types';
import { ACCEPT_ATTR, CATEGORIES, MAX_CAPTION } from '../lib/constants';
import { cx } from '../lib/format';

interface Props {
  /** Number of photos already kept in this session (shown as a badge). */
  keptCount: number;
  defaultCategory: CategoryId;
  onAdd: (blob: Blob, caption: string, category: CategoryId) => void;
  /** Photos chosen through the phone's own camera app / gallery (fallback path). */
  onFiles: (files: File[]) => void;
  onClose: () => void;
}

/**
 * Full-screen live camera. Camera permission is only requested when this opens and guests
 * are never forced to allow it — a plain "use my phone's camera app" path is always offered.
 */
export default function CameraCapture({ keptCount, defaultCategory, onAdd, onFiles, onClose }: Props) {
  const cam = useCamera();
  const { start } = cam;
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<CategoryId>(defaultCategory);
  const [flash, setFlash] = useState(false);
  const [capError, setCapError] = useState('');
  const captureInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void start('environment');
  }, [start]);

  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const take = async () => {
    setCapError('');
    try {
      const blob = await cam.capture();
      setFlash(true);
      window.setTimeout(() => setFlash(false), 160);
      setShot({ blob, url: URL.createObjectURL(blob) });
      setCaption('');
    } catch (e) {
      setCapError(e instanceof Error ? e.message : 'Could not take the photo.');
    }
  };

  const retake = () => setShot(null);

  const accept = () => {
    if (!shot) return;
    onAdd(shot.blob, caption.trim().slice(0, MAX_CAPTION), category);
    setShot(null);
    setCaption('');
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) {
      onFiles(files);
      onClose();
    }
  };

  const showFallback = ['denied', 'unavailable', 'unsupported', 'error'].includes(cam.state);

  return (
    <div role="dialog" aria-modal="true" aria-label="Take a photo" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* top bar */}
      <div className="flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="btn-sm inline-flex items-center gap-2 rounded-full bg-white/15 px-4 font-bold hover:bg-white/25">
          <X className="h-5 w-5" aria-hidden /> Close
        </button>
        {keptCount > 0 && (
          <span className="rounded-full bg-champagne-500 px-3 py-1 text-sm font-bold text-lavender-900">
            {keptCount} {keptCount === 1 ? 'photo' : 'photos'} kept
          </span>
        )}
        {cam.state === 'active' && !shot ? (
          <button
            type="button"
            onClick={() => void cam.flip()}
            aria-label="Switch between front and back camera"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <SwitchCamera className="h-6 w-6" aria-hidden />
          </button>
        ) : (
          <span className="h-11 w-11" />
        )}
      </div>

      {/* viewfinder */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <video
          ref={cam.videoRef}
          playsInline
          muted
          autoPlay
          className={cx(
            'max-h-full max-w-full object-contain',
            (shot || cam.state !== 'active') && 'invisible absolute',
            cam.mirrored && '-scale-x-100',
          )}
        />
        {shot && <img src={shot.url} alt="Your photo preview" className="max-h-full max-w-full object-contain" />}

        {cam.state === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
            <p className="text-lg">Opening the camera…</p>
            <p className="text-sm text-white/70">If your phone asks for permission, please tap “Allow”.</p>
          </div>
        )}

        {showFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-auto px-6 py-6 text-center">
            <Camera className="h-12 w-12 text-champagne-400" aria-hidden />
            <h2 className="text-2xl font-bold">
              {cam.state === 'denied' ? 'No problem — the camera is off' : 'The camera could not open here'}
            </h2>
            <p className="max-w-sm text-white/80">
              {cam.message}{' '}
              {cam.state === 'denied'
                ? 'You can still share photos using your phone’s own camera or your photo gallery.'
                : 'You can still share photos using your phone’s camera app or your photo gallery.'}
            </p>
            <div className="flex w-full max-w-xs flex-col gap-3">
              <button type="button" className="btn-gold" onClick={() => captureInput.current?.click()}>
                <Camera className="h-5 w-5" aria-hidden /> Open my phone’s camera
              </button>
              <button type="button" className="btn-outline !text-lavender-900" onClick={() => galleryInput.current?.click()}>
                <ImageIcon className="h-5 w-5" aria-hidden /> Choose from my photos
              </button>
              {cam.state !== 'unsupported' && cam.state !== 'unavailable' && (
                <button type="button" className="btn-ghost !text-white hover:!bg-white/15" onClick={() => void cam.start(cam.facing)}>
                  <RotateCcw className="h-5 w-5" aria-hidden /> Try the camera again
                </button>
              )}
            </div>
            {cam.state === 'denied' && (
              <p className="max-w-sm text-xs text-white/60">
                To allow it later: tap the lock or settings icon next to the web address, then choose Camera → Allow.
              </p>
            )}
          </div>
        )}

        <AnimatePresence>
          {flash && (
            <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-white" />
          )}
        </AnimatePresence>
      </div>

      {/* bottom controls */}
      <div className="max-h-[55%] overflow-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {capError && <p className="mb-2 text-center text-sm text-red-300">{capError}</p>}

        {!shot && cam.state === 'active' && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void take()}
              aria-label="Take photo"
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-95"
            >
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>
            <p className="text-sm text-white/70">Tap the white button to take a picture</p>
            {keptCount > 0 && (
              <button type="button" onClick={onClose} className="btn-gold btn-sm mt-1">
                <CheckCircle2 className="h-5 w-5" aria-hidden /> I’m done — review my {keptCount} {keptCount === 1 ? 'photo' : 'photos'}
              </button>
            )}
          </div>
        )}

        {shot && (
          <div className="mx-auto flex max-w-md flex-col gap-3">
            <div>
              <label htmlFor="cam-caption" className="mb-1 block text-sm font-bold">
                Add a caption (optional)
              </label>
              <input
                id="cam-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={MAX_CAPTION}
                placeholder="Write something sweet…"
                className="input !text-lavender-900"
              />
            </div>
            <div>
              <label htmlFor="cam-category" className="mb-1 block text-sm font-bold">
                What is this moment?
              </label>
              <select
                id="cam-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryId)}
                className="input !text-lavender-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={retake} className="btn-outline !text-lavender-900">
                <RotateCcw className="h-5 w-5" aria-hidden /> Retake
              </button>
              <button type="button" onClick={accept} className="btn-gold">
                <CheckCircle2 className="h-5 w-5" aria-hidden /> Use this photo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* hidden inputs for the fallback paths */}
      <input ref={captureInput} type="file" accept={ACCEPT_ATTR} capture="environment" className="sr-only" tabIndex={-1} onChange={handleInput} />
      <input ref={galleryInput} type="file" accept={ACCEPT_ATTR} multiple className="sr-only" tabIndex={-1} onChange={handleInput} />
    </div>
  );
}
