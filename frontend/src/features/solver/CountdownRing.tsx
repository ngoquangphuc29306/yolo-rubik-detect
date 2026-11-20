export type RingPhase = 'animating' | 'countdown' | 'replaying' | 'finishing';

interface CountdownRingProps {
  phase: RingPhase;
  paused: boolean;
  isFinalStep: boolean;
  /** Notation of the move being demonstrated. */
  notation: string;
  /** Whole seconds left in the wait (meaningful in the countdown phase). */
  countdownSec: number;
  /** Fraction of the CURRENT wait remaining, 0..1 (fixed total: a pace change never rescales it). */
  countdownRatio: number;
}

// Circular SVG ring math
const ringRadius = 36;
const ringCircumference = 2 * Math.PI * ringRadius;

/** Large circular countdown timer card. */
export function CountdownRing({
  phase,
  paused,
  isFinalStep,
  notation,
  countdownSec,
  countdownRatio,
}: CountdownRingProps) {
  const ringDashOffset = ringCircumference * (1 - (phase === 'countdown' ? countdownRatio : 1));

  return (
    <div className="pointer-events-auto rounded-2xl bg-[#111113]/95 border border-zinc-800/90 px-4 py-3 flex items-center gap-4 shadow-xl self-end sm:self-auto">
      <div className="relative w-[84px] h-[84px] flex items-center justify-center shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={ringRadius} fill="none" stroke="#27272A" strokeWidth="4.5" />
          <circle
            data-testid="ring-progress"
            cx="42"
            cy="42"
            r={ringRadius}
            fill="none"
            stroke={paused ? '#71717A' : '#34D399'}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringDashOffset}
            className="transition-[stroke-dashoffset] duration-100 ease-linear"
          />
        </svg>
        <div
          data-testid="ring-center"
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="font-mono text-xl font-semibold text-zinc-50 tabular-nums leading-none">
            {phase === 'finishing'
              ? 'Done'
              : phase === 'animating' || phase === 'replaying'
                ? notation
                : `${countdownSec}s`}
          </span>
          <span data-testid="ring-label" className="text-[10px] font-mono text-zinc-400 mt-1">
            {phase === 'finishing'
              ? 'Solved'
              : paused
                ? 'Paused'
                : phase === 'replaying'
                  ? 'Replay'
                  : phase === 'animating'
                    ? 'Demo'
                    : isFinalStep
                      ? 'Finish in'
                      : 'Next in'}
          </span>
        </div>
      </div>

      <div className="pr-1 hidden sm:block">
        <p className="text-xs font-medium text-zinc-200">
          {phase === 'finishing'
            ? 'Final move completed!'
            : paused
              ? 'Session paused'
              : phase === 'replaying'
                ? 'Replaying current move'
                : phase === 'animating'
                  ? isFinalStep
                    ? 'Watch final 3D rotation'
                    : 'Watch 3D rotation'
                  : isFinalStep
                    ? 'Perform final move on your cube'
                    : 'Perform move on your cube'}
        </p>
        <p className="mt-1 text-xs text-zinc-500 max-w-[140px] leading-snug">
          {phase === 'finishing'
            ? 'Opening completion summary...'
            : paused
              ? 'Press Resume when ready to continue.'
              : phase === 'countdown'
                ? isFinalStep
                  ? 'Completes when timer finishes.'
                  : 'Advances automatically when timer finishes.'
                : 'Highlight shows the rotating layer.'}
        </p>
      </div>
    </div>
  );
}
