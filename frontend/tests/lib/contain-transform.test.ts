import { describe, expect, it } from 'vitest';
import { boxToView, computeContain, frameToView, viewToFrame } from '@/lib/contain-transform';

describe('computeContain', () => {
  it('letterboxes when the view is wider than the frame (pillarbox bars left/right)', () => {
    const t = computeContain({ w: 800, h: 400 }, { w: 400, h: 400 })!;
    expect(t.scale).toBe(1);
    expect(t.drawW).toBe(400);
    expect(t.drawH).toBe(400);
    expect(t.offsetX).toBe(200);
    expect(t.offsetY).toBe(0);
  });

  it('letterboxes when the view is taller than the frame (bars top/bottom)', () => {
    const t = computeContain({ w: 400, h: 800 }, { w: 400, h: 400 })!;
    expect(t.scale).toBe(1);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBe(200);
  });

  it('exact fit has no offsets', () => {
    const t = computeContain({ w: 1280, h: 720 }, { w: 1280, h: 720 })!;
    expect(t).toEqual({ scale: 1, offsetX: 0, offsetY: 0, drawW: 1280, drawH: 720 });
  });

  it('handles non-square 16:9 frame in a 4:3 view', () => {
    const t = computeContain({ w: 800, h: 600 }, { w: 1280, h: 720 })!;
    expect(t.scale).toBeCloseTo(0.625, 12);
    expect(t.drawW).toBeCloseTo(800, 9);
    expect(t.drawH).toBeCloseTo(450, 9);
    expect(t.offsetX).toBeCloseTo(0, 9);
    expect(t.offsetY).toBeCloseTo(75, 9);
  });

  it.each([
    [{ w: 0, h: 10 }, { w: 10, h: 10 }],
    [{ w: 10, h: -1 }, { w: 10, h: 10 }],
    [{ w: 10, h: 10 }, { w: 0, h: 10 }],
    [{ w: 10, h: 10 }, { w: 10, h: 0 }],
    [{ w: NaN, h: 10 }, { w: 10, h: 10 }],
    [{ w: 10, h: 10 }, { w: Infinity, h: 10 }],
    [{ w: 10, h: 10 }, { w: 10, h: -Infinity }],
  ])('returns null for invalid dimensions %#', (view, frame) => {
    expect(computeContain(view, frame)).toBeNull();
  });
});

describe('point and box mapping', () => {
  const t = computeContain({ w: 800, h: 600 }, { w: 1280, h: 720 })!;

  it('maps frame corners onto the drawn rectangle', () => {
    const tl = frameToView({ x: 0, y: 0 }, t);
    const br = frameToView({ x: 1280, y: 720 }, t);
    expect(tl.x).toBeCloseTo(0, 9);
    expect(tl.y).toBeCloseTo(75, 9);
    expect(br.x).toBeCloseTo(800, 9);
    expect(br.y).toBeCloseTo(525, 9);
  });

  it('round-trips frame -> view -> frame within 1e-9', () => {
    for (let x = 0; x <= 1280; x += 160) {
      for (let y = 0; y <= 720; y += 90) {
        const back = viewToFrame(frameToView({ x, y }, t), t);
        expect(Math.abs(back.x - x)).toBeLessThan(1e-9);
        expect(Math.abs(back.y - y)).toBeLessThan(1e-9);
      }
    }
  });

  it('maps an xyxy box', () => {
    const box = boxToView([320, 180, 640, 360], t);
    expect(box[0]).toBeCloseTo(200, 9);
    expect(box[1]).toBeCloseTo(75 + 112.5, 9);
    expect(box[2]).toBeCloseTo(400, 9);
    expect(box[3]).toBeCloseTo(75 + 225, 9);
  });

  it('is unmirrored: x increases to the right in both spaces', () => {
    const a = frameToView({ x: 100, y: 100 }, t);
    const b = frameToView({ x: 200, y: 100 }, t);
    expect(b.x).toBeGreaterThan(a.x);
    const box = boxToView([100, 100, 200, 200], t);
    expect(box[2]).toBeGreaterThan(box[0]);
    expect(box[3]).toBeGreaterThan(box[1]);
  });
});
