import * as React from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { RubiksCube3D } from '@/components/three/RubiksCube3D';
import { Button } from '@/components/ui/button';
import { toCubies } from '@/engine/cubie-adapter';
import { playSuccessChime } from '@/lib/audio';
// TEMPORARY bridge — removed in T1.14/T1.17 (only Scan Again / Solve Another Cube use it).
import { useRubikStore } from '@/store/useRubikStore';
import { useCubeStore, type SolutionData } from '@/stores/cube-store';
import { useSessionStore } from '@/stores/session-store';
import { formatDuration } from '@/lib/utils';

/** Returns the follow-up timer id (if any) so the caller can cancel it on unmount. */
function fireRefinedConfetti(intense = false): number | null {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return null;
  }

  const colors = ['#34D399', '#F4F4F6', '#FACC15', '#2563EB', '#DC2626', '#F97316'];

  confetti({
    particleCount: intense ? 95 : 48,
    spread: intense ? 78 : 58,
    origin: { y: 0.62 },
    colors,
    scalar: 0.85,
    ticks: 180,
    gravity: 0.95,
  });

  if (intense) {
    return window.setTimeout(() => {
      confetti({
        particleCount: 55,
        angle: 60,
        spread: 55,
        origin: { x: 0.15, y: 0.65 },
        colors,
        scalar: 0.8,
      });
      confetti({
        particleCount: 55,
        angle: 120,
        spread: 55,
        origin: { x: 0.85, y: 0.65 },
        colors,
        scalar: 0.8,
      });
    }, 220);
  }
  return null;
}

export function CompletionScreen() {
  const solution = useCubeStore((s) => s.solution);
  const setScreen = useSessionStore((s) => s.setScreen);
  if (!solution) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-zinc-300">No solution available for this session.</p>
        <Button size="sm" onClick={() => setScreen('landing')}>
          Back to start
        </Button>
      </div>
    );
  }
  return <CompletionSession solution={solution} />;
}

function CompletionSession({ solution }: { solution: SolutionData }) {
  const mode = useSessionStore((s) => s.mode);
  const guidance = useSessionStore((s) => s.guidance);
  const soundEnabled = useSessionStore((s) => s.settings.soundEnabled);
  const setScreen = useSessionStore((s) => s.setScreen);
  const startFreshScan = useRubikStore((s) => s.startFreshScan);
  const [userConfirmedSolved, setUserConfirmedSolved] = React.useState(false);
  const confettiTimer = React.useRef<number | null>(null);
  React.useEffect(
    () => () => {
      if (confettiTimer.current !== null) window.clearTimeout(confettiTimer.current);
    },
    [],
  );

  const finalCubies = React.useMemo(
    () => toCubies(solution.snapshots[solution.snapshots.length - 1], solution.centers),
    [solution],
  );
  const total = solution.moves.length;
  const isDemo = mode === 'demo';

  const handleConfirmSolved = () => {
    if (userConfirmedSolved) return;
    setUserConfirmedSolved(true);
    playSuccessChime(soundEnabled);
    confettiTimer.current = fireRefinedConfetti(true);
  };

  const displayTime = guidance ? formatDuration(Math.round(guidance.playbackMs / 1000)) : '—';

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <WorkspaceHeader
        activeStage="solve"
        rightSlot={
          <span className="font-mono text-xs text-emerald-400 tabular-nums">
            100% Complete
          </span>
        }
      />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left: Solved 3D Rubik's Cube Studio Showcase */}
          <section className="lg:col-span-6">
            <div className="relative rounded-2xl bg-[#111113] border border-zinc-800/80 aspect-[4/3] sm:aspect-square max-h-[480px] w-full overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: userConfirmedSolved
                    ? 'radial-gradient(circle at 50% 50%, rgba(52,211,153,0.18) 0%, transparent 66%)'
                    : 'radial-gradient(circle at 50% 50%, rgba(52,211,153,0.09) 0%, transparent 66%)',
                }}
              />
              <RubiksCube3D
                cubies={finalCubies}
                mode="solved"
                cameraPosition={[5.8, 4.3, 6.3]}
                className="relative z-10 w-full h-full"
              />
              <div className="absolute bottom-4 inset-x-4 z-20 flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Digital twin</span>
                <span className="text-emerald-400">Digital twin: solved</span>
              </div>
            </div>
          </section>

          {/* Right: Summary, Physical Verification & Actions */}
          <section className="lg:col-span-6 space-y-7">
            <div className="space-y-3">
              <p className="font-mono text-xs text-emerald-400 uppercase tracking-wider">
                {userConfirmedSolved
                  ? 'Solve Confirmed'
                  : isDemo
                    ? 'Demo guidance complete'
                    : 'Guidance Complete'}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50">
                {userConfirmedSolved
                  ? 'You confirmed your cube is solved'
                  : 'You’ve completed the guidance!'}
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
                {userConfirmedSolved
                  ? 'Every face is back to a single solid color. Ready to challenge yourself with another scramble?'
                  : 'Take a quick look at all six sides of your physical Rubik’s Cube to check that every face is completely solved.'}
              </p>
              {isDemo && (
                <p className="text-sm text-zinc-500 leading-relaxed">
                  This was a demo cube with a pre-computed solution.
                </p>
              )}
            </div>

            {/* Tabular Completion Metrics */}
            <div className="grid grid-cols-3 gap-4 py-5 border-y border-zinc-800/80">
              <div>
                <span className="text-xs text-zinc-500 block">Total Moves</span>
                <span className="mt-1 block font-mono text-2xl font-semibold text-zinc-100 tabular-nums">
                  {total}
                </span>
              </div>
              <div>
                <span
                  className="text-xs text-zinc-500 block"
                  title="Time the on-screen guidance ran. It is not the time to solve a physical cube."
                >
                  Guidance Time
                </span>
                <span className="mt-1 block font-mono text-2xl font-semibold text-zinc-100 tabular-nums">
                  {displayTime}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Progress</span>
                <span className="mt-1 block font-mono text-2xl font-semibold text-emerald-400 tabular-nums">
                  100%
                </span>
              </div>
            </div>

            {/* Verification & Next Actions */}
            {!userConfirmedSolved ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-200">
                  Does your physical cube match the solved cube on screen?
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" onClick={handleConfirmSolved}>
                    <CheckCircle2 className="h-4 w-4" />
                    My Cube Is Solved
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => startFreshScan(true)}
                  >
                    <Camera className="h-4 w-4" />
                    Scan Again
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setScreen('alignment')}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Replay Solution
                  </button>
                  <span className="text-zinc-700" aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => startFreshScan(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Solve Another Cube
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl bg-emerald-400/10 border border-emerald-400/35 p-4 flex items-center gap-3 text-sm text-emerald-200">
                  <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span>
                    You confirmed all 54 stickers are solved after {total} moves.
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" onClick={() => startFreshScan(true)}>
                    <Camera className="h-4 w-4" />
                    Solve Another Cube
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => setScreen('alignment')}>
                    <RotateCcw className="h-4 w-4" />
                    Replay Solution
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => startFreshScan(false)}
                  >
                    Scan Again
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
