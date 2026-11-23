import { describe, expect, it } from 'vitest';
import { boxToView, computeContain, frameToView } from '@/lib/contain-transform';
import { MIRROR_STYLE, mirrorX } from '@/lib/mirror';
import { guideOverlay } from '@/lib/scan-roi';
import type { FrameResult } from '@/types/api';

describe('mirrorX', () => {
  it('reflects about the centre line and is an involution', () => {
    expect(mirrorX(0, 800)).toBe(800);
    expect(mirrorX(800, 800)).toBe(0);
    expect(mirrorX(300, 800)).toBe(500);
    for (const x of [0, 1, 123.5, 799]) expect(mirrorX(mirrorX(x, 800), 800)).toBe(x);
  });
  it('MIRROR_STYLE is a horizontal flip only', () => {
    expect(MIRROR_STYLE).toEqual({ transform: 'scaleX(-1)' });
  });
});

describe('an overlay box and its video pixels stay together after mirroring', () => {
  const frame = { w: 1280, h: 720 };
  const view = { w: 800, h: 500 };
  const result = (xyxy: [number, number, number, number]): FrameResult => ({
    type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 640, height: 640,
    detections: [{ classId: 0, color: 'red', confidence: 0.9, xyxy }], cells: [], grid: null, face: null,
    quality: { valid: false }, inferenceMs: 1,
  });

  it('the box edges map to the mirrored image of the video pixels at the same frame x', () => {
    const o = guideOverlay(frame, view, result([100, 50, 200, 150]));
    const rect = o.boxes[0]!.rect;
    const t = computeContain(view, frame)!;
    // the same crop box expressed as frame pixels, then the video pixel positions of its left/right edges
    const sq = { x: 316, y: 36, side: 648 };
    const k = sq.side / 640;
    const fx0 = sq.x + 100 * k;
    const fx1 = sq.x + 200 * k;
    const vidX0 = frameToView({ x: fx0, y: 0 }, t).x;
    const vidX1 = frameToView({ x: fx1, y: 0 }, t).x;
    expect(rect.x).toBeCloseTo(vidX0);
    expect(rect.x + rect.w).toBeCloseTo(vidX1);
    // both layers are flipped about the same centre line: the left edge ends at W - x on both
    const shownBox = [mirrorX(rect.x + rect.w, view.w), mirrorX(rect.x, view.w)];
    const shownVideo = [mirrorX(vidX1, view.w), mirrorX(vidX0, view.w)];
    expect(shownBox[0]).toBeCloseTo(shownVideo[0]!);
    expect(shownBox[1]).toBeCloseTo(shownVideo[1]!);
    // a box left of the frame centre is shown right of the view centre
    expect(rect.x + rect.w / 2).toBeLessThan(view.w / 2);
    expect(shownBox[0]).toBeGreaterThan(view.w / 2);
  });

  it('the frame left edge lands on the right of the drawn video after mirroring', () => {
    const t = computeContain(view, frame)!;
    const [x0, , x1] = boxToView([0, 0, frame.w, frame.h], t);
    expect(mirrorX(x0, view.w)).toBeCloseTo(t.offsetX + t.drawW);
    expect(mirrorX(x1, view.w)).toBeCloseTo(t.offsetX);
  });
});
