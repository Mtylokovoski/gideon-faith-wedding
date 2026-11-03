import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { FloatingHearts, WeddingBackdrop } from '../components/Decor';
import Hero from '../components/Hero';
import { useWedding } from '../hooks/useWedding';

export default function Home() {
  const { slug = '' } = useParams();
  const { wedding, loading, notFound, error, reload } = useWedding(slug);

  return (
    <div className="relative">
      <WeddingBackdrop />
      <FloatingHearts />

      {loading ? (
        <div className="relative z-10 flex min-h-[100dvh] items-center justify-center text-lavender-600">
          <Loader2 className="h-10 w-10 animate-spin" aria-label="Loading" />
        </div>
      ) : notFound ? (
        <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
          <h1 className="font-script text-6xl text-lavender-800">Oh no…</h1>
          <p className="mt-4 text-lg">We could not find this wedding page. Please scan the QR code again or check the link.</p>
        </main>
      ) : error ? (
        <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
          <p className="text-lg">{error}</p>
          <button type="button" onClick={() => void reload()} className="btn-primary mt-5">
            Try again
          </button>
        </main>
      ) : (
        <>
          <Hero slug={slug} wedding={wedding} />
          <footer className="relative z-10 pb-8 text-center text-xs text-lavender-600">
            <p className="mx-auto max-w-xs">
              No app and no account needed. Your name is optional, and we do not collect anything else about you.
            </p>
            <Link to="/admin/login" className="mt-2 inline-block text-lavender-500 hover:underline">
              Couple login
            </Link>
          </footer>
        </>
      )}
    </div>
  );
}
