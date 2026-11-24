// Display-only mirroring. Frames, detections, crops and grids are never mirrored; only what is painted is.
import type * as React from 'react';

/** Mirrors a CSS box about its own vertical centre line. Applying it twice cancels. */
export const MIRROR_STYLE: React.CSSProperties = { transform: 'scaleX(-1)' };

/** X of a point after mirroring within a surface of the given width. */
export function mirrorX(x: number, width: number): number {
  return width - x;
}
