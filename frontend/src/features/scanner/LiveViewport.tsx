import * as React from 'react';
import { Camera, CameraOff, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CameraState } from '@/hooks/useCamera';
import { useElementSize, useVideoFrameSize } from '@/hooks/useElementSize';
import type { LiveConnection } from '@/hooks/useLiveScan';
import { stabilityProgress, type LiveScanState } from '@/lib/live-scan-machine';
import { guideOverlay } from '@/lib/scan-roi';
import type { FrameResult } from '@/types/api';
import type { FaceId } from '@/types/cube';
import { LiveScanGuide } from './LiveScanGuide';
import { RotationCue } from './RotationCue';
import { FACE_NAMES, type ScanGuide } from './scan-guide';

const TICK_MS = 100; // progress bar refresh: never faster than ~10 Hz

const FRAME_CLASS =
  'relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-[#111113] border border-zinc-800/90 shadow-[0_18px_60px_rgba(0,0,0,0.55)]';

export interface LiveScanView {
  connection: LiveConnection;
  state: LiveScanState;
  lastResult: FrameResult | null;
  errorMessage: string | null;
  onRetry: () => void;
  nextGuide: ScanGuide;
  stageFace: FaceId;
}

export interface LiveViewportProps {
  camera: CameraState;
  videoRef: (el: HTMLVideoElement | null) => void;
  onEnableCamera: () => void;
  /** null until the vision service is ready: then no guide and no strip detail. */
  scan: LiveScanView | null;
}

/** Strip text for connection/camera/phase messages only; the guide owns the hint live region. */
function stripText(active: boolean, scan: LiveScanView | null): string {
  if (!active) return 'Enable the camera to start scanning';
  if (!scan) return 'Waiting for the vision service';
  if (scan.connection === 'error') return scan.errorMessage ?? 'The live scan stopped.';
  if (scan.connection !== 'live') return 'Connecting to the vision service…';
  switch (scan.state.phase) {
    case 'done':
      return 'All six faces captured.';
    case 'captured':
    case 'rotating':
      return 'Saved. Rotate the whole cube to the next face.';
    default:
      return `Place the ${FACE_NAMES[scan.state.stage].fullName} face inside the square.`;
  }
}

function LiveViewportImpl({ camera, videoRef, onEnableCamera, scan }: LiveViewportProps) {
  const active = camera.status === 'active';
  const requesting = camera.status === 'requesting';
  const [box, setBox] = React.useState<HTMLDivElement | null>(null);
  const [video, setVideo] = React.useState<HTMLVideoElement | null>(null);
  const setVideoEl = React.useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef(el);
      setVideo(el);
    },
    [videoRef],
  );
  const viewSize = useElementSize(box);
  const frameSize = useVideoFrameSize(video);

  const phase = scan?.state.phase;
  const showCue = active && !!scan && phase === 'rotating';
  const searching = phase === 'aligning' || phase === 'stabilizing';
  const ticking = active && !!scan && searching && scan.state.streak !== null;
  const [now, setNow] = React.useState(() => performance.now());
  React.useEffect(() => {
    if (!ticking) return;
    setNow(performance.now());
    const id = setInterval(() => setNow(performance.now()), TICK_MS);
    return () => clearInterval(id);
  }, [ticking]);

  const showGuide = active && !!scan;
  const overlay = React.useMemo(
    () => guideOverlay(frameSize, viewSize, showGuide && searching ? scan.lastResult : null),
    [frameSize, viewSize, showGuide, searching, scan?.lastResult],
  );

  return (
    <>
    <div ref={setBox} className={FRAME_CLASS}>
      {/* Real camera frames, unmirrored and letterboxed so overlays can map via contain-fit later. */}
      <video
        ref={setVideoEl}
        autoPlay
        playsInline
        muted
        aria-label="Live camera preview"
        className={cn('absolute inset-0 w-full h-full object-contain bg-black', !active && 'invisible')}
      />

      {!active && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#111113] p-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center">
            {camera.status === 'requesting' ? (
              <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
            ) : camera.status === 'idle' ? (
              <Camera className="h-6 w-6 text-zinc-400" />
            ) : (
              <CameraOff className="h-6 w-6 text-red-400" />
            )}
          </div>
          {/* Status text is announced; the action button below stays mounted so focus never drops. */}
          <div
            role={camera.status === 'requesting' ? 'status' : camera.status === 'idle' ? undefined : 'alert'}
          >
            <h3 className="mt-4 text-base font-semibold text-zinc-100">
              {camera.status === 'requesting'
                ? 'Waiting for camera permission…'
                : camera.status === 'idle'
                  ? 'Camera is off'
                  : 'Camera unavailable'}
            </h3>
            <p className="mt-1.5 text-sm text-zinc-400 max-w-md">
              {camera.message ??
                'The camera is only used after you enable it. Video stays on this device and is not recorded.'}
            </p>
          </div>
          <Button
            size="sm"
            className={cn('mt-5', requesting && 'opacity-45 cursor-not-allowed')}
            aria-disabled={requesting || undefined}
            onClick={requesting ? undefined : onEnableCamera}
          >
            {requesting ? 'Requesting camera…' : 'Enable camera'}
          </Button>
        </div>
      )}

      {showGuide && (
        <LiveScanGuide
          square={overlay.square}
          boxes={overlay.boxes}
          cells={searching ? (scan.lastResult?.cells ?? null) : null}
          progress={searching ? stabilityProgress(scan.state, now) : 0}
          phase={scan.state.phase}
          hint={scan.state.hint}
          capturedGrid={phase === 'captured' ? (scan.state.pendingCapture?.grid ?? null) : null}
        />
      )}
    </div>

    {showCue && <RotationCue guide={scan.nextGuide} nextFace={scan.stageFace} />}

    {/* The cue takes the strip's slot while rotating (it is itself the status); errors still need Retry. */}
    {(!showCue || scan.connection === 'error') && (
    <div
      role="status"
      className="rounded-xl border border-zinc-800/80 bg-[#111113] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-300"
    >
      <span>{stripText(active, scan)}</span>
      {scan?.connection === 'error' && active && (
        <Button size="sm" variant="outline" onClick={scan.onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
    )}
    </>
  );
}

export const LiveViewport = React.memo(LiveViewportImpl);
