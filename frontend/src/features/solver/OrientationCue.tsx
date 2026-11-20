import { COLOR_META } from '@/lib/colors';
import type { CenterColors } from '@/types/cube';

const CHIPS = [
  { label: 'Top', face: 'U' },
  { label: 'Front', face: 'F' },
  { label: 'Right', face: 'R' },
] as const;

/**
 * Persistent orientation reminder (ARCHITECTURE 7.2): which centre colours must face Top / Front / Right.
 * Derived from the session's centre mapping, never hard-coded. Pointer-transparent so it never blocks orbiting.
 */
export function OrientationCue({ centers }: { centers: CenterColors }) {
  return (
    <div
      data-testid="orientation-cue"
      aria-label="Hold your cube with these centers facing you"
      className="pointer-events-none flex items-center gap-2 flex-wrap justify-center"
    >
      {CHIPS.map(({ label, face }) => {
        const meta = COLOR_META[centers[face]];
        return (
          <div
            key={face}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#09090B]/90 border border-zinc-800 text-xs"
          >
            <span
              className="w-2.5 h-2.5 rounded-[2px] border border-white/20"
              style={{ backgroundColor: meta.hex }}
            />
            <span className="text-zinc-400">{label}:</span>
            <span className="font-medium text-zinc-100">{meta.name}</span>
          </div>
        );
      })}
    </div>
  );
}
