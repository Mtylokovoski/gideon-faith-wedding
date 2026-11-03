import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { WeddingBackdrop } from '../components/Decor';
import { errorMessage } from '../lib/format';
import { DEFAULT_SLUG } from '../lib/site';
import { supabase } from '../services/supabase';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/admin', { replace: true });
    });
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(/invalid|credentials/i.test(err.message) ? 'That email or password is not correct.' : errorMessage(err));
      return;
    }
    navigate('/admin', { replace: true });
  }

  return (
    <div className="relative">
      <WeddingBackdrop />
      <main className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-5 py-10">
        <h1 className="text-center font-script text-6xl text-lavender-800">Couple login</h1>
        <form onSubmit={submit} className="card mt-6 space-y-4 p-6" noValidate>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-14"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-lavender-600 hover:bg-lavender-100"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || !email || !password} className="btn-primary w-full">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LogIn className="h-5 w-5" aria-hidden />}
            Sign in
          </button>
        </form>
        <Link to={`/wedding/${DEFAULT_SLUG}`} className="mt-5 text-center text-sm text-lavender-600 hover:underline">
          Back to the photo booth
        </Link>
      </main>
    </div>
  );
}
