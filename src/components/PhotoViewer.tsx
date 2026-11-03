import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Maximize, Minimize, Pause, Play, X } from 'lucide-react';
import type { ViewerPhoto } from '../types';
import { CATEGORY_LABEL } from '../lib/constants';
import { formatDateTime } from '../lib/format';
import { downloadPhoto } from '../services/photoService';

interface Props {
  photos: ViewerPhoto[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** Called when the viewer is near the end, so more photos can be loaded. */
  onNeedMore?: () => void;
  startSlideshow?: boolean;
  slideshowSeconds?: number;
}

export default function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  onNeedMore,
  startSlideshow = false,
  slideshowSeconds = 5,
}: Props) {
  const [playing, setPlaying] = useState(startSlideshow);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dir, setDir] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const photo = photos[index];

  const go = useCallback(
    (delta: number) => {
      if (photos.length === 0) return;
      setDir(delta);
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, onIndexChange, photos.length],
  );

  // Keyboard: arrows, space (slideshow), escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Lock page scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Slideshow timer.
  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const t = window.setInterval(() => go(1), slideshowSeconds * 1000);
    return () => window.clearInterval(t);
  }, [playing, go, photos.length, slideshowSeconds]);

  // Preload neighbours and ask for more when close to the end.
  useEffect(() => {
    [photos[index + 1], photos[index - 1]].forEach((p) => {
      if (p) new Image().src = p.url;
    });
    if (onNeedMore && index >= photos.length - 4) onNeedMore();
  }, [index, photos, onNeedMore]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      /* not supported (e.g. iPhone Safari) — ignore */
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80) go(1);
    else if (info.offset.x > 80) go(-1);
  };

  const save = async () => {
    if (!photo) return;
    setDownloading(true);
    try {
      await downloadPhoto(photo.url, `wedding-photo-${photo.id.slice(0, 8)}.jpg`);
    } catch {
      window.open(photo.url, '_blank', 'noopener');
    } finally {
      setDownloading(false);
    }
  };

  if (!photo) return null;

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
    >
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause slideshow' : 'Start slideshow'}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-bold hover:bg-white/25"
          >
            {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
            <span className="hidden sm:inline">{playing ? 'Pause' : 'Slideshow'}</span>
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            className="hidden h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 sm:inline-flex"
          >
            {fullscreen ? <Minimize className="h-5 w-5" aria-hidden /> : <Maximize className="h-5 w-5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={downloading}
            aria-label="Download this photo"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-50"
          >
            <Download className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.img
            key={photo.id}
            src={photo.url}
            alt={photo.caption ?? 'Wedding photo'}
            custom={dir}
            initial={{ opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -60 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={onDragEnd}
            className="max-h-full max-w-full select-none object-contain"
            draggable={false}
          />
        </AnimatePresence>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 sm:inline-flex"
            >
              <ChevronLeft className="h-7 w-7" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 sm:inline-flex"
            >
              <ChevronRight className="h-7 w-7" aria-hidden />
            </button>
          </>
        )}
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center">
        {photo.caption && <p className="font-serif text-xl">{photo.caption}</p>}
        <p className="mt-1 text-sm text-white/70">
          {CATEGORY_LABEL[photo.category]} · {formatDateTime(photo.uploaded_at)}
        </p>
        {photos.length > 1 && <p className="mt-1 text-xs text-white/40 sm:hidden">Swipe left or right for more</p>}
      </div>
    </div>
  );
}
