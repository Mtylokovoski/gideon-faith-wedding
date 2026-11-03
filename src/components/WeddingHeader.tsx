import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  names: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
}

export default function WeddingHeader({ names, subtitle, backTo, backLabel = 'Back' }: Props) {
  return (
    <header className="relative z-10 px-4 pb-2 pt-5 text-center">
      {backTo && (
        <Link
          to={backTo}
          className="absolute left-3 top-4 inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-bold text-lavender-700 hover:bg-lavender-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> {backLabel}
        </Link>
      )}
      <h1 className="font-script text-5xl leading-tight text-lavender-800 sm:text-6xl">{names}</h1>
      {subtitle && <p className="mt-1 font-serif text-xl italic text-champagne-700">{subtitle}</p>}
      <div className="mx-auto mt-3 flex w-40 items-center gap-2" aria-hidden>
        <span className="h-px flex-1 bg-champagne-400" />
        <span className="text-champagne-500">♥</span>
        <span className="h-px flex-1 bg-champagne-400" />
      </div>
    </header>
  );
}
