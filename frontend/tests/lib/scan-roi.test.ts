import { describe, expect, it } from 'vitest';
import { computeContain } from '@/lib/contain-transform';
import { cropBoxToFrame, cropSize, guideOverlay, guideSquare, guideSquareToView } from '@/lib/scan-roi';
import type { FrameResult } from '@/types/api';

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

describe('guideOverlay', () => {
  const result = (xyxy: [number, number, number, number]): FrameResult => ({
    type: 'frame_result',
    schemaVersion: 1,
    scanId: 's',
    frameSeq: 1,
    width: 518,
    height: 518,
    detections: [{ classId: 0, color: 'green', confidence: 0.9, xyxy }],
    cells: [],
    grid: null,
    quality: { valid: false },
    inferenceMs: 1,
  });

  it('letterboxed 1280x720 video in a 600x600 view: exact square and box', () => {
    const t = computeContain({ w: 600, h: 600 }, { w: 1280, h: 720 })!;
    expect(t.scale).toBe(0.46875);
    expect(t.offsetY).toBe(131.25);
    const o = guideOverlay({ w: 1280, h: 720 }, { w: 600, h: 600 }, result([0, 0, 10, 20]));
    expect(o.square).toEqual({ x: 178.59375, y: 178.59375, w: 242.8125, h: 242.8125 });
    expect(o.boxes).toEqual([
      { color: 'green', confidence: 0.9, rect: { x: 178.59375, y: 178.59375, w: 4.6875, h: 9.375 } },
    ]);
  });

  it('identity when the view equals the frame', () => {
    const o = guideOverlay({ w: 640, h: 480 }, { w: 640, h: 480 }, result([10, 20, 60, 70]));
    expect(o.square).toEqual({ x: 147, y: 67, w: 345, h: 345 });
    expect(o.boxes[0]!.rect).toEqual({ x: 157, y: 87, w: 50, h: 50 });
  });

  it('a box at the crop corner lands on the square corner in view px', () => {
    const o = guideOverlay({ w: 1280, h: 720 }, { w: 600, h: 600 }, result([0, 0, 5, 5]));
    expect(o.boxes[0]!.rect.x).toBe(o.square!.x);
    expect(o.boxes[0]!.rect.y).toBe(o.square!.y);
  });

  it('no result gives no boxes; invalid sizes give null/empty', () => {
    expect(guideOverlay({ w: 640, h: 480 }, { w: 640, h: 480 }, null).boxes).toEqual([]);
    expect(guideOverlay({ w: 0, h: 480 }, { w: 640, h: 480 }, null)).toEqual({ square: null, boxes: [] });
    expect(guideOverlay({ w: 640, h: 480 }, { w: 0, h: 0 }, result([0, 0, 1, 1]))).toEqual({ square: null, boxes: [] });
    expect(guideOverlay({ w: NaN, h: 480 }, { w: 640, h: 480 }, null)).toEqual({ square: null, boxes: [] });
  });
});
