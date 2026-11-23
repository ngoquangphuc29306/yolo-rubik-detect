// Pure guide-square (ROI) geometry between frame pixels and crop/view pixels. No DOM.
import { frameToView, type ContainTransform, type Xyxy } from './contain-transform';
import type { Size } from './contain-transform';

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
