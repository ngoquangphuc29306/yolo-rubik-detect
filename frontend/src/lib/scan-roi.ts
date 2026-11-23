// Pure guide-square (ROI) geometry between frame pixels and crop/view pixels. No DOM.
import { boxToView, computeContain, frameToView, type ContainTransform, type Size, type Xyxy } from './contain-transform';
import type { FrameResult } from '@/types/api';
import type { ColorName } from '@/types/cube';

export interface GuideRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface GuideBox {
  color: ColorName;
  confidence: number;
  rect: GuideRect;
}

export interface GuideSquare {
  x: number;
  y: number;
  side: number;
}

export function guideSquare(frame: Size, fraction = 0.72): GuideSquare | null {
  const ok = Number.isFinite(frame.w) && Number.isFinite(frame.h) && frame.w > 0 && frame.h > 0;
  if (!ok || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) return null;
  const side = Math.floor(fraction * Math.min(frame.w, frame.h));
  if (side <= 0) return null;
  return { x: Math.floor((frame.w - side) / 2), y: Math.floor((frame.h - side) / 2), side };
}

export function cropSize(square: GuideSquare): number {
  return Math.min(Math.round(square.side), 640);
}

/** Maps a box in crop pixels to (unmirrored) frame pixels. */
export function cropBoxToFrame(xyxy: Xyxy, square: GuideSquare, size: number): Xyxy {
  const scale = square.side / size;
  return [
    square.x + xyxy[0] * scale,
    square.y + xyxy[1] * scale,
    square.x + xyxy[2] * scale,
    square.y + xyxy[3] * scale,
  ];
}

export function guideSquareToView(
  square: GuideSquare,
  t: ContainTransform,
): { x: number; y: number; w: number; h: number } {
  const p = frameToView({ x: square.x, y: square.y }, t);
  const side = square.side * t.scale;
  return { x: p.x, y: p.y, w: side, h: side };
}

/** Overlay geometry in view pixels: the guide square and every detection box (crop px -> frame px -> view px). */
export function guideOverlay(
  frame: Size,
  view: Size,
  result: FrameResult | null,
): { square: GuideRect | null; boxes: GuideBox[] } {
  const t = computeContain(view, frame);
  const sq = guideSquare(frame);
  if (!t || !sq) return { square: null, boxes: [] };
  const size = cropSize(sq);
  const boxes = (result?.detections ?? []).map((d): GuideBox => {
    const [x1, y1, x2, y2] = boxToView(cropBoxToFrame(d.xyxy, sq, size), t);
    return { color: d.color, confidence: d.confidence, rect: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } };
  });
  return { square: guideSquareToView(sq, t), boxes };
}
