// Pure URL helpers (no browser/env access) so they can be unit-tested.

export interface UrlCheck {
  ok: boolean;
  reason?: string;
  origin?: string;
}

const PRIVATE_HOST =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1?\]?)$/i;

/**
 * A QR code must only ever point at the real, public, HTTPS website.
 * This rejects localhost, private-network addresses and plain http.
 */
export function checkProductionUrl(input: string): UrlCheck {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: 'Enter the address of your live website.' };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: 'That does not look like a web address.' };
  }

  if (PRIVATE_HOST.test(url.hostname)) {
    return {
      ok: false,
      reason:
        'This address points to your own computer or a private network. Guests could not open it. Use your live website address.',
    };
  }
  if (url.protocol !== 'https:') {
    return {
      ok: false,
      reason: 'The address must start with https:// — phone cameras only work on secure websites.',
    };
  }
  if (!url.hostname.includes('.')) {
    return { ok: false, reason: 'That does not look like a complete website address.' };
  }
  return { ok: true, origin: url.origin };
}

export const guestUrl = (origin: string, slug: string): string =>
  `${origin.replace(/\/+$/, '')}/wedding/${slug}`;

export const galleryUrl = (origin: string, token: string): string =>
  `${origin.replace(/\/+$/, '')}/gallery/${token}`;
