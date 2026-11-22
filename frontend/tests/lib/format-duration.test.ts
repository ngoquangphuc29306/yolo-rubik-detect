import { describe, expect, it } from 'vitest';
import { formatDuration } from '@/lib/utils';

// Pins current behaviour: formatDuration floors; Completion rounds playbackMs to whole seconds first.
describe('formatDuration', () => {
  it('formats zero', () => expect(formatDuration(0)).toBe('0:00'));
  it('59.5 s rounded first shows 1:00', () => expect(formatDuration(Math.round(59.5))).toBe('1:00'));
  it('floors a fractional value by itself', () => expect(formatDuration(59.5)).toBe('0:59'));
  it('3599.9 s rounded first shows 60:00 (no hours rollover)', () =>
    expect(formatDuration(Math.round(3599.9))).toBe('60:00'));
});
