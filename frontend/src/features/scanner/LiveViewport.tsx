import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CameraState } from '@/hooks/useCamera';

const FRAME_CLASS =
  'relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-[#111113] border border-zinc-800/90 shadow-[0_18px_60px_rgba(0,0,0,0.55)]';

export interface LiveViewportProps {
  camera: CameraState;
  videoRef: (el: HTMLVideoElement | null) => void;
  onEnableCamera: () => void;
}

export function LiveViewport({ camera, videoRef, onEnableCamera }: LiveViewportProps) {
  const active = camera.status === 'active';
  const requesting = camera.status === 'requesting';
  return (
    <div className={FRAME_CLASS}>
      {/* Real camera frames, unmirrored and letterboxed so overlays can map via contain-fit later. */}
      <video
        ref={videoRef}
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

      {/* Capture is unavailable in every live state until a scan connection exists. */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-4 py-3 bg-[#09090B]/90 border-t border-zinc-800/80 flex items-center justify-between gap-4">
        <span id="live-capture-unavailable" className="text-xs text-zinc-400">Capture unavailable — no vision connection</span>
        <Button
          size="sm"
          variant="secondary"
          disabled
          aria-describedby="live-capture-unavailable"
          className="shrink-0"
        >
          Capture Face
        </Button>
      </div>
    </div>
  );
}
