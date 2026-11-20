import { COLOR_META } from '@/lib/colors';
import type { MoveDescriptor } from '@/engine/move-presentation';
import type { ColorName, FaceId } from '@/types/cube';

const FACE_FULL_NAME: Record<FaceId, string> = {
  U: 'Top',
  D: 'Bottom',
  F: 'Front',
  B: 'Back',
  R: 'Right',
  L: 'Left',
};

interface MoveInfoPanelProps {
  prevNotation: string | null;
  currentNotation: string;
  nextNotation: string | null;
  move: MoveDescriptor;
  /** Centre colour of the face being turned, from the session's centre mapping. */
  centerColor: ColorName;
}

/** Move information panel (solid dark surface: zero backdrop-blur over WebGL). */
export function MoveInfoPanel({
  prevNotation,
  currentNotation,
  nextNotation,
  move,
  centerColor,
}: MoveInfoPanelProps) {
  const meta = COLOR_META[centerColor];
  return (
    <div className="pointer-events-auto rounded-2xl bg-[#111113]/95 border border-zinc-800/90 px-5 py-4 max-w-md w-full sm:w-auto shadow-xl">
      {/* Prev · Current · Next Move Strip */}
      <div className="flex items-baseline gap-5">
        <div className="text-center min-w-[44px]">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Prev
          </span>
          <span className="font-mono text-base text-zinc-500 tabular-nums">
            {prevNotation ?? '—'}
          </span>
        </div>

        <div className="h-7 w-px bg-zinc-800" aria-hidden="true" />

        <div className="text-center min-w-[60px]">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-emerald-400">
            Current
          </span>
          <span className="font-mono text-3xl sm:text-4xl font-semibold text-zinc-50 leading-none tracking-tight">
            {currentNotation}
          </span>
        </div>

        <div className="h-7 w-px bg-zinc-800" aria-hidden="true" />

        <div className="text-center min-w-[44px]">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Next
          </span>
          <span className="font-mono text-base text-zinc-300 tabular-nums">
            {nextNotation ?? 'Done'}
          </span>
        </div>
      </div>

      {/* Natural Language Instruction + Center Color Reference */}
      <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5">
        <p className="text-sm sm:text-base font-medium text-zinc-100">{move.naturalLanguage}</p>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span
            className="w-3 h-3 rounded-[3px] border border-white/25 shrink-0"
            style={{ backgroundColor: meta.hex }}
          />
          <span data-testid="move-center-line">
            {meta.name} center · {FACE_FULL_NAME[move.face]} face
          </span>
        </div>
      </div>
    </div>
  );
}
