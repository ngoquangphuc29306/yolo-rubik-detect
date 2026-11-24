// Pure presentational scanning guide (placement zone, raw YOLO boxes, arrow): props in, markup out. No timers, no store, no claims of verification.
import { COLOR_META } from '@/lib/colors';
import { MIRROR_STYLE } from '@/lib/mirror';
import { cn } from '@/lib/utils';
import type { ArrowDirection } from '@/lib/rotation-steps';
import type { LivePhase } from '@/lib/live-scan-machine';
import type { GuideBox, GuideRect } from '@/lib/scan-roi';
import type { FrameCell } from '@/types/api';
import type { ColorName } from '@/types/cube';
import { RotationArrow } from './RotationArrow';

export type { GuideBox, GuideRect };
export interface LiveScanGuideProps {
  /** The placement zone: the face may be anywhere inside it. */
  square: GuideRect | null;
  /** The fitted 3x3 lattice box (view px); null until a lattice has been fitted. */
  face: GuideRect | null;
  cells: readonly FrameCell[] | null;
  boxes: readonly GuideBox[];
  progress: number;
  phase: LivePhase;
  hint: string | null;
  capturedGrid?: readonly ColorName[] | null;
  /** Whole-cube rotation arrow for the mirrored screen, drawn on the cube; null/absent for none. */
  arrow?: ArrowDirection | null;
}

export function LiveScanGuide({ square, face, boxes, progress, phase, hint, arrow }: LiveScanGuideProps) {
  if (!square) return null;
  const full = progress >= 1 || phase === 'captured';
  const searching = phase === 'aligning' || phase === 'stabilizing';
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    // Mirror layer: boxes, zone and lattice follow the mirrored video; every piece of text flips back.
    <div data-testid="mirror-layer" className="absolute inset-0 pointer-events-none" style={MIRROR_STYLE}>
      {/* Raw YOLO detections in the familiar style: coloured box plus a "colour 0.88" label chip. */}
      {boxes.map((b, i) => (
        <div
          key={i}
          data-testid="yolo-box"
          title={`${b.color} ${Math.round(b.confidence * 100)}%`}
          className="absolute border-2"
          style={{ left: b.rect.x, top: b.rect.y, width: b.rect.w, height: b.rect.h, borderColor: COLOR_META[b.color].hex }}
        >
          <span
            aria-hidden="true"
            className="absolute right-0 bottom-full whitespace-nowrap px-1 text-[10px] leading-4 font-semibold text-white"
            style={{ backgroundColor: COLOR_META[b.color].hex, ...MIRROR_STYLE }}
          >
            {b.color} {b.confidence.toFixed(2)}
          </span>
        </div>
      ))}

      <div
        data-testid="guide-square"
        className={cn(
          'absolute rounded-lg border-2 border-dashed shadow-[0_0_0_1px_rgba(0,0,0,0.35)]',
          full ? 'border-emerald-400' : 'border-white/45',
        )}
        style={{ left: square.x, top: square.y, width: square.w, height: square.h }}
      />

      {arrow && (
        <RotationArrow
          direction={arrow}
          cx={face ? face.x + face.w / 2 : square.x + square.w / 2}
          cy={face ? face.y + face.h / 2 : square.y + square.h / 2}
          size={Math.max(64, Math.min(220, Math.min(square.w, square.h) * 0.4))}
        />
      )}

      {searching && (
      <div
        className="absolute flex flex-col items-center justify-end gap-2 p-2"
        style={{ left: square.x, top: square.y, width: square.w, height: square.h, ...MIRROR_STYLE }}
      >
        <div
          role="progressbar"
          aria-label="Hold steady"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden"
        >
          <div className="h-full bg-emerald-400 transition-[width] duration-150" style={{ width: `${pct}%` }} />
        </div>
        {hint && (
          <p role="status" aria-live="polite" className="text-xs text-amber-300 text-center bg-black/60 rounded px-2 py-0.5">
            {hint}
          </p>
        )}
      </div>
      )}
    </div>
  );
}
