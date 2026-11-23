import { describe, expect, it } from 'vitest';
import { computeContain } from '@/lib/contain-transform';
import { cropBoxToFrame, cropSize, guideSquare, guideSquareToView } from '@/lib/scan-roi';

describe('guideSquare', () => {
  it('matches the documented sizes', () => {
    expect(guideSquare({ w: 1280, h: 720 })).toEqual({ x: 381, y: 101, side: 518 });
    expect(guideSquare({ w: 640, h: 480 })).toEqual({ x: 147, y: 67, side: 345 });
  });
  it('rejects invalid sizes and fractions', () => {
    expect(guideSquare({ w: 0, h: 480 })).toBeNull();
    expect(guideSquare({ w: 640, h: -1 })).toBeNull();
    expect(guideSquare({ w: NaN, h: 480 })).toBeNull();
    expect(guideSquare({ w: Infinity, h: 480 })).toBeNull();
    expect(guideSquare({ w: 640, h: 480 }, 0)).toBeNull();
    expect(guideSquare({ w: 640, h: 480 }, 1.01)).toBeNull();
    expect(guideSquare({ w: 640, h: 480 }, NaN)).toBeNull();
  });
  it('accepts fraction 1', () => {
    expect(guideSquare({ w: 640, h: 480 }, 1)).toEqual({ x: 80, y: 0, side: 480 });
  });
});

describe('cropSize', () => {
  it('caps at 640 and rounds', () => {
    expect(cropSize({ x: 0, y: 0, side: 518 })).toBe(518);
    expect(cropSize({ x: 0, y: 0, side: 777 })).toBe(640);
  });
});

describe('cropBoxToFrame', () => {
  it('maps a corner box with scale 1', () => {
    expect(cropBoxToFrame([0, 0, 10, 20], { x: 381, y: 101, side: 518 }, 518)).toEqual([381, 101, 391, 121]);
  });
  it('scales for side 777 / cropSize 640', () => {
    const sq = { x: 10, y: 20, side: 777 };
    const out = cropBoxToFrame([0, 0, 640, 320], sq, 640);
    const s = 777 / 640;
    expect(out[0]).toBeCloseTo(10);
    expect(out[1]).toBeCloseTo(20);
    expect(out[2]).toBeCloseTo(10 + 640 * s);
    expect(out[3]).toBeCloseTo(20 + 320 * s);
    expect(out[2]).toBeCloseTo(787);
  });
});

describe('guideSquareToView', () => {
  it('maps through the contain transform', () => {
    const t = computeContain({ w: 640, h: 360 }, { w: 1280, h: 720 })!;
    const v = guideSquareToView({ x: 381, y: 101, side: 518 }, t);
    expect(v.x).toBeCloseTo(190.5);
    expect(v.y).toBeCloseTo(50.5);
    expect(v.w).toBeCloseTo(259);
    expect(v.h).toBeCloseTo(259);
  });
  it('includes letterbox offsets', () => {
    const t = computeContain({ w: 800, h: 400 }, { w: 400, h: 400 })!;
    const v = guideSquareToView({ x: 0, y: 0, side: 400 }, t);
    expect(v).toEqual({ x: 200, y: 0, w: 400, h: 400 });
  });
});
