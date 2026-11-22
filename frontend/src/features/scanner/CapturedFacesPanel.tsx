import * as React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { FaceGrid2D } from '@/components/FaceGrid2D';
import { colorNameToCode, type StickerCode } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { FaceCaptureStatus, CapturedFaces } from '@/stores/scan-store';
import { SCAN_FACE_ORDER, type FaceId } from '@/types/cube';
import { FACE_NAMES } from './scan-guide';

interface CapturedFacesPanelProps {
  faceStatuses: Record<FaceId, FaceCaptureStatus>;
  captured: CapturedFaces;
  onSelectFace: (face: FaceId) => void;
}

function CapturedFacesPanelImpl({ faceStatuses, captured, onSelectFace }: CapturedFacesPanelProps) {
  const capturedCount = SCAN_FACE_ORDER.filter((k) => faceStatuses[k] === 'captured').length;

  return (
    <div className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-5 flex-1 flex flex-col">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-sm font-semibold text-zinc-100">Captured Faces</h2>
        <span className="font-mono text-xs text-zinc-400 tabular-nums">{capturedCount} / 6 complete</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
        {SCAN_FACE_ORDER.map((faceKey) => {
          const status = faceStatuses[faceKey];
          const grid = captured[faceKey]?.grid;
          const pattern: StickerCode[] | undefined = grid?.map(colorNameToCode);

          const statusText =
            status === 'captured'
              ? 'Captured'
              : status === 'scanning'
                ? 'Scanning'
                : status === 'rescan'
                  ? 'Rescan needed'
                  : 'Pending';

          return (
            <button
              key={faceKey}
              data-testid={`face-card-${faceKey}`}
              type="button"
              onClick={() => onSelectFace(faceKey)}
              className={cn(
                'group text-left rounded-xl p-3 border transition-all duration-150 flex items-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70',
                status === 'scanning' && 'bg-emerald-400/[0.07] border-emerald-400/60',
                status === 'captured' && 'bg-[#09090B]/70 border-zinc-800 hover:border-zinc-700',
                status === 'rescan' && 'bg-amber-500/10 border-amber-400/50',
                status === 'pending' && 'bg-[#09090B]/40 border-zinc-800/60 opacity-75 hover:opacity-100'
              )}
            >
              <FaceGrid2D stickers={pattern} size="xs" dimmed={status === 'pending'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-semibold text-zinc-100">{faceKey}</span>
                  {status === 'captured' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                  {status === 'rescan' && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                </div>
                <p className="text-xs text-zinc-400 truncate">{FACE_NAMES[faceKey].fullName}</p>
                <p
                  className={cn(
                    'text-[11px] mt-0.5 truncate',
                    status === 'captured' && 'text-emerald-400',
                    status === 'scanning' && 'text-emerald-300 font-medium',
                    status === 'rescan' && 'text-amber-300 font-medium',
                    status === 'pending' && 'text-zinc-500'
                  )}
                >
                  {statusText}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Click any face card to scan or re-capture that face at any time.
      </p>
    </div>
  );
}

export const CapturedFacesPanel = React.memo(CapturedFacesPanelImpl);
