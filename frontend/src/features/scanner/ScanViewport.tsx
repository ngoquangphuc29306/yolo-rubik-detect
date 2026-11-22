import * as React from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { COLOR_META, codeToColorName, type StickerCode } from '@/lib/colors';
import type { CameraState } from '@/hooks/useCamera';
import type { ScanCondition } from '@/stores/scan-store';
import webcamPreview from '@/assets/images/webcam_cube_hands_1795070971051.jpg';
import type { ScanGuide } from './scan-guide';

const WEBCAM_PREVIEW_SRC = webcamPreview;

const FRAME_CLASS =
  'relative w-full aspect-[16/10] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-[#111113] border border-zinc-800/90 shadow-[0_18px_60px_rgba(0,0,0,0.55)]';

export interface DemoViewportProps {
  mode: 'demo';
  condition: ScanCondition;
  /** Scripted sticker colour codes for the current stage (fixture, never a detection). */
  targetStickers: readonly StickerCode[];
  guide: ScanGuide;
  /** Fixture centre of the current stage and its display name, for the wrong-face script. */
  expectedCenterCode: StickerCode;
  expectedCenterName: string;
  faceFullName: string;
  stability: number;
  autoCapture: boolean;
  allCaptured: boolean;
  onCapture: () => void;
  onResumeDetection: () => void;
}

export interface LiveViewportProps {
  mode: 'live';
  camera: CameraState;
  videoRef: (el: HTMLVideoElement | null) => void;
  onEnableCamera: () => void;
}

export type ScanViewportProps = DemoViewportProps | LiveViewportProps;

export function ScanViewport(props: ScanViewportProps) {
  return props.mode === 'demo' ? <DemoViewport {...props} /> : <LiveViewport {...props} />;
}

