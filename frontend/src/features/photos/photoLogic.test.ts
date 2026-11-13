import { describe, expect, it } from 'vitest';
import { aspectRatio, checkPicked, formatBytes, refreshDelay } from './photoLogic';

const limits = { max_file_bytes: 5 * 1024 * 1024, max_files_per_upload: 10, remaining: 200 };
const f = (name: string, type = 'image/jpeg', size = 1000) => ({ name, type, size });

describe('checkPicked', () => {
  it('accepts JPEG/PNG/WebP and explains rejected files', () => {
    const { accepted, problems } = checkPicked([f('a.jpg'), f('b.gif', 'image/gif'), f('c.png', 'image/png', 6 * 1024 * 1024), f('d.webp', 'image/webp')], 0, limits);
    expect(accepted).toEqual([0, 3]);
    expect(problems).toEqual(['"b.gif" is not a JPEG, PNG or WebP image.', '"c.png" is larger than 5 MB.']);
  });
  it('respects the per-upload limit including already selected files', () => {
    const { accepted, problems } = checkPicked([f('a.jpg'), f('b.jpg'), f('c.jpg')], 8, limits);
    expect(accepted).toEqual([0, 1]);
    expect(problems[0]).toMatch(/upload at most 10 at a time/);
  });
  it('respects the group limit', () => {
    const { accepted, problems } = checkPicked([f('a.jpg'), f('b.jpg')], 0, { ...limits, remaining: 1 });
    expect(accepted).toEqual([0]);
    expect(problems[0]).toMatch(/upload at most|limit/);
  });
});

describe('helpers', () => {
  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
  it('refreshDelay: a minute before expiry, never negative, null without photos', () => {
    const now = Date.parse('2026-11-13T10:00:00Z');
    expect(refreshDelay('2026-11-13T11:00:00Z', now)).toBe(59 * 60_000);
    expect(refreshDelay('2026-11-13T10:00:30Z', now)).toBe(0);
    expect(refreshDelay(undefined, now)).toBeNull();
  });
  it('aspectRatio falls back to 4/3', () => {
    expect(aspectRatio(640, 480)).toBe('640 / 480');
    expect(aspectRatio(null, 480)).toBe('4 / 3');
  });
});
