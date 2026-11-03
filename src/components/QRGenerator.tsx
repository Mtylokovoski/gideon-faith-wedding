import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, ExternalLink, FileImage, Loader2, Printer } from 'lucide-react';
import { CardsSheet, SignSheet, TableCard } from './PrintSheets';
import { couple } from '../lib/format';
import { dataUrlToBlob, qrPng, qrSvg, renderQrCard, saveBlob } from '../lib/qr';
import { guestUrl } from '../lib/siteUrl';
import type { Wedding } from '../types';

interface Props {
  wedding: Wedding;
  /** Verified production origin, or null while the website address is missing or invalid. */
  origin: string | null;
  notify: (kind: 'ok' | 'err', text: string) => void;
}

/** Scaled-down live preview of a print page. */
function Preview({ widthMm, heightMm, scale, children }: { widthMm: number; heightMm: number; scale: number; children: React.ReactNode }) {
  const px = (mm: number) => (mm * 96) / 25.4;
  return (
    <div
      className="overflow-hidden rounded-xl border border-champagne-300 bg-white shadow"
      style={{ width: px(widthMm) * scale, height: px(heightMm) * scale }}
    >
      <div style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

function getPrintRoot(): HTMLElement {
  let el = document.getElementById('print-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'print-root';
    document.body.appendChild(el);
  }
  return el;
}

export default function QRGenerator({ wedding, origin, notify }: Props) {
  const names = couple(wedding);
  const url = origin ? guestUrl(origin, wedding.wedding_slug) : null;

  const [preview, setPreview] = useState<string | null>(null);
  const [printQr, setPrintQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [job, setJob] = useState<{ kind: 'sign' | 'cards'; n: number } | null>(null);
  const printRoot = useMemo(() => (typeof document === 'undefined' ? null : getPrintRoot()), []);

  // Build the code only when there is a verified production address — never for localhost.
  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setPrintQr(null);
    if (!url) return;
    void Promise.all([qrPng(url, 640), qrPng(url, 1400)]).then(([small, big]) => {
      if (cancelled) return;
      setPreview(small);
      setPrintQr(big);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Open the browser's print dialog after the print sheet has rendered.
  useEffect(() => {
    if (!job) return;
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [job]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      notify('err', e instanceof Error ? e.message : 'Could not create the file.');
    } finally {
      setBusy(null);
    }
  }

  const slug = wedding.wedding_slug;

  if (!url) {
    return (
      <div className="card p-6 text-lavender-800">
        <h3 className="text-2xl font-bold">QR code</h3>
        <p className="mt-2">
          The QR code is created only after your live website address is entered above. This makes sure it never points to a
          test address that guests cannot open.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <h3 className="text-2xl font-bold">Guest QR code</h3>
      <p className="mt-1 text-sm text-lavender-700">Scanning it with an ordinary phone camera opens the photo booth directly.</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-lavender-50 px-4 py-3">
        <code className="min-w-0 basis-full break-all text-sm sm:flex-1 sm:basis-0">{url}</code>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
          <ExternalLink className="h-4 w-4" aria-hidden /> Open
        </a>
      </div>

      <div className="mt-5 flex flex-col items-center gap-5 md:flex-row md:items-start">
        <div className="rounded-3xl border-2 border-champagne-400 bg-white p-3 shadow">
          {preview ? (
            <img src={preview} alt={`QR code for ${url}`} className="h-64 w-64" />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-lavender-500" aria-label="Creating QR code" />
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-3 md:max-w-xs">
          <button
            type="button"
            disabled={!!busy}
            className="btn-primary btn-sm"
            onClick={() =>
              void run('png', async () => saveBlob(await dataUrlToBlob(await qrPng(url, 3000)), `${slug}-qr-code.png`))
            }
          >
            {busy === 'png' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            Download PNG (high resolution)
          </button>
          <button
            type="button"
            disabled={!!busy}
            className="btn-outline btn-sm"
            onClick={() =>
              void run('svg', async () => saveBlob(new Blob([await qrSvg(url)], { type: 'image/svg+xml' }), `${slug}-qr-code.svg`))
            }
          >
            <Download className="h-4 w-4" aria-hidden /> Download SVG (for printers)
          </button>
          <button
            type="button"
            disabled={!!busy || !printQr}
            className="btn-outline btn-sm"
            onClick={() =>
              void run('card', async () => saveBlob(await renderQrCard(names, await qrPng(url, 1400)), `${slug}-qr-card.png`))
            }
          >
            {busy === 'card' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileImage className="h-4 w-4" aria-hidden />}
            Download designed QR card (PNG)
          </button>
        </div>
      </div>

      {printQr && (
        <>
          <hr className="my-6 border-champagne-300/60" />
          <h3 className="text-2xl font-bold">Printable sign and table cards</h3>
          <p className="mt-1 text-sm text-lavender-700">
            Choose Print, then pick “Save as PDF” to keep a copy, or send it straight to a printer. Use A4 paper and turn
            “Background graphics” on if your browser offers it.
          </p>

          <div className="mt-5 grid gap-8 md:grid-cols-2">
            <div className="flex flex-col items-center gap-3">
              <Preview widthMm={210} heightMm={297} scale={0.34}>
                <SignSheet names={names.toUpperCase()} qr={printQr} />
              </Preview>
              <button type="button" className="btn-primary btn-sm" onClick={() => setJob({ kind: 'sign', n: Date.now() })}>
                <Printer className="h-4 w-4" aria-hidden /> Print A4 wedding sign
              </button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Preview widthMm={105} heightMm={148.5} scale={0.68}>
                <TableCard names={names.toUpperCase()} qr={printQr} />
              </Preview>
              <button type="button" className="btn-primary btn-sm" onClick={() => setJob({ kind: 'cards', n: Date.now() })}>
                <Printer className="h-4 w-4" aria-hidden /> Print table cards (4 per page)
              </button>
            </div>
          </div>

          {printRoot &&
            job &&
            createPortal(
              job.kind === 'sign' ? (
                <SignSheet names={names.toUpperCase()} qr={printQr} />
              ) : (
                <CardsSheet names={names.toUpperCase()} qr={printQr} />
              ),
              printRoot,
            )}
        </>
      )}
    </div>
  );
}
