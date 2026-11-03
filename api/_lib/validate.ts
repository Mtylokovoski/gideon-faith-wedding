// Pure validation helpers (unit-tested in tests/).

export const CATEGORY_IDS = [
  'preparations',
  'bride',
  'groom',
  'ceremony',
  'family',
  'friends',
  'reception',
  'dancing',
  'behind_the_scenes',
  'other',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const MAX_FULL_BYTES = 12 * 1024 * 1024; // compressed full-size image
export const MAX_THUMB_BYTES = 2 * 1024 * 1024; // compressed thumbnail
export const MAX_CAPTION = 200;
export const MAX_GUEST_NAME = 60;

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const TOKEN_RE = /^[a-f0-9]{64}$/;

export interface UploadInit {
  slug: string;
  size: number;
  thumbSize: number;
  width: number;
  height: number;
  caption: string | null;
  category: CategoryId;
  guestName: string | null;
  captchaToken?: string;
}

/** Trim, collapse whitespace, strip control characters, cap the length. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return cleaned.length > 0 ? cleaned : null;
}

function intInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

export function isCategory(v: unknown): v is CategoryId {
  return typeof v === 'string' && (CATEGORY_IDS as readonly string[]).includes(v);
}

export function parseUploadInit(
  body: unknown,
): { ok: true; value: UploadInit } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  const b = body as Record<string, unknown>;

  if (typeof b.slug !== 'string' || b.slug.length > 60 || !SLUG_RE.test(b.slug)) {
    return { ok: false, error: 'Unknown wedding.' };
  }
  if (b.contentType !== 'image/jpeg') {
    return { ok: false, error: 'Only JPEG data is accepted by the server (photos are converted in your browser).' };
  }
  if (!intInRange(b.size, 1, MAX_FULL_BYTES)) {
    return { ok: false, error: 'That photo is too large after compression. Please try a smaller one.' };
  }
  if (!intInRange(b.thumbSize, 1, MAX_THUMB_BYTES)) {
    return { ok: false, error: 'Invalid thumbnail size.' };
  }
  if (!intInRange(b.width, 1, 20000) || !intInRange(b.height, 1, 20000)) {
    return { ok: false, error: 'Invalid image dimensions.' };
  }

  let category: CategoryId = 'other';
  if (b.category !== undefined && b.category !== null && b.category !== '') {
    if (!isCategory(b.category)) return { ok: false, error: 'Unknown category.' };
    category = b.category;
  }

  const captchaToken =
    typeof b.captchaToken === 'string' && b.captchaToken.length > 0 && b.captchaToken.length <= 4096
      ? b.captchaToken
      : undefined;

  return {
    ok: true,
    value: {
      slug: b.slug,
      size: b.size,
      thumbSize: b.thumbSize,
      width: b.width,
      height: b.height,
      caption: cleanText(b.caption, MAX_CAPTION),
      category,
      guestName: cleanText(b.guestName, MAX_GUEST_NAME),
      captchaToken,
    },
  };
}

/** JPEG files start with FF D8 FF. Used to verify what was REALLY uploaded. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Accepts only ISO-like timestamps for pagination cursors. */
export function parseCursor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  if (v.length > 40) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(v)) return undefined;
  return Number.isNaN(Date.parse(v)) ? undefined : v;
}
