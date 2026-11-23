// Pure presentational 3x3 scanning guide: props in, markup out. No timers, no store, no claims of verification.
import { Check } from 'lucide-react';
import { COLOR_META, colorNameToCode } from '@/lib/colors';
import { MIRROR_STYLE } from '@/lib/mirror';
import { cn } from '@/lib/utils';
import type { LivePhase } from '@/lib/live-scan-machine';
import type { GuideBox, GuideRect } from '@/lib/scan-roi';
import type { FrameCell } from '@/types/api';
import type { ColorName } from '@/types/cube';

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
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const LETTER = 'text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]';
const EMPTY: FrameCell = { color: null, confidence: null, status: 'missing' };

export function LiveScanGuide({ square, face, cells, boxes, progress, phase, hint, capturedGrid }: LiveScanGuideProps) {
  if (!square) return null;
  const locked = phase === 'captured' || phase === 'rotating' || phase === 'done';
  const solid = locked && capturedGrid && capturedGrid.length === 9 ? capturedGrid : null;
  const full = progress >= 1 || phase === 'captured';
  const searching = phase === 'aligning' || phase === 'stabilizing';
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    // Mirror layer: boxes, zone and lattice follow the mirrored video; every piece of text flips back.
    <div data-testid="mirror-layer" className="absolute inset-0 pointer-events-none" style={MIRROR_STYLE}>
      {boxes.map((b, i) => (
        <div
          key={i}
          title={`${b.color} ${Math.round(b.confidence * 100)}%`}
          className="absolute border"
          style={{
            left: b.rect.x,
            top: b.rect.y,
            width: b.rect.w,
            height: b.rect.h,
            borderColor: COLOR_META[b.color].hex,
          }}
        />
      ))}

      <div
        data-testid="guide-square"
        className={cn(
          'absolute rounded-lg border-2 border-dashed shadow-[0_0_0_1px_rgba(0,0,0,0.35)]',
          full ? 'border-emerald-400' : 'border-white/45',
        )}
        style={{ left: square.x, top: square.y, width: square.w, height: square.h }}
      />

      {face && (
       <div
        data-testid="face-lattice"
        role="group"
        aria-label="Scan grid, 3 by 3"
        className="absolute grid grid-cols-3 grid-rows-3 gap-px p-px border border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
        style={{ left: face.x, top: face.y, width: face.w, height: face.h }}
       >
        {Array.from({ length: 9 }, (_, i) => {
          const label = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
          const solidColor = solid?.[i];
          if (solidColor) {
            return (
              <div
                key={i}
                role="img"
                aria-label={`${label}: ${solidColor}`}
                className="flex items-center justify-center border border-white/60"
                style={{ backgroundColor: COLOR_META[solidColor].hex }}
              >
                <Check data-check aria-hidden="true" className="w-4 h-4 text-white drop-shadow" />
                <span aria-hidden="true" className={LETTER} style={MIRROR_STYLE}>
                  {colorNameToCode(solidColor)}
                </span>
              </div>
            );
          }
          const cell = cells?.[i] ?? EMPTY;
          if (cell.status === 'ok' && cell.color) {
            return (
              <div
                key={i}
                role="img"
                aria-label={`${label}: ${cell.color}`}
                className="flex items-center justify-center border border-white/60"
                style={{ backgroundColor: rgba(COLOR_META[cell.color].hex, 0.75) }}
              >
                <span aria-hidden="true" className={LETTER} style={MIRROR_STYLE}>
                  {colorNameToCode(cell.color)}
                </span>
              </div>
            );
          }
          if (cell.status === 'ambiguous') {
            return (
              <div
                key={i}
                role="img"
                aria-label={`${label}: unclear`}
                className="flex items-center justify-center border-2 border-amber-400 bg-black/50 text-amber-300 font-bold text-lg"
              >
                <span aria-hidden="true" className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" style={MIRROR_STYLE}>?</span>
              </div>
            );
          }
          if (cell.status === 'misaligned') {
            return (
              <div
                key={i}
                role="img"
                aria-label={`${label}: out of position`}
                className="flex items-center justify-center border-2 border-amber-400 bg-black/30"
              >
                {cell.color && (
                  <span aria-hidden="true" className={LETTER} style={MIRROR_STYLE}>
                    {colorNameToCode(cell.color)}
                  </span>
                )}
              </div>
            );
          }
          return (
            <div key={i} role="img" aria-label={`${label}: not detected`} className="border border-dashed border-white/60 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]" />
          );
        })}
       </div>
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
