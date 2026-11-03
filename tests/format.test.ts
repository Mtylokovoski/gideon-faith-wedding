import { describe, expect, it } from 'vitest';
import { couple, formatBytes } from '../src/lib/format';

describe('format helpers', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('puts the groom first', () => {
    expect(couple({ groom_name: 'Gideon', bride_name: 'Faith' })).toBe('Gideon & Faith');
  });
});
