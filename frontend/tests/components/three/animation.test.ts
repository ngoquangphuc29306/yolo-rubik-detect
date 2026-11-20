import { describe, expect, it } from 'vitest';
import { easeInOutCubic, pivotRotation, reconcile, selectShown } from '@/components/three/animation';
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
    expect(selectShown(frame({}), snaps, moves)).toEqual({
      snapshotIndex: 0,
      activeMove: null,
      progress: 0,
      highlightMove: null,
      highlightIndex: -1,
    });
  });
  it('animating index 2: S[2], move 2, progress p', () => {
    const s = selectShown(frame({ status: 'animating', displayedIndex: 2, activeIndex: 2, progress: 0.4 }), snaps, moves);
    expect(s.snapshotIndex).toBe(2);
    expect(s.activeMove).toBe(moves[2]);
    expect(s.progress).toBe(0.4);
  });
  it('waiting after index 2: S[3], no move, progress 0', () => {
    const s = selectShown(frame({ status: 'waiting', displayedIndex: 3, activeIndex: 2 }), snaps, moves);
    expect(s).toEqual({ snapshotIndex: 3, activeMove: null, progress: 0, highlightMove: moves[2], highlightIndex: 2 });
  });
  it('complete: S[total], no move', () => {
    const s = selectShown(frame({ status: 'complete', displayedIndex: 4, activeIndex: 3 }), snaps, moves);
    expect(s).toEqual({ snapshotIndex: 4, activeMove: null, progress: 0, highlightMove: null, highlightIndex: -1 });
  });
  it('paused mid-animation: frozen progress, move still shown', () => {
    const s = selectShown(frame({ status: 'paused', displayedIndex: 1, activeIndex: 1, progress: 0.37 }), snaps, moves);
    expect(s.snapshotIndex).toBe(1);
    expect(s.activeMove).toBe(moves[1]);
    expect(s.progress).toBe(0.37);
  });
  it('paused from waiting: next snapshot, no move', () => {
    const s = selectShown(frame({ status: 'paused', displayedIndex: 2, activeIndex: 1 }), snaps, moves);
    expect(s).toEqual({ snapshotIndex: 2, activeMove: null, progress: 0, highlightMove: moves[1], highlightIndex: 1 });
  });
  it('empty move list: snapshot 0, no move', () => {
    const s = selectShown(frame({ status: 'complete' }), [[]], []);
    expect(s).toEqual({ snapshotIndex: 0, activeMove: null, progress: 0, highlightMove: null, highlightIndex: -1 });
  });
  it('clamps snapshot index to available snapshots', () => {
    expect(selectShown(frame({ status: 'complete', displayedIndex: 9, activeIndex: 8 }), snaps, moves).snapshotIndex).toBe(4);
  });
});

describe('selectShown highlight (layer + arrow persist through wait and pause)', () => {
  it('animating: highlight is the turning move', () => {
    const s = selectShown(frame({ status: 'animating', displayedIndex: 1, activeIndex: 1, progress: 0.2 }), snaps, moves);
    expect(s.highlightMove).toBe(moves[1]);
    expect(s.highlightIndex).toBe(1);
  });
  it('waiting: highlight stays on the move just made while the pivot does not turn', () => {
    const s = selectShown(frame({ status: 'waiting', displayedIndex: 2, activeIndex: 1 }), snaps, moves);
    expect(s.activeMove).toBeNull();
    expect(s.highlightMove).toBe(moves[1]);
    expect(s.snapshotIndex).toBe(2);
  });
  it('paused (either origin): highlight kept', () => {
    expect(selectShown(frame({ status: 'paused', displayedIndex: 1, activeIndex: 1, progress: 0.5 }), snaps, moves).highlightIndex).toBe(1);
    expect(selectShown(frame({ status: 'paused', displayedIndex: 2, activeIndex: 1 }), snaps, moves).highlightIndex).toBe(1);
  });
  it('idle and complete: no highlight', () => {
    expect(selectShown(frame({ status: 'idle' }), snaps, moves).highlightMove).toBeNull();
    expect(selectShown(frame({ status: 'complete', displayedIndex: 4, activeIndex: 3 }), snaps, moves).highlightIndex).toBe(-1);
  });
});

