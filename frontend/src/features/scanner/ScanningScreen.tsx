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
  RefreshCw,
  RotateCcw,
  Settings,
  Video,
} from 'lucide-react';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { FaceGrid2D } from '@/components/FaceGrid2D';
import { RubiksCube3D } from '@/components/three/RubiksCube3D';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  FACE_META,
  FACE_ORDER,
  FaceKey,
  STICKER_COLORS,
  createSolvedCube,
} from '@/lib/cubeEngine';
import { ScanCondition, useRubikStore } from '@/store/useRubikStore';
import { cn, playCaptureSound } from '@/lib/utils';
import webcamPreview from '@/assets/images/webcam_cube_hands_1795070971051.jpg';

const WEBCAM_PREVIEW_SRC = webcamPreview;

const REFERENCE_SOLVED_CUBE = createSolvedCube();

const STICKER_CONFIDENCES = [0.99, 0.97, 0.98, 0.96, 0.99, 0.98, 0.97, 0.98, 0.99];

const SIMULATED_CONDITIONS: { value: ScanCondition; label: string; hint: string }[] = [
  { value: 'ready', label: 'Normal Auto-Detection (9/9)', hint: 'All 9 stickers visible and stable' },
  { value: 'loading_model', label: 'Loading AI Model', hint: 'Initializing YOLO weights' },
  { value: 'permission_denied', label: 'Camera Permission Denied', hint: 'Browser webcam access blocked' },
  { value: 'no_cube', label: 'No Cube Detected', hint: 'Empty frame or cube too far' },
  { value: 'missing_stickers', label: 'Missing Stickers (6/9)', hint: 'Fingers covering lower tiles' },
  { value: 'wrong_face', label: 'Incorrect Face Detected', hint: 'Center color mismatch' },
  { value: 'unstable', label: 'Unstable Positioning', hint: 'Hand movement exceeding threshold' },
];

