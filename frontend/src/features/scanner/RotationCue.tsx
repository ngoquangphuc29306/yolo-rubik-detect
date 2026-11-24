// Pure presentational caption for the arrow shown on the preview, rendered as a block below the video frame
// (outside the mirrored layers, so its text always reads normally). It names the expected centre colour only;
// the app checks colours, not how the cube is held.
import { Hand } from 'lucide-react';
import { stepCaption, isReturnStep, type RotationStep } from '@/lib/rotation-steps';
import type { FaceId } from '@/types/cube';

export interface RotationCueProps {
  step: RotationStep;
  /** The stage the scan will capture next. */
  stage: FaceId;
  /** True right after a capture (phase "rotating"). */
  saved: boolean;
}

export function RotationCue({ step, stage, saved }: RotationCueProps) {
  const { line, target } = stepCaption(step);
  return (
    <div
      role="status"
      data-next-face={stage}
      data-step={step.step}
      className="w-full rounded-2xl border border-emerald-400/40 bg-black/80 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-3 text-zinc-100"
    >
      <div aria-hidden="true" className="shrink-0 w-10 h-10 rounded-full bg-emerald-400/15 text-emerald-400 flex items-center justify-center">
        <Hand className="w-5 h-5" />
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] uppercase tracking-wider text-emerald-400">
          {saved ? 'Saved. ' : ''}Rotate the whole cube along the arrow.
        </p>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display font-semibold text-sm">{line}</span>
          <span className="text-xs text-zinc-300">{target}</span>
        </p>
        {isReturnStep(step.step) && <p className="text-xs text-zinc-300">No scan on this step.</p>}
        <p className="text-[11px] text-zinc-400">
          Follow the arrow on the preview — the app checks colours, not how you hold the cube.
        </p>
      </div>
    </div>
  );
}