describe('reconcile (committed view vs frame)', () => {
  const R = moves[0]!;
  const fullR = { x: R.angle, y: 0, z: 0 };

  it('matching view mid-turn: no commit, pivot at eased progress', () => {
    const r = reconcile(
      frame({ status: 'animating', displayedIndex: 0, activeIndex: 0, progress: 0.5 }),
      { snapshotIndex: 0, moveIndex: 0 },
      snaps,
      moves,
    );
    expect(r.commit).toBeNull();
    expect(r.rotation!.x).toBeCloseTo(R.angle * 0.5, 12);
  });
  it('animating -> waiting landing: commit S[1]+highlight, pivot jumps to the FULL angle (no pop)', () => {
    const r = reconcile(
      frame({ status: 'waiting', displayedIndex: 1, activeIndex: 0 }),
      { snapshotIndex: 0, moveIndex: 0 },
      snaps,
      moves,
    );
    expect(r.commit).toEqual({ snapshotIndex: 1, moveIndex: 0 });
    expect(r.rotation).toEqual(fullR);
  });
  it('dt-truncated stall that skipped the whole wait: still the committed move full angle', () => {
    const r = reconcile(
      frame({ status: 'animating', displayedIndex: 1, activeIndex: 1, progress: 0.1 }),
      { snapshotIndex: 0, moveIndex: 0 },
      snaps,
      moves,
    );
    expect(r.commit).toEqual({ snapshotIndex: 1, moveIndex: 1 });
    expect(r.rotation).toEqual(fullR);
  });
  it('waiting (matching): no commit, pivot identity', () => {
    const r = reconcile(
      frame({ status: 'waiting', displayedIndex: 1, activeIndex: 0 }),
      { snapshotIndex: 1, moveIndex: 0 },
      snaps,
      moves,
    );
    expect(r.commit).toBeNull();
    expect(r.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });
  it('waiting -> animating next: commit S[1] with move 1; pivot untouched until commit', () => {
    const r = reconcile(
      frame({ status: 'animating', displayedIndex: 1, activeIndex: 1, progress: 0 }),
      { snapshotIndex: 1, moveIndex: 0 },
      snaps,
      moves,
    );
    expect(r.commit).toEqual({ snapshotIndex: 1, moveIndex: 1 });
    expect(r.rotation).toBeNull();
  });
  it('replay from complete: commit S[last-1] with the last move, no pivot jump', () => {
    const r = reconcile(
      frame({ status: 'animating', displayedIndex: 3, activeIndex: 3, progress: 0 }),
      { snapshotIndex: 4, moveIndex: -1 },
      snaps,
      moves,
    );
    expect(r.commit).toEqual({ snapshotIndex: 3, moveIndex: 3 });
    expect(r.rotation).toBeNull();
  });
  it('replay from waiting: goes back to S[i] without applying the full angle', () => {
    const r = reconcile(
      frame({ status: 'animating', displayedIndex: 1, activeIndex: 1, progress: 0 }),
      { snapshotIndex: 2, moveIndex: 1 },
      snaps,
      moves,
    );
    expect(r.commit).toEqual({ snapshotIndex: 1, moveIndex: 1 });
    expect(r.rotation).toBeNull();
  });
  it('pause mid-turn then resume: view and angle stay identical across both', () => {
    const committed = { snapshotIndex: 1, moveIndex: 1 };
    const paused = reconcile(frame({ status: 'paused', displayedIndex: 1, activeIndex: 1, progress: 0.37 }), committed, snaps, moves);
    const resumed = reconcile(frame({ status: 'animating', displayedIndex: 1, activeIndex: 1, progress: 0.37 }), committed, snaps, moves);
    expect(paused.commit).toBeNull();
    expect(resumed.commit).toBeNull();
    expect(paused.rotation).toEqual(resumed.rotation);
    expect(paused.rotation!.y).not.toBe(0);
  });
  it('pause during wait keeps highlight, identity pivot', () => {
    const r = reconcile(
      frame({ status: 'paused', displayedIndex: 2, activeIndex: 1 }),
      { snapshotIndex: 2, moveIndex: 1 },
      snaps,
      moves,
    );
    expect(r.commit).toBeNull();
    expect(r.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });
  it('final landing then complete: highlight cleared, no pop on the last move', () => {
    const r = reconcile(
      frame({ status: 'complete', displayedIndex: 4, activeIndex: 3 }),
      { snapshotIndex: 3, moveIndex: 3 },
      snaps,
      moves,
    );
    expect(r.commit).toEqual({ snapshotIndex: 4, moveIndex: -1 });
    expect(r.rotation).toEqual({ x: moves[3]!.angle, y: 0, z: 0 }); // L2 turns about x
  });
});
