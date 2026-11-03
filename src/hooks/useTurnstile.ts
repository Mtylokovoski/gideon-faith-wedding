import { useCallback, useEffect, useRef, useState } from 'react';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load the security check.'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Optional Cloudflare Turnstile CAPTCHA (invisible unless Cloudflare needs interaction).
 * When VITE_TURNSTILE_SITE_KEY is empty this hook is inert and getToken() resolves to undefined.
 * Attach `containerRef` to an empty <div> somewhere on the page.
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const pending = useRef<{ resolve: (t: string) => void; reject: (e: Error) => void } | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current || widgetId.current) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          execution: 'execute',
          appearance: 'interaction-only',
          callback: (token: string) => pending.current?.resolve(token),
          'error-callback': () => pending.current?.reject(new Error('The security check failed. Please try again.')),
          'expired-callback': () => undefined,
        });
        setReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  const runOnce = useCallback(async (): Promise<string> => {
    for (let i = 0; i < 100 && !widgetId.current; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!widgetId.current || !window.turnstile) throw new Error('The security check is not available. Please reload the page.');
    const id = widgetId.current;
    return new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('The security check timed out. Please try again.')), 60_000);
      pending.current = {
        resolve: (t) => {
          window.clearTimeout(timer);
          resolve(t);
        },
        reject: (e) => {
          window.clearTimeout(timer);
          reject(e);
        },
      };
      window.turnstile!.reset(id);
      window.turnstile!.execute(id);
    });
  }, []);

  /** A fresh single-use token. Calls are serialised because one widget can only run one check at a time. */
  const getToken = useCallback((): Promise<string | undefined> => {
    if (!SITE_KEY) return Promise.resolve(undefined);
    const next = chain.current.then(runOnce, runOnce);
    chain.current = next.catch(() => undefined);
    return next;
  }, [runOnce]);

  return { enabled: Boolean(SITE_KEY), ready, containerRef, getToken };
}
