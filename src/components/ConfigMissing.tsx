import { AlertTriangle } from 'lucide-react';
import { missingFrontendEnv } from '../services/supabase';

/** Shown instead of the app when the website has not been connected to Supabase yet. */
export default function ConfigMissing() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-5 py-10">
      <div className="card w-full p-6">
        <div className="flex items-center gap-3 text-lavender-800">
          <AlertTriangle className="h-8 w-8 text-champagne-600" aria-hidden />
          <h1 className="text-3xl font-bold">Setup needed</h1>
        </div>
        <p className="mt-4">
          The photo booth is built, but it has not been connected to its database yet. These settings are missing:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-6 font-mono text-sm">
          {missingFrontendEnv.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          Add them in Vercel → Project → Settings → Environment Variables (or in a local <code>.env.local</code> file),
          then redeploy. Step-by-step instructions are in <strong>README.md</strong>, section “Environment variables”.
        </p>
      </div>
    </main>
  );
}
