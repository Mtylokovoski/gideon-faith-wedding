import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Camera, Images, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PublicWedding } from '../types';
import { couple, formatWeddingDate } from '../lib/format';

function AnimatedCount({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: 'easeOut' });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span>{rounded}</motion.span>;
}

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: 'easeOut' as const },
});

interface Props {
  slug: string;
  wedding: PublicWedding | null;
}

export default function Hero({ slug, wedding }: Props) {
  const names = wedding ? couple(wedding) : 'Gideon & Faith';
  const open = wedding ? wedding.upload_enabled : true;
  const date = wedding ? formatWeddingDate(wedding.wedding_date) : '';

  return (
    <section className="relative z-10 mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-5 py-10 text-center">
      <motion.p {...fade(0.1)} className="font-serif text-lg uppercase tracking-[0.3em] text-champagne-700">
        {date ? date : 'Together forever'}
      </motion.p>

      <motion.h1 {...fade(0.25)} className="mt-3 font-script text-7xl leading-none text-lavender-800 sm:text-8xl">
        {names}
      </motion.h1>

      <motion.div {...fade(0.4)} className="mt-5 flex w-48 items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-champagne-400" />
        <span className="text-champagne-500">♥</span>
        <span className="h-px flex-1 bg-champagne-400" />
      </motion.div>

      <motion.h2 {...fade(0.55)} className="mt-6 font-serif text-3xl font-semibold text-lavender-900 sm:text-4xl">
        Our Wedding, Through Your Eyes ❤️
      </motion.h2>

      <motion.p {...fade(0.7)} className="mt-4 max-w-md text-lg text-lavender-800/90">
        Be part of our memories. Capture a moment, share your photographs and help us remember this beautiful day.
      </motion.p>

      <motion.div {...fade(0.85)} className="mt-9 flex w-full max-w-sm flex-col gap-4">
        {open ? (
          <>
            <Link to={`/wedding/${slug}/upload?mode=camera`} className="btn-primary min-h-[64px] text-lg">
              <Camera className="h-6 w-6" aria-hidden /> TAKE A PHOTO 📸
            </Link>
            <Link to={`/wedding/${slug}/upload?mode=files`} className="btn-gold min-h-[64px] text-lg">
              <Upload className="h-6 w-6" aria-hidden /> UPLOAD PHOTOS
            </Link>
          </>
        ) : (
          <div className="card px-5 py-4 text-base text-lavender-800">
            Photo sharing has now closed — thank you to everyone who shared a memory! 💜
          </div>
        )}

        {wedding?.gallery_token ? (
          <Link to={`/gallery/${wedding.gallery_token}`} className="btn-outline min-h-[60px] text-base">
            <Images className="h-5 w-5" aria-hidden /> VIEW WEDDING GALLERY
          </Link>
        ) : wedding ? (
          <p className="text-sm text-lavender-700">
            The photo gallery link will be shared by {wedding.groom_name} &amp; {wedding.bride_name}.
          </p>
        ) : null}
      </motion.div>

      {wedding && (
        <motion.p {...fade(1)} className="mt-8 font-serif text-xl text-lavender-800">
          <span className="font-bold text-champagne-700">
            <AnimatedCount value={wedding.photo_count} />
          </span>{' '}
          {wedding.photo_count === 1 ? 'photo shared so far' : 'photos shared so far'}
        </motion.p>
      )}
    </section>
  );
}
