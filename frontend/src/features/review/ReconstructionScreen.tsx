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
import { FACE_ORDER, FaceKey } from '@/lib/cubeEngine';
import { useRubikStore } from '@/store/useRubikStore';
import { cn } from '@/lib/utils';

const CHECKLIST_ITEMS = [
  '54 stickers detected',
  'Six faces captured',
  'Color distribution validated',
  'Cube state validated',
  'Digital twin reconstructed',
  'Kociemba solution generated',
];

export function ReconstructionScreen() {
  const {
    initialCube,
    solution,
    targetFaces,
    capturedFaces,
    forceInvalidCube,
    invalidReason,
    invalidFaceKey,
    setScreen,
    setForceInvalidCube,
    selectFaceForRescan,
    startFreshScan,
  } = useRubikStore();

  const [completedSteps, setCompletedSteps] = React.useState(0);
  const [assembledView, setAssembledView] = React.useState(false);

  const facesToDisplay = React.useMemo(() => {
    const merged: Record<FaceKey, typeof targetFaces.F> = { ...targetFaces };
    for (const k of FACE_ORDER) {
      if (capturedFaces[k]) merged[k] = capturedFaces[k]!;
    }
    return merged;
  }, [capturedFaces, targetFaces]);

  // Sequential validation animation
  React.useEffect(() => {
    setCompletedSteps(0);
    setAssembledView(false);

    const maxStep = forceInvalidCube ? 3 : CHECKLIST_ITEMS.length;
    let step = 0;

    const timer = window.setInterval(() => {
      step += 1;
      setCompletedSteps(step);
      if (step >= 5 && !forceInvalidCube) {
        setAssembledView(true);
      }
      if (step >= maxStep) {
        window.clearInterval(timer);
      }
    }, 340);

    return () => window.clearInterval(timer);
  }, [forceInvalidCube]);

  const isComplete = !forceInvalidCube && completedSteps >= CHECKLIST_ITEMS.length;
  const isInvalidDetected = forceInvalidCube && completedSteps >= 3;

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <WorkspaceHeader
        activeStage="reconstruct"
        rightSlot={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setForceInvalidCube(!forceInvalidCube)}
            className="text-xs text-zinc-400"
          >
            {forceInvalidCube ? 'Restore Valid State' : 'Test Invalid Cube State'}
          </Button>
        }
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Stage: Unfolded 2D Cube Net -> Assembled 3D Digital Twin */}
          <section className="lg:col-span-7 rounded-2xl bg-[#111113] border border-zinc-800/80 p-6 flex flex-col justify-between min-h-[460px] relative overflow-hidden">
            <div className="flex items-center justify-between gap-4 z-10">
              <div>
                <p className="font-mono text-xs text-emerald-400 uppercase tracking-wider">
                  {isInvalidDetected
                    ? 'Validation Failed'
                    : assembledView
                      ? 'Digital Twin Ready'
                      : 'Assembling Scanned Net'}
                </p>
                <h1 className="text-xl font-semibold text-zinc-50 mt-1">
                  {isInvalidDetected
                    ? 'Cube state could not be validated'
                    : assembledView
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
              {/* Unfolded 2D Cube Net View */}
              <div
                className={cn(
                  'transition-all duration-500 ease-out flex items-center justify-center',
                  assembledView && !isInvalidDetected
                    ? 'opacity-0 scale-75 pointer-events-none absolute'
                    : 'opacity-100 scale-100'
                )}
              >
                <div className="grid grid-cols-4 grid-rows-3 gap-2.5 sm:gap-3">
                  {/* Row 1: U */}
                  <div />
                  <NetFaceCell
                    faceKey="U"
                    label="U"
                    stickers={facesToDisplay.U}
                    validated={completedSteps >= 2}
                    flagged={isInvalidDetected && invalidFaceKey === 'U'}
                  />
                  <div />
                  <div />

                  {/* Row 2: L, F, R, B */}
                  <NetFaceCell
                    faceKey="L"
                    label="L"
                    stickers={facesToDisplay.L}
                    validated={completedSteps >= 2}
                    flagged={isInvalidDetected && invalidFaceKey === 'L'}
                  />
                  <NetFaceCell
                    faceKey="F"
                    label="F"
                    stickers={facesToDisplay.F}
                    validated={completedSteps >= 1}
                    flagged={isInvalidDetected && invalidFaceKey === 'F'}
                  />
                  <NetFaceCell
                    faceKey="R"
                    label="R"
                    stickers={facesToDisplay.R}
                    validated={completedSteps >= 1}
                    flagged={isInvalidDetected && invalidFaceKey === 'R'}
                  />
                  <NetFaceCell
                    faceKey="B"
                    label="B"
                    stickers={facesToDisplay.B}
                    validated={completedSteps >= 2 && !isInvalidDetected}
                    flagged={isInvalidDetected && invalidFaceKey === 'B'}
                  />

                  {/* Row 3: D */}
                  <div />
                  <NetFaceCell
                    faceKey="D"
                    label="D"
                    stickers={facesToDisplay.D}
                    validated={completedSteps >= 3 && !isInvalidDetected}
                    flagged={isInvalidDetected && invalidFaceKey === 'D'}
                  />
                  <div />
                  <div />
                </div>
              </div>

              {/* Assembled Interactive 3D Digital Twin */}
              {assembledView && !isInvalidDetected && (
                <div className="w-full h-[340px] sm:h-[380px] transition-opacity duration-500">
                  <RubiksCube3D
                    cubies={initialCube}
                    mode="interactive"
                    cameraPosition={[4.3, 3.2, 4.8]}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800/80">
              <span>
                {assembledView && !isInvalidDetected
                  ? 'Drag to inspect your reconstructed 3D cube from any angle.'
                  : 'Six captured faces arranged as a standard cross cube net.'}
              </span>
              <span className="font-mono tabular-nums">
                {isInvalidDetected ? 'Parity check failed' : `${Math.min(completedSteps, 6)}/6 checks`}
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
                {CHECKLIST_ITEMS.map((label, idx) => {
                  const stepNum = idx + 1;
                  const failedHere = isInvalidDetected && stepNum === 3;
                  const passed = !failedHere && completedSteps >= stepNum && !(isInvalidDetected && stepNum > 3);
                  const active = !isInvalidDetected && completedSteps === idx;

                  return (
                    <li
                      key={label}
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
                          {label}
                        </span>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-zinc-500">
                        {failedHere ? 'Error' : passed ? 'OK' : active ? '...' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Result Summary OR Invalid State Recovery */}
            {isInvalidDetected ? (
              <div className="rounded-2xl bg-[#191112] border border-red-500/35 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-red-200">
                      Invalid Cube State Detected
                    </h3>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {invalidReason ??
                        'Two sticker colors look similar under current lighting. Re-scanning the flagged face fixes this in seconds.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    onClick={() => selectFaceForRescan(invalidFaceKey ?? 'B')}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Rescan Back Face
                  </Button>
                  <Button variant="secondary" onClick={() => startFreshScan(false)}>
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
                      6/6
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 block">Detected Stickers</span>
                    <span className="mt-0.5 block font-mono text-base font-semibold text-zinc-100 tabular-nums">
                      54/54
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
                      {isComplete ? 'Valid' : 'Validating...'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 block">Kociemba Solution</span>
                    <span className="mt-0.5 block font-mono text-base font-semibold text-zinc-100 tabular-nums">
                      {isComplete ? `${solution.length} moves` : 'Computing...'}
                    </span>
                  </div>
                </div>

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
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => startFreshScan(false)}
                  >
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

function NetFaceCell({
  faceKey,
  label,
  stickers,
  validated,
  flagged,
}: {
  faceKey: FaceKey;
  label: string;
  stickers: ReturnType<typeof useRubikStore.getState>['targetFaces']['F'];
  validated: boolean;
  flagged: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-xl p-1.5 border transition-all duration-300',
        flagged
          ? 'border-red-400 bg-red-500/15 shadow-[0_0_24px_rgba(248,113,113,0.28)]'
          : validated
            ? 'border-emerald-400/60 bg-emerald-400/[0.06] shadow-[0_0_20px_rgba(52,211,153,0.12)]'
            : 'border-zinc-800 bg-[#09090B]'
      )}
    >
      <FaceGrid2D stickers={stickers} size="md" />
      <span
        className={cn(
          'absolute -top-2 -right-2 h-5 w-5 rounded-md font-mono text-[10px] font-semibold flex items-center justify-center border',
          flagged
            ? 'bg-red-500 text-zinc-950 border-red-400'
            : validated
              ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
              : 'bg-zinc-900 text-zinc-400 border-zinc-700'
        )}
        title={`Face ${faceKey}`}
      >
        {label}
      </span>
    </div>
  );
}
