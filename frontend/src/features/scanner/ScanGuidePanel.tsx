import * as React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { RubiksCube3D } from '@/components/three/RubiksCube3D';
import { toCubies } from '@/engine/cubie-adapter';
import { SOLVED } from '@/engine/cube-state';
import { DEMO_CENTER_COLORS } from '@/demo/demo-fixtures';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MIRROR_STYLE } from '@/lib/mirror';
import { loopProgress, referenceRotationAt, stepEndPose, stepStartPose, stepTargetFace, type Rotation3 } from '@/lib/reference-motion';
import { stepCaption, type RotationStep } from '@/lib/rotation-steps';
import type { FaceId } from '@/types/cube';
import type { ScanGuide } from './scan-guide';

// Reference-only solved cube showing the required holding orientation (no scan data involved).
const REFERENCE_SOLVED_CUBE = toCubies(SOLVED, DEMO_CENTER_COLORS);

/** Far enough back that the cube's corners stay inside the square while it turns (half-diagonal 2.6 at fov 36). */
const LARGE_CUBE_CAMERA: [number, number, number] = [0, 0.3, 9.4];

export interface ScanMetrics {
  centerName: string | null;
  centerHex: string | null;
  stickers: number;
  confidenceLabel: string;
  faceStatus: string;
}

interface ScanGuidePanelProps {
  stageNumber: number;
  faceLabel: string;
  guide: ScanGuide;
  /** Demo-only scripted readouts; null in live mode (nothing is detected, so nothing is shown). */
  metrics: ScanMetrics | null;
  rescanning: boolean;
  /** Live start pose: larger reference cube and a pose caption. */
  emphasis?: boolean;
  /** Live layout: large mirrored reference cube below the heading, short caption, target-face highlight. */
  live?: boolean;
  /** Live: the whole-cube move the preview arrow shows now; the reference cube repeats it. null = static pose. */
  step?: RotationStep | null;
  /** Live: the stage being scanned (highlighted when no move is shown). */
  stageFace?: FaceId;
}

const ARROW_ICON = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown } as const;

/** Loops rest, turn, hold, snap back for `step` into `ref`; no React state per frame, paused while hidden. */
function useReferenceLoop(step: RotationStep | null, enabled: boolean, ref: React.MutableRefObject<Rotation3>) {
  React.useEffect(() => {
    if (!step || !enabled) return;
    ref.current = stepStartPose(step);
    let raf = 0;
    let origin = 0; // elapsed time already spent in the loop when the tab was hidden
    let startedAt = performance.now();
    const frame = (now: number) => {
      ref.current = referenceRotationAt(step, loopProgress(origin + now - startedAt));
      raf = requestAnimationFrame(frame);
    };
    const run = () => {
      startedAt = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        origin += performance.now() - startedAt;
      } else if (raf === 0) {
        run();
      }
    };
    if (!document.hidden) run();
    else raf = 0;
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(raf);
    };
  }, [step, enabled, ref]);
}

