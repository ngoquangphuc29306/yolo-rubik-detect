import { RubiksCube3D } from '@/components/three/RubiksCube3D';
import { toCubies } from '@/engine/cubie-adapter';
import { SOLVED } from '@/engine/cube-state';
import { DEMO_CENTER_COLORS } from '@/demo/demo-fixtures';
import type { ScanGuide } from './scan-guide';

// Reference-only solved cube showing the required holding orientation (no scan data involved).
const REFERENCE_SOLVED_CUBE = toCubies(SOLVED, DEMO_CENTER_COLORS);

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
}

export function ScanGuidePanel({ stageNumber, faceLabel, guide, metrics, rescanning }: ScanGuidePanelProps) {
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
