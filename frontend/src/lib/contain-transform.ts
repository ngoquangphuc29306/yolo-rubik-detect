// Pure object-fit: contain maths between frame pixels (unmirrored) and view pixels. No DOM.
export interface Size {
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface ContainTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  drawW: number;
  drawH: number;
}
export type Xyxy = readonly [number, number, number, number];

const valid = (s: Size) => Number.isFinite(s.w) && Number.isFinite(s.h) && s.w > 0 && s.h > 0;

export function computeContain(view: Size, frame: Size): ContainTransform | null {
  if (!valid(view) || !valid(frame)) return null;
  const scale = Math.min(view.w / frame.w, view.h / frame.h);
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;
  return { scale, offsetX: (view.w - drawW) / 2, offsetY: (view.h - drawH) / 2, drawW, drawH };
}

export function frameToView(pt: Point, t: ContainTransform): Point {
  return { x: pt.x * t.scale + t.offsetX, y: pt.y * t.scale + t.offsetY };
}

export function viewToFrame(pt: Point, t: ContainTransform): Point {
  return { x: (pt.x - t.offsetX) / t.scale, y: (pt.y - t.offsetY) / t.scale };
}

export function boxToView(xyxy: Xyxy, t: ContainTransform): [number, number, number, number] {
  const a = frameToView({ x: xyxy[0], y: xyxy[1] }, t);
  const b = frameToView({ x: xyxy[2], y: xyxy[3] }, t);
  return [a.x, a.y, b.x, b.y];
}
