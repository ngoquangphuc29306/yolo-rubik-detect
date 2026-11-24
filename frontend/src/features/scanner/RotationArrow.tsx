// Small whole-cube rotation arrow, styled like the solve screen's move arrow (thin curved green arc
// with a pointed head). Pure presentational, no text.
// It is rendered INSIDE the mirrored overlay layer and counter-mirrored (scaleX(-1) twice = identity),
// so the glyph is drawn natively: ARROW_ROTATION_DEG[direction] is exactly what the user sees on screen.
import { MIRROR_STYLE } from '@/lib/mirror';
import type { ArrowDirection } from '@/lib/rotation-steps';

/** SVG rotation (degrees, screen y points down) of an arrow that is drawn pointing right. */
export const ARROW_ROTATION_DEG: Readonly<Record<ArrowDirection, number>> = { right: 0, down: 90, left: 180, up: 270 };

/** Largest side in view px; the arrow never covers the face it guides. */
export const ARROW_MAX_PX = 72;

const ANIM: Readonly<Record<ArrowDirection, string>> = {
  right: 'animate-arrow-right',
  left: 'animate-arrow-left',
  up: 'animate-arrow-up',
  down: 'animate-arrow-down',
};

export interface RotationArrowProps {
  direction: ArrowDirection;
  /** Centre in the layer's coordinates (view px) and side length. */
  cx: number;
  cy: number;
  size: number;
}

export function RotationArrow({ direction, cx, cy, size }: RotationArrowProps) {
  const deg = ARROW_ROTATION_DEG[direction];
  const side = Math.min(size, ARROW_MAX_PX);
  return (
    <div
      data-testid="rotation-arrow"
      data-direction={direction}
      aria-hidden="true"
      className="absolute"
      style={{ left: cx - side / 2, top: cy - side / 2, width: side, height: side, ...MIRROR_STYLE }}
    >
      <div
        className={`w-full h-full ${ANIM[direction]} motion-reduce:animate-none`}
        style={{ filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.6))' }}
      >
        <svg viewBox="0 0 100 100" width="100%" height="100%" data-rotation={deg} style={{ transform: `rotate(${deg}deg)` }}>
          {/* A shallow arc sweeping left to right (a whole-cube turn seen from the front), head on the right. */}
          <path
            data-part="arc"
            d="M14 62 Q50 30 80 56"
            fill="none"
            stroke="#34D399"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path data-part="head" d="M94 66 L70 70 L82 46 Z" fill="#6EE7B7" stroke="#34D399" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
