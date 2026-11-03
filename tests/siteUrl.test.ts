import { describe, expect, it } from 'vitest';
import { checkProductionUrl, galleryUrl, guestUrl } from '../src/lib/siteUrl';

describe('checkProductionUrl (QR codes must never point at localhost)', () => {
  it.each([
    'http://localhost:5173',
    'localhost:3000',
    'https://localhost',
    'https://127.0.0.1',
    'https://192.168.1.20',
    'https://10.0.0.5',
    'https://172.16.4.4',
    'https://myphone.local',
    'https://[::1]',
  ])('rejects %s', (u) => {
    expect(checkProductionUrl(u).ok).toBe(false);
  });

  it('rejects plain http and empty input', () => {
    expect(checkProductionUrl('http://example.com').ok).toBe(false);
    expect(checkProductionUrl('').ok).toBe(false);
    expect(checkProductionUrl('   ').ok).toBe(false);
  });

  it('accepts a real https address and returns its origin', () => {
    const r = checkProductionUrl('https://gideon-and-faith.vercel.app/some/path');
    expect(r.ok).toBe(true);
    expect(r.origin).toBe('https://gideon-and-faith.vercel.app');
  });

  it('adds https:// when the guest omits it', () => {
    expect(checkProductionUrl('gideon-and-faith.vercel.app').origin).toBe('https://gideon-and-faith.vercel.app');
  });
});

describe('link builders', () => {
  it('builds the guest and gallery links without double slashes', () => {
    expect(guestUrl('https://x.com/', 'gideon-faith')).toBe('https://x.com/wedding/gideon-faith');
    expect(galleryUrl('https://x.com', 'abc')).toBe('https://x.com/gallery/abc');
  });
});
