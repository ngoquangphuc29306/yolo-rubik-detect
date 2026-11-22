import * as React from 'react';
import { AlertCircle, Camera, CameraOff, RotateCcw } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { ModeBanner } from '@/components/ModeBanner';
import { RubiksCube3D } from '@/components/three/RubiksCube3D';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { animationProgress } from '@/engine/playback-fsm';
import { toCubies } from '@/engine/cubie-adapter';
import { parseMove } from '@/engine/move-presentation';
import { usePlayback } from '@/hooks/usePlayback';
import { COLOR_META } from '@/lib/colors';
import { useCubeStore, type SolutionData } from '@/stores/cube-store';
import { startDemoScan } from '@/stores/demo-session';
import { useSessionStore } from '@/stores/session-store';
import { CountdownRing, type RingPhase } from './CountdownRing';
import { MoveInfoPanel } from './MoveInfoPanel';
import { OrientationCue } from './OrientationCue';
import { PlaybackDock } from './PlaybackDock';

/** Beat showing the solved cube before Completion (kept from the legacy screen). */
const FINISHING_BEAT_MS = 900;

// Fixed canonical solving viewpoint: Front (+Z) in front, Top (+Y) on top, Right (+X) on right, pulled comfortably back.
const FIXED_SOLVING_CAMERA_POS: [number, number, number] = [5.2, 4.3, 7.6];

// Identity of a solution object, used as a React key so a new solution always remounts the renderer.
const solutionIds = new WeakMap<object, number>();
let nextSolutionId = 1;
function solutionKey(solution: SolutionData): number {
  let id = solutionIds.get(solution);
  if (id === undefined) {
    id = nextSolutionId++;
    solutionIds.set(solution, id);
  }
  return id;
}

export function SolvingScreen() {
  const solution = useCubeStore((s) => s.solution);
  if (!solution) {
    // Defensive: entered without a verified solution (never expected after Alignment).
    return (
      <div className="h-screen min-h-[680px] bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-zinc-300">No verified solution is available for this session.</p>
        <Button size="sm" onClick={() => useSessionStore.getState().setScreen('landing')}>
          Back to start
        </Button>
      </div>
    );
  }
  return <SolvingSession key={solutionKey(solution)} solution={solution} />;
}

