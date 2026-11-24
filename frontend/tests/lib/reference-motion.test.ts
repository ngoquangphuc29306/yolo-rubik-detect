import { describe, expect, it } from 'vitest';
import { scanGuide } from '@/features/scanner/scan-guide';
import { ROTATION_STEPS } from '@/lib/rotation-steps';
import {
  HOLD_MS, LOOP_MS, REST_MS, TURN_MS, easeInOut, loopProgress, referenceRotationAt, stepEndPose, stepStartPose,
} from '@/lib/reference-motion';
import type { FaceId } from '@/types/cube';

const TAU = 2 * Math.PI;
const wrapEq = (a: number, b: number) => {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return Math.min(d, TAU - d) < 1e-9;
};
const pose = (f: FaceId) => scanGuide(f, {}, true).referenceRotation;
// face shown at the START of each step (the previous centre), and at the END (target / Front for returns)
const START_FACE: FaceId[] = ['F', 'R', 'B', 'L', 'F', 'U', 'F'];
const END_FACE: FaceId[] = ['R', 'B', 'L', 'F', 'U', 'F', 'D'];

describe('reference motion poses', () => {
  ROTATION_STEPS.forEach((s, i) => {
    it(`step ${s.step} (${s.arrow}) starts on ${START_FACE[i]} and ends on ${END_FACE[i]}`, () => {
      const a = referenceRotationAt(s, 0);
      const b = referenceRotationAt(s, 1);
      pose(START_FACE[i]!).forEach((v, k) => expect(wrapEq(a[k]!, v)).toBe(true));
      pose(END_FACE[i]!).forEach((v, k) => expect(b[k]).toBeCloseTo(v, 12)); // end is exactly the guide pose
      stepEndPose(s).forEach((v, k) => expect(b[k]).toBeCloseTo(v, 12));
      stepStartPose(s).forEach((v, k) => expect(a[k]).toBeCloseTo(v, 12));
    });
    it(`step ${s.step} turns exactly 90 degrees about one axis, in the arrow's direction`, () => {
      const a = referenceRotationAt(s, 0);
      const b = referenceRotationAt(s, 1);
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const expected = { right: [0, -1, 0], left: [0, 1, 0], down: [1, 0, 0], up: [-1, 0, 0] }[s.arrow];
      d.forEach((v, k) => expect(v).toBeCloseTo((expected[k] ?? 0) * (Math.PI / 2), 12));
    });
  });
  it('the guide poses the module relies on are the documented ones', () => {
    expect(pose('R')[1]).toBeCloseTo(-Math.PI / 2 - 0.22, 12);
    expect(pose('U')[0]).toBeCloseTo(Math.PI / 2 + 0.18, 12);
  });
});

describe('easing and loop timing', () => {
  it('easeInOut is 0 at 0, 1 at 1, 0.5 at the middle, clamped, monotonic', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOut(-3)).toBe(0);
    expect(easeInOut(7)).toBe(1);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = easeInOut(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('loop is about 2.5 s: rest, turn, hold', () => {
    expect([REST_MS, TURN_MS, HOLD_MS, LOOP_MS]).toEqual([800, 900, 800, 2500]);
  });
  it('rests at 0, ends the turn at 1, holds, then snaps back and repeats', () => {
    expect(loopProgress(0)).toBe(0);
    expect(loopProgress(REST_MS - 1)).toBe(0);
    expect(loopProgress(REST_MS + TURN_MS)).toBe(1);
    expect(loopProgress(REST_MS + TURN_MS + HOLD_MS - 1)).toBe(1);
    expect(loopProgress(LOOP_MS)).toBe(0);
    expect(loopProgress(LOOP_MS + REST_MS + TURN_MS / 2)).toBeCloseTo(0.5, 12);
  });
  it('progress never decreases during the turn and stays in [0,1]', () => {
    let prev = 0;
    for (let t = REST_MS; t <= REST_MS + TURN_MS; t += 10) {
      const v = loopProgress(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
  });
  it('negative elapsed time is tolerated', () => {
    expect(loopProgress(-100)).toBe(1);
  });
});
