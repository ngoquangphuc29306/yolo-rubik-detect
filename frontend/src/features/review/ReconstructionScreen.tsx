import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { FaceGrid2D } from '@/components/FaceGrid2D';
import { RubiksCube3D } from '@/components/three/RubiksCube3D';
import { Button } from '@/components/ui/button';
import { demoInvalidStateError } from '@/demo/demo-errors';
import { toCubies } from '@/engine/cubie-adapter';
import { colorNameToCode, type StickerCode } from '@/lib/colors';
import { useSolveSession } from '@/hooks/useSolveSession';
// TEMPORARY bridge (removed in T1.17): fresh demo scan still goes through the legacy store.
import { useRubikStore } from '@/store/useRubikStore';
import { useCubeStore } from '@/stores/cube-store';
import { buildSolveRequest, useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { solveRequestGuard } from '@/stores/solve-guard';
import { SCAN_FACE_ORDER, type FaceId } from '@/types/cube';
import { cn } from '@/lib/utils';
import {
  capturedFacesAreStructurallyValid,
  deriveReconstructionStages,
  describeSolveError,
  isValidationError,
  type Stage,
} from './stages';

/** Presentation-only delay between revealed checklist steps. */
const REVEAL_STEP_MS = 340;

/**
 * Gates REAL stage states behind the reveal counter: a passed/failed stage is shown as such only once its
 * reveal tick has happened (never earlier than its real state). Unresolved stages are shown as they are.
 */
function applyReveal(stages: readonly Stage[], revealed: number): Stage[] {
  let blocked = false;
  return stages.map((s, i): Stage => {
    if (blocked) return { ...s, state: 'pending' };
    if (s.state === 'passed' || s.state === 'failed') {
      if (i < revealed) {
        if (s.state === 'failed') blocked = true;
        return s;
      }
      blocked = true;
      return { id: s.id, label: s.label, state: 'active' };
    }
    blocked = true;
    return s;
  });
}

export function ReconstructionScreen() {
  const captured = useScanStore((s) => s.captured);
  const mode = useSessionStore((s) => s.mode);
  const setScreen = useSessionStore((s) => s.setScreen);
  const startSession = useSessionStore((s) => s.startSession);
  const startFreshScan = useRubikStore((s) => s.startFreshScan);
  const { status, error, solution, solve } = useSolveSession();

  const [revealed, setRevealed] = React.useState(0);
  const [attempt, setAttempt] = React.useState(0);
  const [assembledView, setAssembledView] = React.useState(false);

  const capturedCount = SCAN_FACE_ORDER.filter((f) => captured[f]).length;
  const incomplete = capturedCount < 6;
  const request = React.useMemo(() => buildSolveRequest(captured), [captured]);
  const structurallyValid = React.useMemo(() => capturedFacesAreStructurallyValid(captured), [captured]);
  const demo = mode === 'demo';

  // Start the solve once for a complete, structurally valid scan. A solve already in flight or finished
  // (the temporary bridge may have started it) is never restarted.
  React.useEffect(() => {
    if (!request || !structurallyValid) return;
    if (useCubeStore.getState().status !== 'idle') return;
    void solve(request);
  }, [request, structurallyValid, status, solve]);

  // Presentation stagger. Restarted (attempt) whenever the solve is re-run.
  React.useEffect(() => {
    setRevealed(0);
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setRevealed(step);
      if (step >= 6) window.clearInterval(timer);
    }, REVEAL_STEP_MS);
    return () => window.clearInterval(timer);
  }, [attempt]);

  const realStages = React.useMemo(
    () => deriveReconstructionStages({ captured, mode, cube: { status, error, solution } }),
    [captured, mode, status, error, solution],
  );
  const stages = React.useMemo(() => applyReveal(realStages, revealed), [realStages, revealed]);
  const passedCount = stages.filter((s) => s.state === 'passed').length;
  const isComplete = status === 'ready' && stages.every((s) => s.state === 'passed');

  const cancelled = error?.kind === 'client' && error.code === 'REQUEST_CANCELLED';
  const solveFailed = !incomplete && status === 'error' && error !== null;
  const validationFailed = solveFailed && isValidationError(error);
  // Six faces but the frontend checks failed: no solve is sent, so this must be its own terminal state.
  const checkFailure = !incomplete && !structurallyValid ? realStages.find((s) => s.state === 'failed') : undefined;
  const frontendFailed = checkFailure !== undefined;
  const problem = incomplete || frontendFailed || solveFailed;
  // R28: a face is green only once stage 4 is revealed as passed and nothing has failed; never per-face red.
  const netValidated = stages.find((s) => s.id === 'validated')?.state === 'passed' && !stages.some((s) => s.state === 'failed');

  const cubies = React.useMemo(
    () => (solution ? toCubies(solution.state, solution.centers) : null),
    [solution],
  );
  const showAssembled = assembledView && isComplete && cubies !== null;

  const autoAssemble = isComplete;
  React.useEffect(() => {
    if (autoAssemble) setAssembledView(true);
  }, [autoAssemble]);

  const rerunSolve = () => {
    // Never re-send a scan that failed the frontend checks (also guards against stale handlers).
    if (!structurallyValid) return;
    setAssembledView(false);
    setAttempt((a) => a + 1);
    // Rebuilt from the store so each retry carries its own request object (and a new guard handle in runSolve).
    const fresh = buildSolveRequest(useScanStore.getState().captured);
    if (fresh) void solve(fresh);
  };
  const toggleInvalidTest = () => {
    if (status === 'error') {
      rerunSolve();
      return;
    }
    // Void any in-flight solve so its late result cannot overwrite the injected error.
    solveRequestGuard.reset();
    useCubeStore.getState().setError(demoInvalidStateError());
    setAssembledView(false);
    setAttempt((a) => a + 1);
  };
  const restartFullScan = () => {
    if (mode === 'live') startSession('live', 'scanning');
    else startFreshScan(false);
  };

  const moveCount = solution?.moves.length ?? 0;
  const solutionValue: React.ReactNode =
    status === 'ready'
      ? (
        <>
          {moveCount} moves
          {demo && <span className="font-sans text-xs font-normal text-zinc-500"> · demo, pre-computed</span>}
        </>
      )
      : solveFailed || incomplete
        ? '—'
        : 'Computing…';
  const cubeStateLabel = isComplete
    ? 'Valid'
    : incomplete
      ? 'Not validated'
      : validationFailed
        ? 'Invalid'
        : solveFailed
          ? 'Not validated'
          : 'Validating…';

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <WorkspaceHeader
        activeStage="reconstruct"
        rightSlot={
          demo ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={!structurallyValid}
              title={structurallyValid ? undefined : 'Needs six valid captured faces'}
              onClick={toggleInvalidTest}
              className="text-xs text-zinc-400"
            >
              {status === 'error' ? 'Restore Valid State' : 'Test Invalid Cube State'}
            </Button>
          ) : undefined
        }
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Stage: Unfolded 2D Cube Net -> Assembled 3D Digital Twin */}
          <section className="lg:col-span-7 rounded-2xl bg-[#111113] border border-zinc-800/80 p-6 flex flex-col justify-between min-h-[460px] relative overflow-hidden">
            <div className="flex items-center justify-between gap-4 z-10">
              <div>
                <p className="font-mono text-xs text-emerald-400 uppercase tracking-wider">
                  {incomplete
                    ? 'Scan Incomplete'
                    : frontendFailed || validationFailed
                      ? 'Validation Failed'
                      : solveFailed
                        ? 'Solve Failed'
                        : showAssembled
                          ? 'Digital Twin Ready'
                          : 'Assembling Scanned Net'}
                </p>
                <h1 className="text-xl font-semibold text-zinc-50 mt-1">
                  {incomplete
                    ? 'Not all six faces were captured'
                    : frontendFailed || validationFailed
                      ? 'Cube state could not be validated'
                      : solveFailed
                        ? 'No verified solution yet'
                        : showAssembled
                          ? 'Interactive 3D Cube Reconstructed'
                          : 'Mapping 54 stickers to 3D geometry'}
                </h1>
              </div>

              {isComplete && (
                <div className="inline-flex items-center p-1 rounded-lg bg-[#09090B] border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setAssembledView(false)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                      !assembledView
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    2D Net
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssembledView(true)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                      assembledView
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    3D Twin
                  </button>
                </div>
              )}
            </div>

            {/* Central Visual Morph Stage */}
            <div className="relative flex-1 my-4 flex items-center justify-center min-h-[320px]">
              {/* Unfolded 2D Cube Net View (real captured faces only; a missing face is an empty placeholder) */}
              <div
                className={cn(
                  'transition-all duration-500 ease-out flex items-center justify-center',
                  showAssembled
                    ? 'opacity-0 scale-75 pointer-events-none absolute'
                    : 'opacity-100 scale-100'
                )}
              >
                <div className="grid grid-cols-4 grid-rows-3 gap-2.5 sm:gap-3">
                  {/* Row 1: U */}
                  <div />
                  <NetFaceCell faceKey="U" stickers={stickersOf(captured, 'U')} validated={netValidated} />
                  <div />
                  <div />

                  {/* Row 2: L, F, R, B */}
                  <NetFaceCell faceKey="L" stickers={stickersOf(captured, 'L')} validated={netValidated} />
                  <NetFaceCell faceKey="F" stickers={stickersOf(captured, 'F')} validated={netValidated} />
                  <NetFaceCell faceKey="R" stickers={stickersOf(captured, 'R')} validated={netValidated} />
                  <NetFaceCell faceKey="B" stickers={stickersOf(captured, 'B')} validated={netValidated} />

                  {/* Row 3: D */}
                  <div />
                  <NetFaceCell faceKey="D" stickers={stickersOf(captured, 'D')} validated={netValidated} />
                  <div />
                  <div />
                </div>
              </div>

              {/* Assembled Interactive 3D Digital Twin */}
              {showAssembled && cubies && (
                <div className="w-full h-[340px] sm:h-[380px] transition-opacity duration-500">
                  <RubiksCube3D
                    cubies={cubies}
                    mode="interactive"
                    cameraPosition={[4.3, 3.2, 4.8]}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800/80">
              <span>
                {showAssembled
                  ? 'Drag to inspect your reconstructed 3D cube from any angle.'
                  : 'Captured faces arranged as a standard cross cube net.'}
              </span>
              <span data-testid="checks-count" className="font-mono tabular-nums">
                {incomplete
                  ? `${capturedCount}/6 faces`
                  : frontendFailed
                    ? 'Validation failed'
                    : solveFailed
                      ? validationFailed
                        ? 'Validation failed'
                        : 'Not validated'
                      : `${passedCount}/6 checks`}
              </span>
              {/* Terminal states only; per-tick progress is deliberately not announced. */}
              <span role="status" aria-live="polite" className="sr-only">
                {incomplete
                  ? 'Scan incomplete'
                  : frontendFailed
                    ? 'Validation failed'
                    : solveFailed
                      ? validationFailed
                        ? 'Validation failed'
                        : 'Not validated'
                      : isComplete
                        ? 'Reconstruction complete. All checks passed.'
                        : ''}
              </span>
            </div>
          </section>

          {/* Right Panel: Processing Checklist, Summary & Primary CTA */}
          <section className="lg:col-span-5 flex flex-col justify-between gap-6">
            <div className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-6 space-y-5">
              <h2 className="text-base font-semibold text-zinc-100">
                Reconstruction Pipeline
              </h2>

              <ul className="space-y-3">
                {stages.map((stage, idx) => {
                  const stepNum = idx + 1;
                  const failedHere = stage.state === 'failed';
                  const passed = stage.state === 'passed';
                  const active = stage.state === 'active';

                  return (
                    <li
                      key={stage.id}
                      data-testid={`stage-${stage.id}`}
                      data-state={stage.state}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'h-5 w-5 rounded-full flex items-center justify-center shrink-0 border transition-colors',
                            failedHere && 'bg-red-500/15 border-red-400/60 text-red-400',
                            passed && 'bg-emerald-400/15 border-emerald-400/60 text-emerald-400',
                            active && 'border-emerald-400/50 text-emerald-400',
                            !passed && !active && !failedHere && 'border-zinc-800 text-zinc-600'
                          )}
                        >
                          {failedHere ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : passed ? (
                            <Check className="h-3 w-3" />
                          ) : active ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className="text-[10px] font-mono">{stepNum}</span>
                          )}
                        </span>
                        <span
                          className={cn(
                            failedHere && 'text-red-300 font-medium',
                            passed && 'text-zinc-200',
                            active && 'text-zinc-100 font-medium',
                            !passed && !active && !failedHere && 'text-zinc-500'
                          )}
                        >
                          {stage.label}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'font-mono text-xs tabular-nums text-right whitespace-nowrap shrink-0',
                          failedHere ? 'text-red-400' : 'text-zinc-500'
                        )}
                      >
                        {(passed || failedHere) && stage.detail
                          ? stage.detail
                          : failedHere
                            ? 'Error'
                            : passed
                              ? 'OK'
                              : active
                                ? '...'
                                : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Result Summary OR Problem / Recovery */}
            {problem ? (
              <div role="alert" className="rounded-2xl bg-[#191112] border border-red-500/35 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-red-200">
                      {incomplete
                        ? `Scan incomplete — ${capturedCount} of 6 faces captured`
                        : frontendFailed
                          ? 'Scan could not be validated'
                          : validationFailed
                          ? 'Invalid Cube State Detected'
                          : 'Could not verify a solution'}
                    </h3>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {incomplete
                        ? 'Every face must be scanned before the cube can be reconstructed. Missing faces are never filled in.'
                        : checkFailure
                          ? `${checkFailure.label}: ${checkFailure.detail ?? 'failed'}`
                          : describeSolveError(error!)}
                    </p>
                    {frontendFailed && (
                      <p className="text-xs text-zinc-500">Cube State: Not validated. Rescan the cube to fix this.</p>
                    )}
                    {solveFailed && !frontendFailed && (
                      <p className="text-xs text-zinc-500">
                        {error!.retryable || cancelled
                          ? 'This may be temporary. You can try again.'
                          : 'Trying again will not change this. Rescan your cube.'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {incomplete || frontendFailed ? (
                    <Button onClick={() => setScreen('scanning')}>
                      <RotateCcw className="h-4 w-4" />
                      Back to scan
                    </Button>
                  ) : (
                    !!error && (error.retryable || cancelled) && (
                      <Button onClick={rerunSolve}>
                        <RotateCcw className="h-4 w-4" />
                        Try again
                      </Button>
                    )
                  )}
                  <Button variant="secondary" onClick={restartFullScan}>
                    <RefreshCw className="h-4 w-4" />
                    Restart Full Scan
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-6 space-y-5">
                <h2 className="text-sm font-semibold text-zinc-100">Result Summary</h2>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-zinc-500 block">Captured Faces</span>
                    <span className="mt-0.5 block font-mono text-base font-semibold text-zinc-100 tabular-nums">
                      {capturedCount}/6
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 block">Captured Stickers</span>
                    <span className="mt-0.5 block font-mono text-base font-semibold text-zinc-100 tabular-nums">
                      {capturedCount * 9}/54
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 block">Cube State</span>
                    <span
                      className={cn(
                        'mt-0.5 block font-mono text-base font-semibold',
                        isComplete ? 'text-emerald-400' : 'text-zinc-400'
                      )}
                    >
                      {cubeStateLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 block">{demo ? 'Demo Solution' : 'Solution'}</span>
                    <span className="mt-0.5 block font-mono text-base font-semibold text-zinc-100 tabular-nums">
                      {solutionValue}
                    </span>
                  </div>
                </div>

                {isComplete && moveCount === 0 && (
                  <p data-testid="already-solved-note" className="text-xs text-zinc-400">
                    Already solved — no moves needed.
                  </p>
                )}

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button
                    size="lg"
                    className="flex-1"
                    disabled={!isComplete}
                    onClick={() => setScreen('alignment')}
                  >
                    Prepare to Solve
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={restartFullScan}>
                    Rescan
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

function stickersOf(captured: ReturnType<typeof useScanStore.getState>['captured'], face: FaceId): StickerCode[] | undefined {
  const c = captured[face];
  return c ? c.grid.map(colorNameToCode) : undefined;
}

function NetFaceCell({
  faceKey,
  stickers,
  validated,
}: {
  faceKey: FaceId;
  stickers: StickerCode[] | undefined;
  validated: boolean;
}) {
  const missing = stickers === undefined;
  const ok = validated && !missing;
  return (
    <div
      data-testid={`net-face-${faceKey}`}
      data-state={missing ? 'missing' : 'captured'}
      data-validated={ok ? 'true' : 'false'}
      className={cn(
        'relative rounded-xl p-1.5 border transition-all duration-300',
        missing
          ? 'border-dashed border-zinc-700 bg-[#09090B] opacity-60'
          : ok
            ? 'border-emerald-400/60 bg-emerald-400/[0.06] shadow-[0_0_20px_rgba(52,211,153,0.12)]'
            : 'border-zinc-800 bg-[#09090B]'
      )}
    >
      <FaceGrid2D stickers={stickers} size="md" />
      <span
        className={cn(
          'absolute -top-2 -right-2 h-5 w-5 rounded-md font-mono text-[10px] font-semibold flex items-center justify-center border',
          ok
            ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
            : 'bg-zinc-900 text-zinc-400 border-zinc-700'
        )}
        title={missing ? `Face ${faceKey} (not captured)` : `Face ${faceKey}`}
      >
        {faceKey}
      </span>
    </div>
  );
}