function DemoViewport({
  condition: scanCondition,
  targetStickers,
  guide,
  expectedCenterCode,
  expectedCenterName,
  faceFullName,
  stability: stabilityProgress,
  autoCapture: autoCaptureEnabled,
  allCaptured,
  onCapture,
  onResumeDetection,
}: DemoViewportProps) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const wrongCode: StickerCode = expectedCenterCode === 'R' ? 'O' : 'R';
  const expectedLower = expectedCenterName.toLowerCase();

  return (
    <div className={FRAME_CLASS}>
      {/* Underlying simulated feed (static stock photo) */}
      {scanCondition !== 'permission_denied' && (
        <>
          {!imgFailed ? (
            <img
              src={WEBCAM_PREVIEW_SRC}
              alt="Hands holding a physical scrambled 3x3 Rubik's Cube in front of the webcam"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-all duration-300',
                scanCondition === 'no_cube' && 'opacity-20 blur-md scale-105',
                scanCondition === 'unstable' && 'translate-x-2 -translate-y-1 blur-[1.5px]',
                scanCondition === 'loading_model' && 'opacity-40 blur-sm'
              )}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-[#111113] to-zinc-950 flex items-center justify-center">
              <Camera className="h-12 w-12 text-zinc-700" />
            </div>
          )}

          {/* Subtle edge vignette scrim for legibility */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/45"
          />
        </>
      )}

      {/* Demo label: this feed and every box on it is scripted */}
      <span className="absolute top-3 left-3 z-30 rounded-md bg-[#09090B]/85 border border-amber-400/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
        Simulated feed
      </span>

      {/* Centered 3x3 Scanning Reticle & scripted sticker boxes */}
      {scanCondition !== 'permission_denied' && scanCondition !== 'loading_model' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-[220px] h-[220px] sm:w-[270px] sm:h-[270px] md:w-[300px] md:h-[300px]">
            {/* Outer corner reticle marks */}
            <div
              className={cn(
                'absolute -inset-3 rounded-xl transition-colors duration-200',
                scanCondition === 'captured_flash'
                  ? 'ring-2 ring-emerald-400 bg-emerald-400/10'
                  : scanCondition === 'wrong_face' || scanCondition === 'missing_stickers'
                    ? 'ring-1 ring-amber-400/70'
                    : 'ring-1 ring-white/25'
              )}
            />
            <div className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-md" />
            <div className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-md" />
            <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-md" />
            <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-md" />

            {/* 3x3 Guide Grid with scripted boxes (colour code only) */}
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-2 p-2">
              {targetStickers.map((stickerColor, idx) => {
                const isMissing = scanCondition === 'missing_stickers' && idx >= 6;
                const isEmpty = scanCondition === 'no_cube';
                const isWrongCenter = scanCondition === 'wrong_face' && idx === 4;
                const shownColor: StickerCode = isWrongCenter ? wrongCode : stickerColor;
                const colorMeta = COLOR_META[codeToColorName(shownColor)];

                if (isEmpty || isMissing) {
                  return (
                    <div
                      key={idx}
                      className="rounded-md border border-dashed border-zinc-400/35 bg-black/25 flex items-center justify-center"
                    >
                      {isMissing && (
                        <span className="font-mono text-[10px] text-amber-300">occluded</span>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={cn(
                      'relative rounded-md border transition-all duration-150',
                      isWrongCenter
                        ? 'border-amber-400 bg-amber-400/20'
                        : scanCondition === 'unstable'
                          ? 'border-amber-300/70 bg-amber-300/10'
                          : 'border-emerald-400/85 bg-emerald-400/[0.08]'
                    )}
                  >
                    {/* Subtle inner sticker swatch corner */}
                    <span
                      className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-[2px] border border-black/40"
                      style={{ backgroundColor: colorMeta.hex }}
                    />
                    {/* Scripted colour code (no confidence value: none exists) */}
                    <span
                      data-testid="detection-label"
                      className={cn(
                        'absolute top-1 left-1 font-mono text-[10px] leading-none px-1 py-0.5 rounded-[3px] tabular-nums',
                        isWrongCenter
                          ? 'bg-amber-500 text-zinc-950 font-semibold'
                          : 'bg-[#09090B]/90 text-emerald-300'
                      )}
                    >
                      {shownColor}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Green Whole-Cube Rotation Arrow Overlay */}
            {scanCondition === 'ready' && guide.arrowDirection !== 'none' && (
              <div className="absolute -bottom-12 inset-x-0 flex items-center justify-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#09090B]/90 border border-emerald-400/40 text-xs text-emerald-300 font-medium">
                  {guide.arrowDirection === 'left' && <ArrowLeft className="h-4 w-4 text-emerald-400" />}
                  {guide.arrowDirection === 'right' && <ArrowRight className="h-4 w-4 text-emerald-400" />}
                  {guide.arrowDirection === 'down' && <ArrowDown className="h-4 w-4 text-emerald-400" />}
                  {guide.arrowDirection === 'up' && <ArrowUp className="h-4 w-4 text-emerald-400" />}
                  <span>{guide.rotationHint}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STATE OVERLAYS */}
      {scanCondition === 'loading_model' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#09090B]/80 p-6 text-center">
          <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
          <h3 className="mt-4 text-base font-semibold text-zinc-100">Starting demo feed…</h3>
          <p className="mt-1 text-sm text-zinc-400 max-w-sm">
            Simulated: preparing the scripted scanning demo. No camera or model is used.
          </p>
        </div>
      )}

      {scanCondition === 'permission_denied' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#111113] p-6 text-center">
          <div className="h-12 w-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
            <CameraOff className="h-6 w-6 text-red-400" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-100">Camera Access Needed</h3>
          <p className="mt-1.5 text-sm text-zinc-400 max-w-md">
            Simulated state: this is how a blocked camera looks. The demo never uses your webcam, so continue with the
            simulated camera feed to explore the workflow.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button size="sm" onClick={onResumeDetection}>
              Use Simulated Camera Feed
            </Button>
          </div>
        </div>
      )}

      {/* Non-blocking contextual feedback toast bar inside top of viewport */}
      {(scanCondition === 'no_cube' ||
        scanCondition === 'missing_stickers' ||
        scanCondition === 'wrong_face' ||
        scanCondition === 'unstable' ||
        scanCondition === 'captured_flash') && (
        <div className="absolute top-4 inset-x-4 z-20 flex justify-center pointer-events-none">
          <div
            className={cn(
              'pointer-events-auto max-w-lg px-4 py-2.5 rounded-xl border text-sm flex items-center gap-3 shadow-lg',
              scanCondition === 'captured_flash'
                ? 'bg-[#0b1f18] border-emerald-400/50 text-emerald-200'
                : 'bg-[#19150d] border-amber-400/45 text-amber-200'
            )}
          >
            {scanCondition === 'captured_flash' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            )}
            <span>
              {scanCondition === 'captured_flash' &&
                (allCaptured
                  ? 'All 6 faces captured! Preparing reconstruction...'
                  : 'Face captured cleanly. Rotate whole cube to the next face.')}
              {scanCondition === 'no_cube' &&
                'No cube detected. Center one flat face of your cube inside the 3×3 guide.'}
              {scanCondition === 'missing_stickers' &&
                'Only 6 of 9 stickers visible. Shift your fingers slightly back from the edges.'}
              {scanCondition === 'wrong_face' &&
                `Expected ${expectedLower} center for the ${faceFullName} face. Turn the whole cube until ${expectedLower} faces forward.`}
              {scanCondition === 'unstable' &&
                'Cube is moving too fast. Hold your hands steady for one second to auto-capture.'}
            </span>
          </div>
        </div>
      )}

      {/* Bottom scripted-stability bar */}
      {scanCondition !== 'permission_denied' && scanCondition !== 'loading_model' && (
        <div className="absolute bottom-0 inset-x-0 z-20 px-4 py-3 bg-[#09090B]/90 border-t border-zinc-800/80 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-300 font-medium">
                {scanCondition === 'captured_flash'
                  ? 'Face locked and captured'
                  : scanCondition === 'ready'
                    ? autoCaptureEnabled
                      ? 'Hold steady — auto-capturing face'
                      : '9/9 stickers locked — ready to capture'
                    : 'Waiting for stable 9/9 detection'}
                <span className="ml-2 font-normal text-zinc-500">Demo: scripted stability</span>
              </span>
              <span className="font-mono text-emerald-400 tabular-nums">
                {scanCondition === 'captured_flash' ? '100%' : `${stabilityProgress}%`}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-150 ease-out rounded-full"
                style={{ width: `${scanCondition === 'captured_flash' ? 100 : stabilityProgress}%` }}
              />
            </div>
          </div>

          {/* Optional Manual Capture / Quick Advance Button */}
          {scanCondition === 'ready' && !allCaptured && (
            <Button size="sm" variant="secondary" onClick={onCapture} className="shrink-0">
              Capture Face
            </Button>
          )}
          {scanCondition !== 'ready' && scanCondition !== 'captured_flash' && (
            <Button size="sm" variant="secondary" onClick={onResumeDetection} className="shrink-0">
              Resume Detection
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function LiveViewport({ camera, videoRef, onEnableCamera }: LiveViewportProps) {
  const active = camera.status === 'active';
  return (
    <div className={FRAME_CLASS}>
      {/* Real camera frames, unmirrored and letterboxed so overlays can map via contain-fit later. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
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
          {camera.status !== 'requesting' && (
            <Button size="sm" className="mt-5" onClick={onEnableCamera}>
              Enable camera
            </Button>
          )}
        </div>
      )}

      {/* Capture is unavailable in every live state until a scan connection exists. */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-4 py-3 bg-[#09090B]/90 border-t border-zinc-800/80 flex items-center justify-between gap-4">
        <span className="text-xs text-zinc-400">Capture unavailable — no vision connection</span>
        <Button size="sm" variant="secondary" disabled className="shrink-0">
          Capture Face
        </Button>
      </div>
    </div>
  );
}
