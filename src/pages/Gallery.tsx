import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Camera, Images, Loader2, Play, RefreshCw, ShieldAlert } from 'lucide-react';
import { FloatingHearts, WeddingBackdrop } from '../components/Decor';
import PhotoGallery from '../components/PhotoGallery';
import PhotoViewer from '../components/PhotoViewer';
import WeddingHeader from '../components/WeddingHeader';
import { useGallery } from '../hooks/useGallery';
import { CATEGORIES } from '../lib/constants';
import { couple, cx } from '../lib/format';
import type { CategoryId } from '../types';

export default function Gallery() {
  const { token = '' } = useParams();
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const g = useGallery(token, category);
  const [viewer, setViewer] = useState<{ index: number; slideshow: boolean } | null>(null);

  const names = g.wedding ? couple(g.wedding) : 'Gideon & Faith';

  return (
    <div className="relative min-h-[100dvh] pb-10">
      <WeddingBackdrop />
      <FloatingHearts count={5} />
      <WeddingHeader names={names} subtitle="Wedding gallery" />

      <main className="relative z-10 mx-auto max-w-6xl px-3 sm:px-6">
        <p className="mx-auto mt-2 max-w-xl text-center font-serif text-xl italic text-lavender-800">
          Every picture tells a story. Every moment becomes a memory.
        </p>

        <div className="mx-auto mt-3 flex max-w-xl items-start justify-center gap-2 rounded-2xl bg-white/70 px-4 py-2 text-center text-xs text-lavender-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-champagne-600" aria-hidden />
          <span>Anyone who has this page’s link can see these photos. Please only share the link with people you trust.</span>
        </div>

        {g.error && !g.photos.length ? (
          <div className="card mx-auto mt-8 max-w-md p-6 text-center">
            <p>{g.error}</p>
            <button type="button" onClick={() => void g.reload()} className="btn-primary mt-4">
              <RefreshCw className="h-5 w-5" aria-hidden /> Try again
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-lavender-800">
                {g.total.toLocaleString()} {g.total === 1 ? 'photo' : 'photos'}
                <span className="ml-3 inline-flex items-center gap-1 font-normal text-lavender-600" title={g.live ? 'Updating live' : 'Reconnecting…'}>
                  <span className={cx('h-2 w-2 rounded-full', g.live ? 'bg-green-500' : 'bg-amber-400')} aria-hidden />
                  {g.live ? 'Live' : 'Connecting…'}
                </span>
              </p>
              <div className="flex gap-2">
                {g.wedding?.upload_enabled && g.wedding.wedding_slug && (
                  <Link to={`/wedding/${g.wedding.wedding_slug}/upload`} className="btn-outline btn-sm">
                    <Camera className="h-4 w-4" aria-hidden /> Add photos
                  </Link>
                )}
                <button
                  type="button"
                  disabled={g.photos.length === 0}
                  onClick={() => setViewer({ index: 0, slideshow: true })}
                  className="btn-primary btn-sm"
                >
                  <Play className="h-4 w-4" aria-hidden /> Slideshow
                </button>
              </div>
            </div>

            <div className="-mx-3 mt-4 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Photo categories">
              {[{ id: 'all' as const, label: 'All photos' }, ...CATEGORIES].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={cx(
                    'min-h-[40px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-bold transition',
                    category === c.id
                      ? 'border-lavender-600 bg-lavender-600 text-white'
                      : 'border-champagne-400 bg-white/80 text-lavender-800 hover:bg-white',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {g.loading ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label="Loading photos">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="skeleton rounded-2xl" style={{ aspectRatio: i % 3 === 0 ? '3 / 4' : '4 / 3' }} />
                  ))}
                </div>
              ) : g.photos.length === 0 ? (
                <div className="card mx-auto mt-6 max-w-md p-8 text-center">
                  <Images className="mx-auto h-12 w-12 text-lavender-400" aria-hidden />
                  <h2 className="mt-3 text-2xl font-bold">No photos here yet</h2>
                  <p className="mt-2 text-lavender-800">New pictures will appear on this page by themselves — no need to refresh.</p>
                </div>
              ) : (
                <PhotoGallery
                  photos={g.photos}
                  hasMore={g.hasMore}
                  loadingMore={g.loadingMore}
                  onLoadMore={() => void g.loadMore()}
                  onOpen={(index) => setViewer({ index, slideshow: false })}
                />
              )}
            </div>
          </>
        )}

        {g.loading && (
          <div className="sr-only" role="status">
            <Loader2 className="animate-spin" /> Loading
          </div>
        )}
      </main>

      {viewer && g.photos.length > 0 && (
        <PhotoViewer
          photos={g.photos}
          index={Math.min(viewer.index, g.photos.length - 1)}
          onIndexChange={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewer(null)}
          onNeedMore={() => void g.loadMore()}
          startSlideshow={viewer.slideshow}
        />
      )}
    </div>
  );
}
