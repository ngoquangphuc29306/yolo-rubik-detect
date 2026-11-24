// Pure live-scan coaching: latest frame result -> sticker count and one short line. No React, DOM or timers.
// Advice about distance, tilt and light only; it never claims the cube orientation or colours are verified.
import type { FrameResult } from '@/types/api';

/** Lattice side below this fraction of the crop: the cube is too far for reliable stickers. */
export const EXTENT_TOO_NEAR = 0.2;
/** Lattice side above this fraction of the crop: the cube fills the zone and its edges are clipped. */
export const EXTENT_TOO_FAR = 0.9;
/** With INCOMPLETE stickers, a lattice this large probably runs off the zone. */
export const EXTENT_INCOMPLETE_FAR = 0.75;
/** Without a lattice, the median sticker side below this fraction of the crop means the cube is far away (3 stickers across ~20%). */
export const STICKER_TOO_SMALL = EXTENT_TOO_NEAR / 3;

export interface Coaching {
  /** Stickers seen in this frame (0..9), or null when no face or detection exists to count. */
  count: number | null;
  line: string | null;
}

const NONE: Coaching = { count: null, line: null };
const CLOSER = 'Move the cube a little closer';
const FARTHER = 'Move the cube a little farther';

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function coachFrame(result: FrameResult | null): Coaching {
  if (!result) return NONE;
  const crop = result.width > 0 ? result.width : null;
  const { face, detections } = result;
  const reason = result.quality.reason;

  let count: number | null = null;
  if (face) count = result.cells.filter((c) => c.status === 'ok' && c.color !== null).length;
  else if (detections.length > 0) count = Math.min(9, detections.length);
  if (count === null) return NONE;

  if (result.quality.valid) return { count, line: 'Hold steady' };

  const extent = face && crop ? Math.max(face.x1 - face.x0, face.y1 - face.y0) / crop : null;
  if (extent !== null) {
    if (extent < EXTENT_TOO_NEAR) return { count, line: CLOSER };
    if (extent > EXTENT_TOO_FAR || (reason === 'INCOMPLETE' && extent > EXTENT_INCOMPLETE_FAR)) {
      return { count, line: FARTHER };
    }
  } else if (crop && detections.length > 0) {
    const side = median(detections.map((d) => Math.max(d.xyxy[2] - d.xyxy[0], d.xyxy[3] - d.xyxy[1])));
    if (side / crop < STICKER_TOO_SMALL) return { count, line: CLOSER };
  }

  switch (reason) {
    case 'TILTED':
    case 'MISALIGNED':
      return { count, line: 'Hold the cube flat toward the camera' };
    case 'AMBIGUOUS':
      return { count, line: 'Some stickers are unclear — reduce glare or change the light' };
    case 'INCOMPLETE':
      return { count, line: 'Keep all nine stickers inside the square' };
    default:
      return { count, line: null };
  }
}