function ScanGuidePanelImpl({ stageNumber, faceLabel, guide, metrics, rescanning, emphasis, live = false, step = null, stageFace = 'F' }: ScanGuidePanelProps) {
  const reduced = usePrefersReducedMotion();
  const animate = live && step !== null && !reduced;
  const rotationRef = React.useRef<Rotation3>(step ? stepStartPose(step) : guide.referenceRotation);
  useReferenceLoop(step, animate, rotationRef);

  if (live) {
    const targetFace = step ? stepTargetFace(step) : stageFace;
    // Static poses: the stage pose, or (reduced motion) the pose the move ends on.
    const staticRotation = step && reduced ? stepEndPose(step) : guide.referenceRotation;
    const StaticArrow = step && reduced ? ARROW_ICON[step.arrow] : null;
    return (
      <div data-testid="scan-guide-panel" className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-5 space-y-3">
        <div className="space-y-1.5 min-w-0">
          <p className="font-mono text-xs text-emerald-400">
            Face {stageNumber} of 6 · {faceLabel}
          </p>
          <h1 className="text-lg font-semibold leading-snug text-zinc-50">{guide.heading}</h1>
        </div>

        {/* Large reference cube, mirrored like the preview so its turn matches the arrow on screen. */}
        <div className="relative mx-auto w-full max-w-[320px] aspect-square rounded-xl bg-[#09090B] border border-zinc-800/90 overflow-hidden">
          <div className="w-full h-full" style={MIRROR_STYLE}>
            <RubiksCube3D
              cubies={REFERENCE_SOLVED_CUBE}
              mode="reference"
              referenceRotation={staticRotation}
              referenceRotationRef={animate ? rotationRef : undefined}
              highlightFace={targetFace}
              fov={36}
              cameraPosition={LARGE_CUBE_CAMERA}
              className="w-full h-full"
            />
          </div>
          <span
            data-testid="target-face-chip"
            title="Face that will point at the camera"
            className="absolute top-2 left-2 rounded-md bg-emerald-400 text-zinc-950 px-2 py-0.5 font-mono text-xs font-semibold"
          >
            {targetFace}
          </span>
          {StaticArrow && (
            <span
              data-testid="static-arrow"
              data-direction={step!.arrow}
              className="absolute top-2 right-2 rounded-md bg-zinc-900/80 text-emerald-300 p-1"
            >
              <StaticArrow className="w-4 h-4" aria-hidden="true" />
            </span>
          )}
        </div>

        {step ? (
          <p className="text-sm text-zinc-200 font-medium">{stepCaption(step).line}</p>
        ) : emphasis ? null : (
          <p className="text-sm text-zinc-400 leading-relaxed">{guide.instruction}</p>
        )}

        {emphasis && (
          <p className="text-xs text-emerald-300">Start pose: green centre toward the camera, white centre on top.</p>
        )}

        {rescanning && (
          <p className="text-xs text-amber-300">
            Hold the cube as for this face's stage — if unsure, use Restart Scan.
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-testid="scan-guide-panel" className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p className="font-mono text-xs text-emerald-400">
            Face {stageNumber} of 6 · {faceLabel}
          </p>
          <h1 className="text-lg font-semibold leading-snug text-zinc-50">{guide.heading}</h1>
        </div>

        {/* Small 3D Reference Cube showing required holding orientation */}
        <div className="w-24 h-24 rounded-xl bg-[#09090B] border border-zinc-800/90 shrink-0 overflow-hidden">
          <RubiksCube3D
            cubies={REFERENCE_SOLVED_CUBE}
            mode="reference"
            referenceRotation={guide.referenceRotation}
            fov={36}
            className="w-full h-full"
          />
        </div>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed">{guide.instruction}</p>

      {emphasis && (
        <p className="text-xs text-emerald-300">Start pose: green centre toward the camera, white centre on top.</p>
      )}

      {rescanning && (
        <p className="text-xs text-amber-300">
          Hold the cube as for this face's stage — if unsure, use Restart Scan.
        </p>
      )}

      {metrics && (
        <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
          <div>
            <span className="text-zinc-500 block">Detected Center</span>
            <div className="mt-1 flex items-center gap-2 text-zinc-100 font-medium">
              {metrics.centerName ? (
                <>
                  <span
                    className="w-3 h-3 rounded-[3px] border border-white/20 shrink-0"
                    style={{ backgroundColor: metrics.centerHex ?? undefined }}
                  />
                  <span>{metrics.centerName}</span>
                </>
              ) : (
                <span className="text-zinc-500">Not detected</span>
              )}
            </div>
          </div>

          <div>
            <span className="text-zinc-500 block">Detected Stickers</span>
            <span className="mt-1 block font-mono text-sm text-zinc-100 tabular-nums">{metrics.stickers}/9</span>
          </div>

          <div>
            <span className="text-zinc-500 block">Detection Confidence</span>
            <span className="mt-1 block font-mono text-sm text-emerald-400 tabular-nums">
              {metrics.confidenceLabel}
            </span>
          </div>

          <div>
            <span className="text-zinc-500 block">Face Status</span>
            <span className="mt-1 block text-zinc-200 font-medium capitalize">{metrics.faceStatus}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const ScanGuidePanel = React.memo(ScanGuidePanelImpl);
