import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { GalleryPhoto } from '../types';

function useColumnCount(): number {
  const calc = () => (window.innerWidth >= 1280 ? 4 : window.innerWidth >= 768 ? 3 : 2);
  const [n, setN] = useState(calc);
  useEffect(() => {
    const onResize = () => setN(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return n;
}

interface Props {
  photos: GalleryPhoto[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onOpen: (index: number) => void;
}

/**
 * Masonry layout. Photos are dealt round-robin into columns so the NEWEST photos
 * sit across the top row, and new arrivals appear top-left.
 */
export default function PhotoGallery({ photos, hasMore, loadingMore, onLoadMore, onOpen }: Props) {
  const cols = useColumnCount();
  const sentinel = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => {
    const out: { photo: GalleryPhoto; index: number }[][] = Array.from({ length: cols }, () => []);
    photos.forEach((photo, index) => out[index % cols]!.push({ photo, index }));
    return out;
  }, [photos, cols]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onLoadMore, photos.length]);

  return (
    <div>
      <div className="flex items-start gap-3">
        {columns.map((col, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-3">
            {col.map(({ photo, index }) => (
              <motion.button
                key={photo.id}
                type="button"
                onClick={() => onOpen(index)}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                whileHover={{ y: -2 }}
                className="group relative block w-full overflow-hidden rounded-2xl bg-lavender-100 shadow-md shadow-lavender-900/10"
                style={{ aspectRatio: photo.width && photo.height ? `${photo.width} / ${photo.height}` : '4 / 3' }}
                aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
              >
                <img
                  src={photo.thumb_url}
                  alt={photo.caption ?? 'Wedding photo'}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                {photo.caption && (
                  <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-left text-sm text-white">
                    {photo.caption}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        ))}
      </div>

      <div ref={sentinel} className="flex h-16 items-center justify-center text-lavender-600">
        {loadingMore && <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading more photos" />}
      </div>
    </div>
  );
}
