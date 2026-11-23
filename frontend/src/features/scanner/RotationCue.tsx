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
      className="w-full rounded-2xl border border-emerald-400/40 bg-black/80 backdrop-blur p-4 flex gap-4 items-start text-zinc-100"
    >
      <div
        data-testid="rotation-arrow"
        data-direction={guide.arrowDirection}
        aria-hidden="true"
        className={`shrink-0 w-14 h-14 rounded-full bg-emerald-400/15 text-emerald-400 flex items-center justify-center ${anim} motion-reduce:animate-none`}
      >
        <Icon className="w-9 h-9" />
      </div>
      <div className="space-y-1.5 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-emerald-400">Rotate the whole cube</p>
        <p className="font-display font-semibold text-base">{guide.rotationHint}</p>
        {!guide.steps && <p className="text-sm text-zinc-300">{guide.instruction}</p>}
        {guide.steps && (
          <ol className="list-decimal pl-5 text-sm text-zinc-200 space-y-0.5">
            <li>{guide.steps[0]}</li>
            <li>{guide.steps[1]}</li>
          </ol>
        )}
        <p className="text-xs text-zinc-400">Follow the arrow and the reference cube — the app checks colours, not how you hold the cube.</p>
      </div>
    </div>
  );
}