function SolvingSession({ solution }: { solution: SolutionData }) {
  const { centers } = solution;
  const total = solution.moves.length;

  const delayMs = useSessionStore((s) => s.settings.delayMs);
  const soundEnabled = useSessionStore((s) => s.settings.soundEnabled);
  const setScreen = useSessionStore((s) => s.setScreen);
  const setDelayMs = useSessionStore((s) => s.setDelayMs);
  const toggleSound = useSessionStore((s) => s.toggleSound);
  const setGuidance = useSessionStore((s) => s.setGuidance);

  // Derived once per solution identity: never per frame.
  const prepared = React.useMemo(
    () => ({
      snapshots: solution.snapshots.map((s) => toCubies(s, centers)),
      activeMoves: solution.moves.map((m) => parseMove(m)),
    }),
    [solution, centers],
  );

  const { state, frameRef, controls } = usePlayback({
    moves: solution.moves,
    delayMs,
    soundEnabled,
    enabled: true,
  });

  // The deliberate Start click already happened on Alignment: start exactly once on mount.
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    controls.start();
  }, [controls]);

  const [lostSyncOpen, setLostSyncOpen] = React.useState(false);
  const [cameraLocked, setCameraLocked] = React.useState(true);
  const [cameraResetToken, setCameraResetToken] = React.useState(0);

  // Completion: the final wait has finished (never skipped). Show the finishing beat, then navigate.
  // Cancelled on unmount (Scan again) and guarded by the playback-run generation.
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const complete = state.status === 'complete' && total > 0;
  React.useEffect(() => {
    if (!complete) return;
    const gen = stateRef.current.generation;
    setGuidance(stateRef.current.playbackMs);
    const t = window.setTimeout(() => {
      const s = stateRef.current;
      if (s.generation !== gen || s.status !== 'complete') return;
      setScreen('completion');
    }, FINISHING_BEAT_MS);
    return () => window.clearTimeout(t);
  }, [complete, state.generation, setGuidance, setScreen]);

  const paused = state.status === 'paused';
  const pausedFromWait = paused && state.pausedFrom === 'waiting';
  const inWait = state.status === 'waiting' || pausedFromWait;
  const isFinalStep = state.index === total - 1;
  const phase: RingPhase = complete
    ? 'finishing'
    : inWait
      ? 'countdown'
      : state.isReplay
        ? 'replaying'
        : 'animating';

  const waitRemainingMs = inWait ? Math.max(0, state.waitTotalMs - state.waitElapsedMs) : 0;
  const countdownRatio = inWait && state.waitTotalMs > 0 ? waitRemainingMs / state.waitTotalMs : 0;
  const animFraction = inWait || state.status === 'complete' ? 1 : animationProgress(state);
  const progressPct = total > 0 ? Math.min(100, ((state.index + animFraction) / total) * 100) : 0;

  const currentNotation = solution.moves[state.index];
  const activeMove = prepared.activeMoves[state.index];

  const lockTitle = (() => {
    const colors = `${COLOR_META[centers.F].name} Front · ${COLOR_META[centers.U].name} Top · ${COLOR_META[centers.R].name} Right`;
    return cameraLocked
      ? `Fixed view locked (${colors}). Click to orbit freely.`
      : `Free orbit enabled. Click to lock back to ${colors}.`;
  })();

  const openLostSync = () => {
    controls.pause();
    setLostSyncOpen(true);
  };

  const finishEmpty = () => {
    setGuidance(null); // no guidance ran: Completion shows "—"
    setScreen('completion');
  };

  return (
    <div className="h-screen min-h-[680px] bg-[#09090B] text-zinc-100 flex flex-col overflow-hidden">
      {/* Top Bar: AI Solving Coach · Camera Off · Step Progress */}
      <header className="relative z-20 w-full h-16 px-4 sm:px-6 lg:px-8 border-b border-zinc-800/80 bg-[#09090B] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <BrandMark onClick={() => setScreen('landing')} />
          <span className="hidden sm:inline text-zinc-700" aria-hidden="true">
            /
          </span>
          <span className="hidden sm:inline text-sm font-medium text-zinc-300 truncate">
            AI Solving Coach
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          {/* Camera Off status (static, explicit — never implies AI is watching) */}
          <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-zinc-400">
            <CameraOff className="h-3.5 w-3.5 text-zinc-500" />
            <span>Camera Off</span>
          </div>

          {total > 0 && (
            <div
              data-testid="step-counter"
              className="font-mono text-xs sm:text-sm text-zinc-200 tabular-nums"
            >
              Step <span className="text-emerald-400 font-semibold">{state.index + 1}</span> of{' '}
              {total}
            </div>
          )}

          {total > 0 && (
            <button
              type="button"
              onClick={openLostSync}
              className="text-xs text-zinc-400 hover:text-zinc-100 underline decoration-zinc-700 hover:decoration-zinc-400 underline-offset-4 transition-colors cursor-pointer whitespace-nowrap"
            >
              Lost track? Scan again.
            </button>
          )}
        </div>

        {/* Sleek Top Progress Line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900">
          <div
            data-testid="progress-fill"
            className="h-full bg-emerald-400 transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>
      <ModeBanner />

      {/* Main Spacious 3D Stage */}
      <main className="relative flex-1 w-full overflow-hidden flex flex-col">
        {/* Subtle studio radial ambient backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 48%, rgba(39,39,42,0.34) 0%, rgba(9,9,11,1) 66%)',
          }}
        />

        {/* Top HUD Strip: Move Sequence & Natural Language (left) + orientation cue + Circular Countdown Timer (right) */}
        <div className="relative z-10 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4 pointer-events-none">
          {total > 0 && currentNotation && activeMove ? (
            <>
              <MoveInfoPanel
                prevNotation={solution.moves[state.index - 1] ?? null}
                currentNotation={currentNotation}
                nextNotation={solution.moves[state.index + 1] ?? null}
                move={activeMove}
                centerColor={centers[activeMove.face]}
              />
              <OrientationCue centers={centers} />
              <CountdownRing
                phase={phase}
                paused={paused}
                isFinalStep={isFinalStep}
                notation={currentNotation}
                countdownSec={Math.ceil(waitRemainingMs / 1000)}
                countdownRatio={countdownRatio}
              />
            </>
          ) : (
            <>
              <div className="pointer-events-auto rounded-2xl bg-[#111113]/95 border border-zinc-800/90 px-5 py-4 max-w-md w-full sm:w-auto shadow-xl space-y-3">
                <p className="text-base font-medium text-zinc-100">Already solved</p>
                <p className="text-sm text-zinc-400">
                  Your cube is already solved, so there are no moves to perform.
                </p>
                <Button size="sm" onClick={finishEmpty}>
                  Finish
                </Button>
              </div>
              <OrientationCue centers={centers} />
            </>
          )}
        </div>

        {/* Unobstructed Central Interactive 3D Cube Viewport */}
        <div className="absolute inset-0 z-0">
          <RubiksCube3D
            key={solutionKey(solution)}
            cubies={prepared.snapshots[0] ?? []}
            snapshots={prepared.snapshots}
            activeMoves={prepared.activeMoves}
            frameRef={frameRef}
            mode={complete ? 'solved' : 'solving'}
            cameraResetToken={cameraResetToken}
            cameraPosition={FIXED_SOLVING_CAMERA_POS}
            autoRepositionCamera={false}
            lockCameraAngle={cameraLocked}
            showMoveArrow={!complete}
            fov={34}
            className="w-full h-full"
          />
        </div>

        {total > 0 && (
          <PlaybackDock
            paused={paused}
            pauseDisabled={complete}
            onTogglePause={() => (paused ? controls.resume() : controls.pause())}
            onReplay={controls.replay}
            delaySeconds={delayMs / 1000}
            onDelayChange={(seconds) => setDelayMs(seconds * 1000)}
            cameraLocked={cameraLocked}
            onToggleLock={() => {
              const nextLocked = !cameraLocked;
              setCameraLocked(nextLocked);
              if (nextLocked) setCameraResetToken((n) => n + 1);
            }}
            lockTitle={lockTitle}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
          />
        )}
      </main>

      {/* Lost Synchronization / Recovery Dialog */}
      <Dialog
        open={lostSyncOpen}
        onClose={() => setLostSyncOpen(false)}
        title="Lost track of your cube?"
        description="Because the camera stays off during solving, your physical cube can occasionally get one move out of sync with the 3D coach."
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-[#09090B] border border-zinc-800 p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-300 leading-relaxed">
              If you only missed the current turn, replay it. If your cube looks completely
              different from the 3D twin, rescanning takes ~15 seconds and generates a brand-new
              solution from your cube’s current state.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                controls.replay();
                setLostSyncOpen(false);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Replay current move
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setLostSyncOpen(false);
                startDemoScan(true);
              }}
            >
              <Camera className="h-3.5 w-3.5" />
              Scan My Cube Again
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
