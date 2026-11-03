import { describe, expect, it } from 'vitest';
import { cleanText, isJpeg, parseCursor, parseUploadInit } from '../api/_lib/validate';

const good = {
  slug: 'gideon-faith',
  contentType: 'image/jpeg',
  size: 500_000,
  thumbSize: 30_000,
  width: 1600,
  height: 1200,
  caption: '  Dancing\u0000  night  ',
  category: 'dancing',
  guestName: '',
};

describe('parseUploadInit', () => {
  it('accepts a valid request and cleans text', () => {
    const r = parseUploadInit(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.caption).toBe('Dancing night');
      expect(r.value.guestName).toBeNull();
      expect(r.value.category).toBe('dancing');
    }
  });
  it('defaults the category to "other"', () => {
    const r = parseUploadInit({ ...good, category: undefined });
    expect(r.ok && r.value.category).toBe('other');
  });
  it.each([
    [{ ...good, slug: '../etc' }],
    [{ ...good, contentType: 'image/png' }],
    [{ ...good, size: 0 }],
    [{ ...good, size: 50 * 1024 * 1024 }],
    [{ ...good, category: 'hacker' }],
    [{ ...good, width: 0 }],
    [null],
    ['x'],
  ])('rejects bad input %#', (body) => {
    expect(parseUploadInit(body).ok).toBe(false);
  });
});

describe('small helpers', () => {
  it('limits text length', () => {
    expect(cleanText('a'.repeat(500), 200)?.length).toBe(200);
    expect(cleanText(42, 10)).toBeNull();
  });
  it('recognises JPEG bytes only', () => {
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(isJpeg(new Uint8Array([]))).toBe(false);
  });
  it('accepts only ISO timestamps as cursors', () => {
    expect(parseCursor('2026-11-02T08:00:00.000Z')).toBeDefined();
    expect(parseCursor("2026-11-02'; drop table photos;--")).toBeUndefined();
    expect(parseCursor(undefined)).toBeUndefined();
  });
});
