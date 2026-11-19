import * as React from 'react';
import {
  AlertCircle,
  Camera,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BrandMark } from '@/src/components/BrandMark';
import { RubiksCube3D } from '@/src/components/three/RubiksCube3D';
import { Button } from '@/src/components/ui/button';
import { Slider } from '@/src/components/ui/slider';
import { Dialog } from '@/src/components/ui/dialog';
import {
  FACE_META,
  STICKER_COLORS,
  getCenterColorForFace,
  getCubeStateAtStep,
  parseMove,
} from '@/src/lib/cubeEngine';
import { useRubikStore } from '@/src/store/useRubikStore';
import {
  cn,
  playCountdownTick,
  playMoveSound,
  playSuccessChime,
} from '@/src/lib/utils';

type StepPhase = 'animating' | 'countdown' | 'replaying' | 'finishing';

export function SolvingScreen() {
  const {
    initialCube,
    solution,
    currentStepIndex,
    isPlaying,
    moveDelaySeconds,
    soundEnabled,
    cameraResetToken,
    setScreen,
    setCurrentStepIndex,
    setIsPlaying,
    setMoveDelaySeconds,
    toggleSound,
    incrementSolveElapsed,
    startFreshScan,
    triggerCameraReset,
  } = useRubikStore();

  const totalSteps = solution.length;
  const clampedStep = Math.max(0, Math.min(currentStepIndex, totalSteps - 1));
  const currentMoveNotation = solution[clampedStep];
  const prevMoveNotation = clampedStep > 0 ? solution[clampedStep - 1] : null;
  const nextMoveNotation = clampedStep < totalSteps - 1 ? solution[clampedStep + 1] : null;

  const activeMove = React.useMemo(
    () => (currentMoveNotation ? parseMove(currentMoveNotation) : null),
    [currentMoveNotation]
  );

  const preMoveCubies = React.useMemo(
    () => getCubeStateAtStep(initialCube, solution, clampedStep),
    [initialCube, solution, clampedStep]
  );

  const postMoveCubies = React.useMemo(
    () => getCubeStateAtStep(initialCube, solution, clampedStep + 1),
    [initialCube, solution, clampedStep]
  );

  const isFinalStep = clampedStep === totalSteps - 1;

  const [phase, setPhase] = React.useState<StepPhase>('animating');
  const [phaseStep, setPhaseStep] = React.useState<number>(clampedStep);
  const [animTrigger, setAnimTrigger] = React.useState(1);
  const [countdownMs, setCountdownMs] = React.useState(moveDelaySeconds * 1000);
  const [lostSyncOpen, setLostSyncOpen] = React.useState(false);
  const [cameraLocked, setCameraLocked] = React.useState(true);

  // Fixed canonical solving viewpoint: Green (+Z) in front, White (+Y) on top, Red (+X) on right, pulled comfortably back
  const fixedSolvingCameraPos = React.useMemo<[number, number, number]>(
    () => [5.2, 4.3, 7.6],
    []
  );

  const lastTickSecondRef = React.useRef<number>(moveDelaySeconds);
  const finishAfterAnimRef = React.useRef<boolean>(false);

  // Elapsed solving session timer
  React.useEffect(() => {
    if (!isPlaying || lostSyncOpen || phase === 'finishing') return;
    const t = window.setInterval(() => {
      incrementSolveElapsed();
    }, 1000);
    return () => window.clearInterval(t);
  }, [isPlaying, lostSyncOpen, phase, incrementSolveElapsed]);

  // Whenever currentStepIndex changes, animate the new move cleanly from preMoveCubies
  React.useEffect(() => {
    finishAfterAnimRef.current = false;
    setPhase('animating');
    setPhaseStep(clampedStep);
    setCountdownMs(moveDelaySeconds * 1000);
    lastTickSecondRef.current = moveDelaySeconds;
    setAnimTrigger((n) => n + 1);
    playMoveSound(soundEnabled);
  }, [clampedStep]);

  // Sync countdown max if user adjusts delay slider while in countdown
  React.useEffect(() => {
    if (phase === 'countdown') {
      setCountdownMs((prev) => Math.min(prev, moveDelaySeconds * 1000));
    }
  }, [moveDelaySeconds, phase]);

  // Smooth countdown timer after move finishes animating
  React.useEffect(() => {
    if (phase !== 'countdown' || phaseStep !== clampedStep || !isPlaying || lostSyncOpen) return;

    const tickInterval = 100;
    const timer = window.setInterval(() => {
      setCountdownMs((prev) => {
        const next = Math.max(0, prev - tickInterval);
        const secCeil = Math.ceil(next / 1000);
        if (secCeil < lastTickSecondRef.current && secCeil > 0 && secCeil <= 3) {
          lastTickSecondRef.current = secCeil;
          playCountdownTick(soundEnabled, secCeil === 1);
        }
        return next;
      });
    }, tickInterval);

    return () => window.clearInterval(timer);
  }, [phase, phaseStep, clampedStep, isPlaying, lostSyncOpen, soundEnabled]);

  const enterFinishingBeat = React.useCallback(() => {
    setPhase('finishing');
    playSuccessChime(soundEnabled);
  }, [soundEnabled]);

  // Brief celebratory pause showing the freshly solved 3D cube before navigating to Completion
  React.useEffect(() => {
    if (phase !== 'finishing') return;
    const t = window.setTimeout(() => {
      setScreen('completion');
    }, 900);
    return () => window.clearTimeout(t);
  }, [phase, setScreen]);

  // Auto-advance ONLY when the countdown belonging to the CURRENT step reaches zero
  React.useEffect(() => {
    if (
      phase === 'countdown' &&
      phaseStep === clampedStep &&
      countdownMs <= 0 &&
      isPlaying &&
      !lostSyncOpen
    ) {
      if (isFinalStep) {
        enterFinishingBeat();
      } else {
        setPhase('animating');
        setCountdownMs(moveDelaySeconds * 1000);
        setCurrentStepIndex(clampedStep + 1);
      }
    }
  }, [
    phase,
    phaseStep,
    countdownMs,
    isPlaying,
    lostSyncOpen,
    clampedStep,
    isFinalStep,
    moveDelaySeconds,
    setCurrentStepIndex,
    enterFinishingBeat,
  ]);

  const handleMoveAnimationComplete = React.useCallback(() => {
    if (finishAfterAnimRef.current && isFinalStep) {
      finishAfterAnimRef.current = false;
      enterFinishingBeat();
      return;
    }
    setPhase('countdown');
    setPhaseStep(clampedStep);
    setCountdownMs(moveDelaySeconds * 1000);
    lastTickSecondRef.current = moveDelaySeconds;
  }, [clampedStep, isFinalStep, moveDelaySeconds, enterFinishingBeat]);

  const handleReplayMove = () => {
    if (phase === 'finishing') return;
    finishAfterAnimRef.current = false;
    setPhase('replaying');
    setPhaseStep(clampedStep);
    setCountdownMs(moveDelaySeconds * 1000);
    lastTickSecondRef.current = moveDelaySeconds;
    setAnimTrigger((n) => n + 1);
    playMoveSound(soundEnabled);
  };

  const handlePrevStep = () => {
    if (phase === 'finishing') return;
    if (clampedStep > 0) {
      setPhase('animating');
      setCountdownMs(moveDelaySeconds * 1000);
      setCurrentStepIndex(clampedStep - 1);
    }
  };

  const handleNextStep = () => {
    if (phase === 'finishing') return;
    if (isFinalStep) {
      // Never cut off the final move mid-animation: finish rotating first, then celebrate & transition
      if (phase === 'animating' || phase === 'replaying') {
        finishAfterAnimRef.current = true;
      } else {
        enterFinishingBeat();
      }
    } else {
      setPhase('animating');
      setCountdownMs(moveDelaySeconds * 1000);
      setCurrentStepIndex(clampedStep + 1);
    }
  };

  // Displayed cubies: show preMoveCubies while animating/replaying, postMoveCubies during countdown & finishing
  const displayedCubies =
    phase === 'countdown' || phase === 'finishing' ? postMoveCubies : preMoveCubies;

  const progressPct =
    ((clampedStep + (phase === 'countdown' || phase === 'finishing' ? 1 : 0.35)) / totalSteps) * 100;
  const countdownRatio = Math.max(0, Math.min(1, countdownMs / (moveDelaySeconds * 1000)));
  const countdownDisplaySec = Math.ceil(countdownMs / 1000);

  // Circular SVG ring math
  const ringRadius = 36;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - (phase === 'countdown' ? countdownRatio : 1));

  const activeFaceKey = activeMove?.face ?? 'R';
  const activeCenterColor = getCenterColorForFace(preMoveCubies, activeFaceKey);
  const activeCenterMeta = STICKER_COLORS[activeCenterColor];
  const activeFaceName = FACE_META[activeFaceKey].fullName;

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

          <div className="font-mono text-xs sm:text-sm text-zinc-200 tabular-nums">
            Step <span className="text-emerald-400 font-semibold">{clampedStep + 1}</span> of{' '}
            {totalSteps}
          </div>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setLostSyncOpen(true);
            }}
            className="text-xs text-zinc-400 hover:text-zinc-100 underline decoration-zinc-700 hover:decoration-zinc-400 underline-offset-4 transition-colors cursor-pointer whitespace-nowrap"
          >
            Lost track? Scan again.
          </button>
        </div>

        {/* Sleek Top Progress Line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900">
          <div
            className="h-full bg-emerald-400 transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
      </header>

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

        {/* Top HUD Strip: Move Sequence & Natural Language (left) + Circular Countdown Timer (right) */}
        <div className="relative z-10 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4 pointer-events-none">
          {/* Move Information Panel (Solid dark surface — zero backdrop-blur over WebGL) */}
          <div className="pointer-events-auto rounded-2xl bg-[#111113]/95 border border-zinc-800/90 px-5 py-4 max-w-md w-full sm:w-auto shadow-xl">
            {/* Prev · Current · Next Move Strip */}
            <div className="flex items-baseline gap-5">
              <div className="text-center min-w-[44px]">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Prev
                </span>
                <span className="font-mono text-base text-zinc-500 tabular-nums">
                  {prevMoveNotation ?? '—'}
                </span>
              </div>

              <div className="h-7 w-px bg-zinc-800" aria-hidden="true" />

              <div className="text-center min-w-[60px]">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                  Current
                </span>
                <span className="font-mono text-3xl sm:text-4xl font-semibold text-zinc-50 leading-none tracking-tight">
                  {currentMoveNotation}
                </span>
              </div>

              <div className="h-7 w-px bg-zinc-800" aria-hidden="true" />

              <div className="text-center min-w-[44px]">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Next
                </span>
                <span className="font-mono text-base text-zinc-300 tabular-nums">
                  {nextMoveNotation ?? 'Done'}
                </span>
              </div>
            </div>

            {/* Natural Language Instruction + Center Color Reference */}
            <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5">
              <p className="text-sm sm:text-base font-medium text-zinc-100">
                {activeMove?.naturalLanguage}
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span
                  className="w-3 h-3 rounded-[3px] border border-white/25 shrink-0"
                  style={{ backgroundColor: activeCenterMeta.hex }}
                />
                <span>
                  {activeCenterMeta.name} center · {activeFaceName} face
                </span>
              </div>
            </div>
          </div>

          {/* Large Circular Countdown Timer */}
          <div className="pointer-events-auto rounded-2xl bg-[#111113]/95 border border-zinc-800/90 px-4 py-3 flex items-center gap-4 shadow-xl self-end sm:self-auto">
            <div className="relative w-[84px] h-[84px] flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 84 84">
                <circle
                  cx="42"
                  cy="42"
                  r={ringRadius}
                  fill="none"
                  stroke="#27272A"
                  strokeWidth="4.5"
                />
                <circle
                  cx="42"
                  cy="42"
                  r={ringRadius}
                  fill="none"
                  stroke={!isPlaying ? '#71717A' : '#34D399'}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashOffset}
                  className="transition-[stroke-dashoffset] duration-100 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-semibold text-zinc-50 tabular-nums leading-none">
                  {phase === 'finishing'
                    ? 'Done'
                    : phase === 'animating' || phase === 'replaying'
                      ? activeMove?.notation
                      : `${countdownDisplaySec}s`}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 mt-1">
                  {phase === 'finishing'
                    ? 'Solved'
                    : !isPlaying
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
                  : !isPlaying
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
                  : !isPlaying
                    ? 'Press Play when ready to continue.'
                    : phase === 'countdown'
                      ? isFinalStep
                        ? 'Completes when timer finishes.'
                        : 'Advances automatically when timer finishes.'
                      : 'Highlight shows the rotating layer.'}
              </p>
            </div>
          </div>
        </div>

        {/* Unobstructed Central Interactive 3D Cube Viewport */}
        <div className="absolute inset-0 z-0">
          <RubiksCube3D
            cubies={displayedCubies}
            mode={phase === 'finishing' ? 'solved' : 'solving'}
            activeMove={phase === 'finishing' ? null : activeMove}
            animateMoveTrigger={animTrigger}
            animationDuration={0.78}
            onMoveAnimationComplete={handleMoveAnimationComplete}
            cameraResetToken={cameraResetToken}
            cameraPosition={fixedSolvingCameraPos}
            autoRepositionCamera={false}
            lockCameraAngle={cameraLocked}
            showMoveArrow={phase !== 'finishing'}
            fov={34}
            className="w-full h-full"
          />
        </div>

        {/* Unified Bottom Control Dock (Zero Viewport Occlusion) */}
        <div className="relative z-10 mt-auto pb-5 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[820px] rounded-2xl bg-[#111113]/95 border border-zinc-800/90 px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            {/* Playback & Replay Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevStep}
                disabled={clampedStep === 0}
                aria-label="Previous move"
                title="Previous move"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="min-w-[96px]"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleReplayMove}
                title="Replay current move"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Replay
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNextStep}
                aria-label="Next move"
                title="Next move"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Adjustable Delay Speed Slider (2s - 15s) */}
            <div className="flex items-center gap-3 flex-1 min-w-[170px] max-w-[260px] px-1">
              <span className="text-xs text-zinc-400 whitespace-nowrap">Pace</span>
              <Slider
                value={moveDelaySeconds}
                min={2}
                max={15}
                onChange={setMoveDelaySeconds}
                ariaLabel="Solving delay in seconds"
              />
              <span className="font-mono text-xs text-emerald-400 tabular-nums w-7 text-right">
                {moveDelaySeconds}s
              </span>
            </div>

            {/* Utility Controls: Fixed Angle Lock & Sound Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={cameraLocked ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => {
                  const nextLocked = !cameraLocked;
                  setCameraLocked(nextLocked);
                  if (nextLocked) {
                    triggerCameraReset();
                  }
                }}
                title={
                  cameraLocked
                    ? 'Fixed view locked (Green Front · White Top · Red Right). Click to orbit freely.'
                    : 'Free orbit enabled. Click to lock back to Green Front · White Top · Red Right.'
                }
              >
                {cameraLocked ? (
                  <Lock className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 text-zinc-400" />
                )}
                <span className="hidden md:inline">
                  {cameraLocked ? 'Angle Locked' : 'Free Orbit'}
                </span>
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={toggleSound}
                aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                title={soundEnabled ? 'Sound on' : 'Sound muted'}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-zinc-500" />
                )}
              </Button>
            </div>
          </div>
        </div>
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
              If you only missed the last turn, step back and replay it. If your cube looks
              completely different from the 3D twin, rescanning takes ~15 seconds and generates a
              brand-new solution from your cube’s current state.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLostSyncOpen(false);
                if (clampedStep > 0) setCurrentStepIndex(clampedStep - 1);
                handleReplayMove();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Step Back & Replay
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setLostSyncOpen(false);
                startFreshScan(true);
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
