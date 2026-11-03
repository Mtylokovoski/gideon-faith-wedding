import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, Link2, RefreshCw } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import QRGenerator from './QRGenerator';
import { errorMessage } from '../lib/format';
import { configuredSiteUrl } from '../lib/site';
import { checkProductionUrl, galleryUrl } from '../lib/siteUrl';
import { regenerateGalleryToken } from '../services/adminService';
import type { Wedding } from '../types';

interface Props {
  wedding: Wedding;
  onWeddingChange: (w: Wedding) => void;
  notify: (kind: 'ok' | 'err', text: string) => void;
}

export default function SharingTab({ wedding, onWeddingChange, notify }: Props) {
  const [input, setInput] = useState(configuredSiteUrl());
  const check = useMemo(() => checkProductionUrl(input), [input]);
  const origin = check.ok ? check.origin ?? null : null;

  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = origin ? galleryUrl(origin, wedding.gallery_token) : null;

  async function regenerate() {
    setBusy(true);
    try {
      const token = await regenerateGalleryToken(wedding.id);
      onWeddingChange({ ...wedding, gallery_token: token });
      notify('ok', 'A new gallery link has been created. The old link no longer works.');
      setConfirm(false);
    } catch (e) {
      notify('err', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-2xl font-bold">
          <Link2 className="h-6 w-6 text-champagne-600" aria-hidden /> Your live website address
        </h3>
        <p className="mt-1 text-sm text-lavender-700">
          This is the address guests will open after scanning. It is the website you deployed on Vercel (or your own domain).
        </p>
        <label htmlFor="site-url" className="label mt-4">
          Website address
        </label>
        <input
          id="site-url"
          className="input"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://your-website.vercel.app"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {!check.ok && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {check.reason}
          </p>
        )}
        {check.ok && (
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-green-700">
            <Check className="h-4 w-4" aria-hidden /> Address looks good.
          </p>
        )}
      </div>

      <QRGenerator wedding={wedding} origin={origin} notify={notify} />

      <div className="card p-5 sm:p-6">
        <h3 className="text-2xl font-bold">Private gallery link</h3>
        <p className="mt-1 text-sm text-lavender-700">
          This link opens the gallery of approved photographs. It stays the same forever, even after uploads are switched off.
        </p>
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-lavender-50 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-champagne-600" aria-hidden />
          <span>Anyone who has this link can see the shared photographs. Only send it to people you trust.</span>
        </p>

        {link ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-champagne-300 bg-white px-4 py-3">
            <code className="min-w-0 basis-full break-all text-sm sm:flex-1 sm:basis-0">{link}</code>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a href={link} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
              <ExternalLink className="h-4 w-4" aria-hidden /> Open
            </a>
          </div>
        ) : (
          <p className="mt-3 text-sm text-lavender-700">Enter your live website address above to see the full link.</p>
        )}

        <button type="button" className="btn-outline btn-sm mt-4" onClick={() => setConfirm(true)}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Create a new gallery link
        </button>
        <p className="mt-2 text-xs text-lavender-600">
          Only needed if the link was shared with someone by mistake. The old link stops working immediately. The guest QR code
          is not affected.
        </p>
      </div>

      {confirm && (
        <ConfirmDialog
          title="Create a new gallery link?"
          body="The current gallery link will stop working straight away. Anyone you already sent it to will need the new one."
          confirmLabel={busy ? 'Working…' : 'Create new link'}
          busy={busy}
          onConfirm={() => void regenerate()}
          onCancel={() => !busy && setConfirm(false)}
        />
      )}
    </div>
  );
}
