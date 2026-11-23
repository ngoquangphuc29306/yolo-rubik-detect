// Pure presentational cue shown after a capture, rendered as a block below the video frame (never over the guide): how to rotate the ENTIRE cube to the next face.
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Hand } from 'lucide-react';
import type { ScanGuide } from './scan-guide';
import type { FaceId } from '@/types/cube';

export interface RotationCueProps {
  guide: ScanGuide;
  nextFace: FaceId;
}

const ARROWS = {
  left: { Icon: ArrowLeft, anim: 'animate-arrow-left' },
  right: { Icon: ArrowRight, anim: 'animate-arrow-right' },
  up: { Icon: ArrowUp, anim: 'animate-arrow-up' },
  down: { Icon: ArrowDown, anim: 'animate-arrow-down' },
  none: { Icon: Hand, anim: 'animate-arrow-pulse' },
} as const;

export function RotationCue({ guide, nextFace }: RotationCueProps) {
  const { Icon, anim } = ARROWS[guide.arrowDirection];
  return (
    <div
      role="status"
      data-next-face={nextFace}
      className="w-full rounded-2xl border border-emerald-400/40 bg-black/80 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-3 text-zinc-100"
    >
      <div
        data-testid="rotation-arrow"
        data-direction={guide.arrowDirection}
        aria-hidden="true"
        className={`shrink-0 w-10 h-10 rounded-full bg-emerald-400/15 text-emerald-400 flex items-center justify-center ${anim} motion-reduce:animate-none`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-[11px] uppercase tracking-wider text-emerald-400">
            Saved. Rotate the whole cube to the next face.
          </span>
          <span className="font-display font-semibold text-sm">{guide.rotationHint}</span>
        </p>
        {!guide.steps && <p className="text-xs text-zinc-300">{guide.instruction}</p>}
        {guide.steps && (
          <ol className="list-decimal pl-5 text-xs text-zinc-200 flex flex-col sm:flex-row sm:gap-x-6">
            <li>{guide.steps[0]}</li>
            <li>{guide.steps[1]}</li>
          </ol>
        )}
        <p className="text-[11px] text-zinc-400">Follow the arrow and the reference cube — the app checks colours, not how you hold the cube.</p>
      </div>
    </div>
  );
}
