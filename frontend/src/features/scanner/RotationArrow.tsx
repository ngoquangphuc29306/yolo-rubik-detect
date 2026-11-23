// Large animated whole-cube rotation arrow. Pure presentational, no text.
// It is rendered INSIDE the mirrored overlay layer and counter-mirrored (scaleX(-1) twice = identity),
// so the glyph is drawn natively: ARROW_ROTATION_DEG[direction] is exactly what the user sees on screen.
import { MIRROR_STYLE } from '@/lib/mirror';
import type { ArrowDirection } from '@/lib/rotation-steps';

/** SVG rotation (degrees, screen y points down) of an arrow that is drawn pointing right. */
export const ARROW_ROTATION_DEG: Readonly<Record<ArrowDirection, number>> = { right: 0, down: 90, left: 180, up: 270 };

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
  return (
    <div
      data-testid="rotation-arrow"
      data-direction={direction}
      aria-hidden="true"
      className="absolute"
      style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size, ...MIRROR_STYLE }}
    >
      <div
        className={`w-full h-full ${ANIM[direction]} motion-reduce:animate-none`}
        style={{ filter: 'drop-shadow(0 8px 5px rgba(0,0,0,0.6)) drop-shadow(0 0 10px rgba(52,211,153,0.55))' }}
      >
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          data-rotation={deg}
          style={{ transform: `rotate(${deg}deg)` }}
        >
          <defs>
            <linearGradient id={`arrow-top-${direction}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a7f3d0" />
              <stop offset="0.5" stopColor="#34d399" />
              <stop offset="1" stopColor="#047857" />
            </linearGradient>
          </defs>
          {/* Extruded side (stacked darker copies) under the lit face gives the 3D look. */}
          {[7, 5, 3].map((d) => (
            <path key={d} d="M6 37 H52 V13 L96 50 L52 87 V63 H6 Z" transform={`translate(0 ${d})`} fill="#065f46" />
          ))}
          <path
            d="M6 37 H52 V13 L96 50 L52 87 V63 H6 Z"
            fill={`url(#arrow-top-${direction})`}
            stroke="#ecfdf5"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
