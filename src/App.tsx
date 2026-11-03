import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ConfigMissing from './components/ConfigMissing';
import Gallery from './pages/Gallery';
import GuestUpload from './pages/GuestUpload';
import Home from './pages/Home';
import { DEFAULT_SLUG } from './lib/site';
import { isSupabaseConfigured } from './services/supabase';

// The administration area is only downloaded by the couple, never by guests.
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center text-lavender-600">
      <Loader2 className="h-10 w-10 animate-spin" aria-label="Loading" />
    </div>
  );
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-script text-6xl text-lavender-800">Oh no…</h1>
      <p className="mt-4 text-lg">We could not find this page. Please scan the QR code again or check the link.</p>
      <Link to={`/wedding/${DEFAULT_SLUG}`} className="btn-primary mt-6">
        Go to the photo booth
      </Link>
    </main>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissing />;

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Navigate to={`/wedding/${DEFAULT_SLUG}`} replace />} />
        <Route path="/wedding/:slug" element={<Home />} />
        <Route path="/wedding/:slug/upload" element={<GuestUpload />} />
        <Route path="/gallery/:token" element={<Gallery />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