export function ScanningScreen() {
  const {
    activeFaceIndex,
    faceStatuses,
    capturedFaces,
    targetFaces,
    scanCondition,
    stabilityProgress,
    useRealWebcam,
    autoCaptureEnabled,
    soundEnabled,
    setScreen,
    startFreshScan,
    setScanCondition,
    setStabilityProgress,
    captureCurrentFace,
    selectFaceForRescan,
    markFaceNeedsRescan,
    setUseRealWebcam,
    setAutoCaptureEnabled,
  } = useRubikStore();

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [imgFailed, setImgFailed] = React.useState(false);
  const [webcamError, setWebcamError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const activeFaceKey: FaceKey = FACE_ORDER[activeFaceIndex] ?? 'F';
  const activeMeta = FACE_META[activeFaceKey];
  const currentTargetStickers = targetFaces[activeFaceKey];
  const capturedCount = FACE_ORDER.filter((k) => faceStatuses[k] === 'captured').length;
  const allCaptured = capturedCount === 6;

  // Handle brief AI model loading state automatically on fresh entry
  React.useEffect(() => {
    if (scanCondition !== 'loading_model') return;
    const t = window.setTimeout(() => {
      setScanCondition('ready');
    }, 1150);
    return () => window.clearTimeout(t);
  }, [scanCondition, setScanCondition]);

  // Brief captured confirmation flash -> continue scanning or transition to Reconstruction
  React.useEffect(() => {
    if (scanCondition !== 'captured_flash') return;
    playCaptureSound(soundEnabled);
    const t = window.setTimeout(() => {
      if (allCaptured) {
        setScreen('reconstructing');
      } else {
        setScanCondition('ready');
      }
    }, 950);
    return () => window.clearTimeout(t);
  }, [scanCondition, allCaptured, setScreen, setScanCondition, soundEnabled]);

  // Automatic stability progress & hands-free auto-capture when 9/9 stickers are stable
  React.useEffect(() => {
    if (scanCondition !== 'ready' || !autoCaptureEnabled || allCaptured) return;

    const interval = window.setInterval(() => {
      const curr = useRubikStore.getState().stabilityProgress;
      if (curr >= 100) {
        captureCurrentFace();
      } else {
        setStabilityProgress(Math.min(100, curr + 6));
      }
    }, 140);

    return () => window.clearInterval(interval);
  }, [scanCondition, autoCaptureEnabled, allCaptured, captureCurrentFace, setStabilityProgress]);

  // Optional real webcam stream when user switches on live camera
  React.useEffect(() => {
    if (!useRealWebcam) {
      setWebcamError(null);
      return;
    }
    let activeStream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: 1280, height: 720 } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        activeStream = stream;
        setWebcamError(null);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWebcamError('Unable to access camera');
          setScanCondition('permission_denied');
          setUseRealWebcam(false);
        }
      });

    return () => {
      cancelled = true;
      activeStream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [useRealWebcam, setScanCondition, setUseRealWebcam]);

  // Compute live telemetry numbers from scanCondition
  const detectedStickerCount =
    scanCondition === 'ready' || scanCondition === 'captured_flash' || scanCondition === 'wrong_face'
      ? 9
      : scanCondition === 'missing_stickers'
        ? 6
        : scanCondition === 'unstable'
          ? 8
          : 0;

  const avgConfidence =
    scanCondition === 'ready' || scanCondition === 'captured_flash'
      ? '98.2%'
      : scanCondition === 'wrong_face'
        ? '96.4%'
        : scanCondition === 'missing_stickers'
          ? '84.1%'
          : scanCondition === 'unstable'
            ? '79.5%'
            : '—';

  const expectedCenterMeta = STICKER_COLORS[activeMeta.defaultCenter];
  const detectedCenterMeta =
    scanCondition === 'wrong_face'
      ? STICKER_COLORS[activeMeta.defaultCenter === 'R' ? 'O' : 'R']
      : detectedStickerCount >= 5
        ? expectedCenterMeta
        : null;

  const cameraStatusText =
    scanCondition === 'permission_denied'
      ? 'Camera Blocked'
      : scanCondition === 'loading_model'
        ? 'Loading Model'
        : useRealWebcam
          ? 'Live Webcam'
          : 'Camera Active';

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <WorkspaceHeader
        activeStage="scan"
        rightSlot={
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-300 font-mono">
              {scanCondition === 'permission_denied' ? (
                <CameraOff className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Video className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span>{cameraStatusText}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open scanner settings"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        }
      />

      {/* Focused Workspace Grid: ~65% Left Camera Viewport, ~35% Right Guidance Panel */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-6 flex flex-col lg:grid lg:grid-cols-12 gap-6">
        {/* LEFT PANEL (~65% = 8 of 12 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-4 min-w-0">
          {/* Top Guidance Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-zinc-300">
              <RotateCcw className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Rotate the <strong className="text-zinc-100 font-semibold">whole cube</strong> — do
                not twist individual layers.
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono tabular-nums">
              <span>Face {capturedCount}/6 captured</span>
              <span aria-hidden="true">·</span>
              <span>{autoCaptureEnabled ? 'Auto-capture on' : 'Manual capture'}</span>
            </div>
          </div>

          {/* Large Webcam Preview Container */}
          <div className="relative w-full aspect-[16/10] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-[#111113] border border-zinc-800/90 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
            {/* Underlying Camera Feed (Real Webcam or Simulated Hands + Cube) */}
            {scanCondition !== 'permission_denied' && (
              <>
                {useRealWebcam ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                ) : !imgFailed ? (
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

            {/* Centered 3x3 Scanning Reticle & Live YOLO Sticker Bounding Boxes */}
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

                  {/* 3x3 Guide Grid with YOLO Bounding Boxes */}
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-2 p-2">
                    {currentTargetStickers.map((stickerColor, idx) => {
                      const isMissing = scanCondition === 'missing_stickers' && idx >= 6;
                      const isEmpty = scanCondition === 'no_cube';
                      const isWrongCenter = scanCondition === 'wrong_face' && idx === 4;
                      const shownColor = isWrongCenter
                        ? activeMeta.defaultCenter === 'R'
                          ? 'O'
                          : 'R'
                        : stickerColor;
                      const colorMeta = STICKER_COLORS[shownColor];
                      const conf = STICKER_CONFIDENCES[idx];

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
                          {/* Subtle inner sticker swatch corner to make detection unmistakable */}
                          <span
                            className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-[2px] border border-black/40"
                            style={{ backgroundColor: colorMeta.hex }}
                          />
                          {/* YOLO Class Label & Confidence Score */}
                          <span
                            className={cn(
                              'absolute top-1 left-1 font-mono text-[10px] leading-none px-1 py-0.5 rounded-[3px] tabular-nums',
                              isWrongCenter
                                ? 'bg-amber-500 text-zinc-950 font-semibold'
                                : 'bg-[#09090B]/90 text-emerald-300'
                            )}
                          >
                            {shownColor} {conf.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dynamic Green Whole-Cube Rotation Arrow Overlay */}
                  {scanCondition === 'ready' && activeMeta.arrowDirection !== 'none' && (
                    <div className="absolute -bottom-12 inset-x-0 flex items-center justify-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#09090B]/90 border border-emerald-400/40 text-xs text-emerald-300 font-medium">
                        {activeMeta.arrowDirection === 'left' && (
                          <ArrowLeft className="h-4 w-4 text-emerald-400" />
                        )}
                        {activeMeta.arrowDirection === 'right' && (
                          <ArrowRight className="h-4 w-4 text-emerald-400" />
                        )}
                        {activeMeta.arrowDirection === 'down' && (
                          <ArrowDown className="h-4 w-4 text-emerald-400" />
                        )}
                        {activeMeta.arrowDirection === 'up' && (
                          <ArrowUp className="h-4 w-4 text-emerald-400" />
                        )}
                        <span>{activeMeta.rotationHint}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STATE OVERLAYS — Clear, concise, beginner-friendly instructions */}
            {scanCondition === 'loading_model' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#09090B]/80 p-6 text-center">
                <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
                <h3 className="mt-4 text-base font-semibold text-zinc-100">
                  Loading Vision Model
                </h3>
                <p className="mt-1 text-sm text-zinc-400 max-w-sm">
                  Preparing YOLO sticker detection and color calibration for your camera feed.
                </p>
              </div>
            )}

            {scanCondition === 'permission_denied' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#111113] p-6 text-center">
                <div className="h-12 w-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
                  <CameraOff className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-zinc-100">
                  Camera Access Needed
                </h3>
                <p className="mt-1.5 text-sm text-zinc-400 max-w-md">
                  {webcamError
                    ? 'Your browser blocked webcam access. Allow camera permissions in your address bar, or continue with our interactive simulated camera feed.'
                    : 'Allow webcam access to scan your physical cube, or switch to the guided demo camera feed to explore the workflow.'}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    size="sm"
                    onClick={() => {
                      setScanCondition('ready');
                      setUseRealWebcam(false);
                    }}
                  >
                    Use Simulated Camera Feed
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setScanCondition('ready');
                      setUseRealWebcam(true);
                    }}
                  >
                    Retry Webcam Permission
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
                      `Expected ${expectedCenterMeta.name.toLowerCase()} center for the ${activeMeta.fullName} face. Turn the whole cube until ${expectedCenterMeta.name.toLowerCase()} faces forward.`}
                    {scanCondition === 'unstable' &&
                      'Cube is moving too fast. Hold your hands steady for one second to auto-capture.'}
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Stability Auto-Capture Progress Bar */}
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
                    </span>
                    <span className="font-mono text-emerald-400 tabular-nums">
                      {scanCondition === 'captured_flash' ? '100%' : `${stabilityProgress}%`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-150 ease-out rounded-full"
                      style={{
                        width: `${scanCondition === 'captured_flash' ? 100 : stabilityProgress}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Optional Manual Capture / Quick Advance Button */}
                {scanCondition === 'ready' && !allCaptured && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={captureCurrentFace}
                    className="shrink-0"
                  >
                    Capture Face
                  </Button>
                )}
                {scanCondition !== 'ready' &&
                  scanCondition !== 'captured_flash' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setScanCondition('ready')}
                      className="shrink-0"
                    >
                      Resume Detection
                    </Button>
                  )}
              </div>
            )}
          </div>

          {/* Camera & Prototype Quick Controls Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => startFreshScan(true)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Restart Scan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseRealWebcam(!useRealWebcam)}
              >
                <Camera className="h-3.5 w-3.5" />
                {useRealWebcam ? 'Use Simulated Feed' : 'Switch to Real Webcam'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="text-xs"
              >
                Preview Scan States
              </Button>
              {capturedCount > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    // Complete remaining faces immediately if user wants to jump ahead
                    const store = useRubikStore.getState();
                    if (capturedCount < 6) {
                      store.startInteractiveDemo();
                    } else {
                      setScreen('reconstructing');
                    }
                  }}
                >
                  Skip to Reconstruction
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT PANEL (~35% = 4 of 12 cols) */}
        <aside className="lg:col-span-4 flex flex-col gap-5 min-w-0">
          {/* Active Face Instruction & Mini 3D Orientation Reference */}
          <div className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <p className="font-mono text-xs text-emerald-400">
                  Face {activeFaceIndex + 1} of 6 · {activeMeta.label}
                </p>
                <h1 className="text-lg font-semibold leading-snug text-zinc-50">
                  {activeMeta.scanHeading}
                </h1>
              </div>

              {/* Small 3D Reference Cube showing required holding orientation */}
              <div className="w-24 h-24 rounded-xl bg-[#09090B] border border-zinc-800/90 shrink-0 overflow-hidden">
                <RubiksCube3D
                  cubies={REFERENCE_SOLVED_CUBE}
                  mode="reference"
                  referenceRotation={activeMeta.referenceRotation}
                  fov={36}
                  className="w-full h-full"
                />
              </div>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed">{activeMeta.scanInstruction}</p>

            {/* Clean Unboxed Detection Metrics */}
            <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div>
                <span className="text-zinc-500 block">Detected Center</span>
                <div className="mt-1 flex items-center gap-2 text-zinc-100 font-medium">
                  {detectedCenterMeta ? (
                    <>
                      <span
                        className="w-3 h-3 rounded-[3px] border border-white/20 shrink-0"
                        style={{ backgroundColor: detectedCenterMeta.hex }}
                      />
                      <span>{detectedCenterMeta.name}</span>
                    </>
                  ) : (
                    <span className="text-zinc-500">Not detected</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-zinc-500 block">Detected Stickers</span>
                <span className="mt-1 block font-mono text-sm text-zinc-100 tabular-nums">
                  {detectedStickerCount}/9
                </span>
              </div>

              <div>
                <span className="text-zinc-500 block">Detection Confidence</span>
                <span className="mt-1 block font-mono text-sm text-emerald-400 tabular-nums">
                  {avgConfidence}
                </span>
              </div>

              <div>
                <span className="text-zinc-500 block">Face Status</span>
                <span className="mt-1 block text-zinc-200 font-medium capitalize">
                  {scanCondition === 'captured_flash'
                    ? 'Captured'
                    : scanCondition === 'ready'
                      ? 'Aligning'
                      : scanCondition.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Six Face Progress Cards (Displaying actual captured 3x3 sticker patterns) */}
          <div className="rounded-2xl bg-[#111113] border border-zinc-800/80 p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-sm font-semibold text-zinc-100">Captured Faces</h2>
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                {capturedCount} / 6 complete
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
              {FACE_ORDER.map((faceKey) => {
                const meta = FACE_META[faceKey];
                const status = faceStatuses[faceKey];
                const pattern = capturedFaces[faceKey];

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
                    type="button"
                    onClick={() => selectFaceForRescan(faceKey)}
                    className={cn(
                      'group text-left rounded-xl p-3 border transition-all duration-150 flex items-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70',
                      status === 'scanning' &&
                        'bg-emerald-400/[0.07] border-emerald-400/60',
                      status === 'captured' &&
                        'bg-[#09090B]/70 border-zinc-800 hover:border-zinc-700',
                      status === 'rescan' &&
                        'bg-amber-500/10 border-amber-400/50',
                      status === 'pending' &&
                        'bg-[#09090B]/40 border-zinc-800/60 opacity-75 hover:opacity-100'
                    )}
                  >
                    <FaceGrid2D
                      stickers={pattern}
                      size="xs"
                      dimmed={status === 'pending'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold text-zinc-100">
                          {faceKey}
                        </span>
                        {status === 'captured' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        )}
                        {status === 'rescan' && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate">{meta.fullName}</p>
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
        </aside>
      </main>

      {/* Scanner Settings & Edge-State Inspector Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Scanner Settings & State Preview"
        description="Configure capture behavior or inspect beginner-friendly error and alignment states."
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-100">Hands-Free Auto-Capture</p>
              <p className="text-xs text-zinc-400">
                Automatically capture each face once 9/9 stickers stay steady.
              </p>
            </div>
            <Switch
              checked={autoCaptureEnabled}
              onCheckedChange={setAutoCaptureEnabled}
              ariaLabel="Toggle hands-free auto-capture"
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-800/80">
            <div>
              <p className="text-sm font-medium text-zinc-100">Live Browser Webcam</p>
              <p className="text-xs text-zinc-400">
                Use your device camera instead of the simulated desk feed.
              </p>
            </div>
            <Switch
              checked={useRealWebcam}
              onCheckedChange={setUseRealWebcam}
              ariaLabel="Toggle live browser webcam"
            />
          </div>

          <div className="pt-4 border-t border-zinc-800/80 space-y-2.5">
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Simulate Computer Vision State
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SIMULATED_CONDITIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setScanCondition(item.value);
                    setSettingsOpen(false);
                  }}
                  className={cn(
                    'text-left p-2.5 rounded-lg border text-xs transition-colors cursor-pointer',
                    scanCondition === item.value
                      ? 'bg-emerald-400/10 border-emerald-400/60 text-zinc-100'
                      : 'bg-[#09090B] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  )}
                >
                  <div className="font-medium">{item.label}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{item.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                markFaceNeedsRescan('R');
                setSettingsOpen(false);
              }}
            >
              Flag Right Face for Rescan
            </Button>
            <Button size="sm" onClick={() => setSettingsOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
