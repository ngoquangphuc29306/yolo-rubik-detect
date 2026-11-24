import { describe, expect, it } from 'vitest';
import {
  ROTATION_STEPS,
  isReturnStep,
  nextStepAfterCapture,
  nextStepAfterReturn,
  rotationStep,
  stepCaption,
} from '@/lib/rotation-steps';
import { SCAN_FACE_ORDER } from '@/types/cube';

describe('ROTATION_STEPS (arrows are for the MIRRORED screen)', () => {
  it('is exactly the spec table', () => {
    expect(ROTATION_STEPS.map((s) => [s.step, s.from, s.arrow, s.to, s.captures])).toEqual([
      [1, 'green', 'right', 'red', 'R'],
      [2, 'red', 'right', 'blue', 'B'],
      [3, 'blue', 'right', 'orange', 'L'],
      [4, 'orange', 'right', 'green', null],
      [5, 'green', 'down', 'white', 'U'],
      [6, 'white', 'up', 'green', null],
      [7, 'green', 'up', 'yellow', 'D'],
    ]);
  });
  it('chains: each step starts on the colour the previous one arrived at', () => {
    for (let i = 1; i < ROTATION_STEPS.length; i++) expect(ROTATION_STEPS[i]!.from).toBe(ROTATION_STEPS[i - 1]!.to);
    expect(ROTATION_STEPS[0]!.from).toBe('green');
  });
  it('the captured faces keep the F-R-B-L-U-D order (F is the start pose)', () => {
    const faces = ROTATION_STEPS.map((s) => s.captures).filter((f) => f !== null);
    expect(['F', ...faces]).toEqual([...SCAN_FACE_ORDER]);
  });
  it('steps 4 and 6 are return steps; the others capture', () => {
    expect(ROTATION_STEPS.filter((s) => isReturnStep(s.step)).map((s) => s.step)).toEqual([4, 6]);
    expect(isReturnStep(1)).toBe(false);
    expect(isReturnStep(null)).toBe(false);
  });
  it('rotationStep looks up by 1-based number and rejects out-of-range', () => {
    expect(rotationStep(5)).toBe(ROTATION_STEPS[4]);
    expect(rotationStep(0)).toBeNull();
    expect(rotationStep(8)).toBeNull();
    expect(rotationStep(null)).toBeNull();
  });
  it('step after a capture; none after D', () => {
    expect(SCAN_FACE_ORDER.map((f) => nextStepAfterCapture(f))).toEqual([1, 2, 3, 4, 6, null]);
  });
  it('step after a return', () => {
    expect(nextStepAfterReturn(4)).toBe(5);
    expect(nextStepAfterReturn(6)).toBe(7);
    expect(nextStepAfterReturn(1)).toBeNull();
  });
  it('caption names the expected centre and the target stage, never claims verification', () => {
    expect(stepCaption(ROTATION_STEPS[0]!)).toEqual({ line: 'Next: red centre', target: 'Right face' });
    expect(stepCaption(ROTATION_STEPS[3]!)).toEqual({ line: 'Next: green centre', target: 'Return to the Front face (not scanned)' });
    expect(stepCaption(ROTATION_STEPS[4]!)).toEqual({ line: 'Next: white centre', target: 'Top face' });
    expect(stepCaption(ROTATION_STEPS[6]!)).toEqual({ line: 'Next: yellow centre', target: 'Bottom face' });
    for (const s of ROTATION_STEPS) expect(JSON.stringify(stepCaption(s))).not.toMatch(/verified|orientation/i);
  });
});
