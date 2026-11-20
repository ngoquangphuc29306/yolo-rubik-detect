import { describe, expect, it } from 'vitest';
import { easeInOutCubic, pivotRotation, selectShown } from '@/components/three/animation';
import { parseMove } from '@/engine/move-presentation';
import type { PlaybackFrame } from '@/hooks/usePlayback';

describe('easeInOutCubic', () => {
  it('hits the endpoints exactly', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('matches the legacy curve values', () => {
    expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625, 12);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOutCubic(0.75)).toBeCloseTo(0.9375, 12);
  });
  it('is symmetric about the midpoint', () => {
    for (let p = 0; p <= 1; p += 0.05) {
      expect(easeInOutCubic(p) + easeInOutCubic(1 - p)).toBeCloseTo(1, 12);
    }
  });
  it('is monotonic non-decreasing', () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('clamps out-of-range progress', () => {
    expect(easeInOutCubic(-0.5)).toBe(0);
    expect(easeInOutCubic(1.5)).toBe(1);
  });
});

describe('pivotRotation', () => {
  it.each([
    ['x', 1],
    ['x', -1],
    ['y', 1],
    ['y', -1],
    ['z', 1],
    ['z', -1],
  ] as const)('rotates only axis %s with sign %i', (axis, sign) => {
    const angle = sign * (Math.PI / 2);
    const r = pivotRotation({ axis, angle }, 1);
    expect(r[axis]).toBeCloseTo(angle, 12);
    for (const other of ['x', 'y', 'z'] as const) {
      if (other !== axis) expect(r[other]).toBe(0);
    }
    const r0 = pivotRotation({ axis, angle }, 0);
    expect(Math.abs(r0.x) + Math.abs(r0.y) + Math.abs(r0.z)).toBe(0);
  });
  it('R at 0.5 is -45 degrees about x', () => {
    const r = pivotRotation(parseMove('R'), 0.5);
    expect(r.x).toBeCloseTo(-Math.PI / 4, 12);
    expect(r.y).toBe(0);
    expect(r.z).toBe(0);
  });
  it("U' at 0.5 is +45 degrees about y", () => {
    const r = pivotRotation(parseMove("U'"), 0.5);
    expect(r.y).toBeCloseTo(Math.PI / 4, 12);
    expect(r.x).toBe(0);
  });
});

const moves = ['R', 'U', "F'", 'L2'].map((m) => parseMove(m as never));
const snaps = [[], [], [], [], []] as const; // S[0..4]
const frame = (f: Partial<PlaybackFrame>): PlaybackFrame => ({
  displayedIndex: 0,
  activeIndex: 0,
  progress: 0,
  status: 'idle',
  ...f,
});

describe('selectShown (playback-fsm renderer contract)', () => {
  it('idle: snapshot 0, no move', () => {
    expect(selectShown(frame({}), snaps, moves)).toEqual({ snapshotIndex: 0, activeMove: null, progress: 0 });
  });
  it('animating index 2: S[2], move 2, progress p', () => {
    const s = selectShown(frame({ status: 'animating', displayedIndex: 2, activeIndex: 2, progress: 0.4 }), snaps, moves);
    expect(s.snapshotIndex).toBe(2);
    expect(s.activeMove).toBe(moves[2]);
    expect(s.progress).toBe(0.4);
  });
  it('waiting after index 2: S[3], no move, progress 0', () => {
    const s = selectShown(frame({ status: 'waiting', displayedIndex: 3, activeIndex: 2 }), snaps, moves);
    expect(s).toEqual({ snapshotIndex: 3, activeMove: null, progress: 0 });
  });
  it('complete: S[total], no move', () => {
    const s = selectShown(frame({ status: 'complete', displayedIndex: 4, activeIndex: 3 }), snaps, moves);
    expect(s).toEqual({ snapshotIndex: 4, activeMove: null, progress: 0 });
  });
  it('paused mid-animation: frozen progress, move still shown', () => {
    const s = selectShown(frame({ status: 'paused', displayedIndex: 1, activeIndex: 1, progress: 0.37 }), snaps, moves);
    expect(s.snapshotIndex).toBe(1);
    expect(s.activeMove).toBe(moves[1]);
    expect(s.progress).toBe(0.37);
  });
  it('paused from waiting: next snapshot, no move', () => {
    const s = selectShown(frame({ status: 'paused', displayedIndex: 2, activeIndex: 1 }), snaps, moves);
    expect(s).toEqual({ snapshotIndex: 2, activeMove: null, progress: 0 });
  });
  it('empty move list: snapshot 0, no move', () => {
    const s = selectShown(frame({ status: 'complete' }), [[]], []);
    expect(s).toEqual({ snapshotIndex: 0, activeMove: null, progress: 0 });
  });
  it('clamps snapshot index to available snapshots', () => {
    expect(selectShown(frame({ status: 'complete', displayedIndex: 9, activeIndex: 8 }), snaps, moves).snapshotIndex).toBe(4);
  });
});
