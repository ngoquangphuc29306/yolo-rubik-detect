import * as React from 'react';
import { ArrowRight, CameraOff, RefreshCw, RotateCcw, Settings, Video } from 'lucide-react';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { Button } from '@/components/ui/button';
import { COLOR_META } from '@/lib/colors';
import { DEMO_CENTER_COLORS } from '@/demo/demo-fixtures';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { useCamera } from '@/hooks/useCamera';
import { useLiveScan } from '@/hooks/useLiveScan';
import { WebSocketScanTransport } from '@/services/scan-transport';
import { scanSocketUrl } from '@/services/api-config';
import { useCubeStore } from '@/stores/cube-store';
import { captureDemoFace, restartScan, startDemoScan, startDemoShortcut } from '@/stores/demo-session';
import { useScanStore, type ScanCondition } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { solveRequestGuard } from '@/stores/solve-guard';
import { SCAN_FACE_ORDER, type CenterColors, type ColorName, type FaceId } from '@/types/cube';
import { CapturedFacesPanel } from './CapturedFacesPanel';
import { LiveUnavailablePanel } from './LiveUnavailablePanel';
import { ScanGuidePanel, type ScanMetrics } from './ScanGuidePanel';
import { ScanSettingsDialog } from './ScanSettingsDialog';
import { DemoViewport } from './DemoViewport';
import { LiveViewport } from './LiveViewport';
import { rotationStep } from '@/lib/rotation-steps';
import { FACE_NAMES, scanGuide } from './scan-guide';
import { useDemoScanScript } from './useDemoScanScript';

const LIVE_HANDOFF_MS = 1200;

/** Documented initial scan convention; every other centre is known only after its face is captured. */
const LIVE_START_CENTERS: Partial<Record<FaceId, ColorName>> = { F: 'green', U: 'white' };

/** Scripted readouts for the demo guide panel. */
function demoMetricsFor(face: FaceId, scanCondition: ScanCondition): ScanMetrics {
  const expectedCenter = COLOR_META[DEMO_CENTER_COLORS[face]];
  const detectedStickerCount =
    scanCondition === 'ready' || scanCondition === 'captured_flash' || scanCondition === 'wrong_face'
      ? 9
      : scanCondition === 'missing_stickers'
        ? 6
        : scanCondition === 'unstable'
          ? 8
          : 0;
  const center =
    scanCondition === 'wrong_face'
      ? COLOR_META[expectedCenter.code === 'R' ? 'orange' : 'red']
      : detectedStickerCount >= 5
        ? expectedCenter
        : null;
  return {
    centerName: center?.name ?? null,
    centerHex: center?.hex ?? null,
    stickers: detectedStickerCount,
    confidenceLabel: 'Simulated',
    faceStatus:
      scanCondition === 'captured_flash'
        ? 'Captured'
        : scanCondition === 'ready'
          ? 'Aligning'
          : scanCondition === 'loading_model'
            ? 'Starting demo'
            : scanCondition.replace('_', ' '),
  };
}

/** Neutral state when no session exists (mode null): never the live panel, never fake data. */
function NoScanSession() {
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <WorkspaceHeader activeStage="scan" />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold text-zinc-50">No scan session</h1>
        <p className="text-sm text-zinc-400 max-w-md">
          Start a scan from the home screen, or try the simulated demo scan.
        </p>
        <Button size="sm" onClick={() => startDemoScan(false)}>
          Start demo scan
        </Button>
      </main>
    </div>
  );
}

export function ScanningScreen() {
  const mode = useSessionStore((s) => s.mode);
  if (mode === null) return <NoScanSession />;
  return <ScanSession mode={mode} />;
}

function ScanSession({ mode }: { mode: 'demo' | 'live' }) {
  const isDemo = mode === 'demo';
  const sessionId = useSessionStore((s) => s.sessionId);
  const screenNow = useSessionStore((s) => s.screen);
  const soundEnabled = useSessionStore((s) => s.settings.soundEnabled);
  const autoCaptureEnabled = useSessionStore((s) => s.settings.autoCaptureEnabled);
  const stageIndex = useScanStore((s) => s.stageIndex);
  const faceStatuses = useScanStore((s) => s.faceStatuses);
  const captured = useScanStore((s) => s.captured);
  const scanCondition = useScanStore((s) => s.condition);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [rescan, setRescan] = React.useState<{ face: FaceId; sessionId: number } | null>(null);

  const camera = useCamera({ enabled: false });
  const { readiness, refresh } = useBackendHealth(mode === 'live');
  const [videoEl, setVideoEl] = React.useState<HTMLVideoElement | null>(null);
  const cameraVideoRef = camera.videoRef;
  const combinedVideoRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      cameraVideoRef(el);
      setVideoEl(el);
    },
    [cameraVideoRef],
  );
  const liveReady = !isDemo && readiness?.kind === 'ready';
  const liveCameraActive = liveReady && camera.state.status === 'active';
  const capturedCenters = React.useMemo(() => {
    const centers: Partial<Record<FaceId, ColorName>> = {};
    for (const f of SCAN_FACE_ORDER) {
      const c = captured[f]?.grid[4];
      if (c) centers[f] = c;
    }
    return centers;
  }, [captured]);
  const [lastCapturedFace, setLastCapturedFace] = React.useState<FaceId | null>(null);
  // Called unconditionally (hooks rule); with enabled:false (Demo, no camera) it constructs nothing.
  const liveScan = useLiveScan({
    enabled: liveCameraActive,
    video: videoEl,
    createTransport: () => new WebSocketScanTransport(scanSocketUrl(window.location)),
    onCapture: (face, grid) => {
      const stored = useScanStore.getState().captureFace(face, grid, 'live');
      if (stored) setLastCapturedFace(face);
      return stored;
    },
    initialCenters: capturedCenters,
  });
  const resetLiveScan = liveScan.reset;

  const activeFace: FaceId = SCAN_FACE_ORDER[stageIndex] ?? 'F';
  const names = FACE_NAMES[activeFace];
  const capturedCount = SCAN_FACE_ORDER.filter((k) => faceStatuses[k] === 'captured').length;
  const allCaptured = SCAN_FACE_ORDER.every((k) => captured[k]);

  useDemoScanScript(isDemo, captureDemoFace);

  // The camera never outlives the scan: leaving the screen or restarting the session stops every track.
  const lastSession = React.useRef(sessionId);
  const stopCamera = camera.stop;
  React.useEffect(() => {
    const restarted = lastSession.current !== sessionId;
    lastSession.current = sessionId;
    if (restarted || screenNow !== 'scanning') stopCamera();
    if (restarted && !isDemo) resetLiveScan();
  }, [screenNow, sessionId, stopCamera, isDemo, resetLiveScan]);

  // After the sixth live capture: end camera/transport/capture loop now, then hand off to Reconstruction.
  // Fires only on the false -> true transition while mounted: coming back to a complete scan must not bounce away.
  const liveDone = !isDemo && allCaptured;
  const wasLiveDone = React.useRef(liveDone);
  const [handoff, setHandoff] = React.useState(0);
  React.useEffect(() => {
    if (liveDone && !wasLiveDone.current) setHandoff((n) => n + 1);
    wasLiveDone.current = liveDone;
  }, [liveDone]);
  React.useEffect(() => {
    if (handoff === 0 || !liveDone) return;
    stopCamera();
    const id = sessionId;
    const timer = setTimeout(() => {
      if (useSessionStore.getState().sessionId === id) useSessionStore.getState().setScreen('reconstructing');
    }, LIVE_HANDOFF_MS);
    return () => clearTimeout(timer);
  }, [handoff, liveDone, sessionId, stopCamera]);

  const liveRescan = liveScan.rescan;
  const selectFace = React.useCallback((face: FaceId) => {
    const before = faceStatuses[face];
    if (!isDemo) {
      const grid = captured[face]?.grid;
      if (!grid && face !== activeFace) return; // live: only a captured face or the current stage can be selected
      if (grid) liveRescan(face, grid[4]!); // read BEFORE the store deletes it
    }
    // The captured grids change, so any in-flight or finished solve for the old grids is void.
    solveRequestGuard.reset();
    useCubeStore.getState().reset();
    useScanStore.getState().selectFaceForRescan(face);
    setRescan(before === 'captured' || before === 'rescan' ? { face, sessionId } : null);
  }, [faceStatuses, sessionId, isDemo, captured, activeFace, liveRescan]);

  const resumeDetection = React.useCallback(() => useScanStore.getState().setCondition('ready'), []);

  const handleRestart = () => {
    stopCamera();
    restartScan(true); // mode-aware: live stays live, demo advances to the next demo cube
    if (!isDemo) void refresh(); // a restarted live scan re-checks the vision service
  };

  // Guide wording: demo uses the scripted fixture centres; live names only centres it has actually seen.
  const knownCenters: Partial<CenterColors> = React.useMemo(() => {
    if (isDemo) return DEMO_CENTER_COLORS;
    const known: Partial<Record<FaceId, ColorName>> = { ...LIVE_START_CENTERS };
    for (const f of SCAN_FACE_ORDER) {
      const c = captured[f]?.grid[4];
      if (c) known[f] = c;
    }
    return known;
  }, [isDemo, captured]);
  const guide = React.useMemo(() => scanGuide(activeFace, knownCenters, !isDemo), [activeFace, knownCenters, isDemo]);
  // The move the preview arrow shows (same rule as LiveViewport's cue): the reference cube repeats it.
  const liveState = liveReady ? liveScan.state : null;
  const liveStep = liveState ? rotationStep(liveState.step) : null;
  const refStep =
    liveState && liveStep && (liveState.phase === 'rotating' || liveState.phase === 'aligning' || liveState.phase === 'stabilizing') &&
    !(liveState.phase === 'stabilizing' && liveState.streak?.grid[4] === liveStep.to)
      ? liveStep
      : null;
  const scanView = React.useMemo(
    () =>
      liveReady
        ? {
            connection: liveScan.connection,
            state: liveScan.state,
            lastResult: liveScan.lastResult,
            errorMessage: liveScan.errorMessage,
            onRetry: liveScan.retry,
          }
        : null,
    [liveReady, liveScan.connection, liveScan.state, liveScan.lastResult, liveScan.errorMessage, liveScan.retry],
  );
  const rescanning = rescan?.face === activeFace && rescan.sessionId === sessionId && !captured[activeFace];

  // Demo-only scripted readouts (computed only in the demo branch; no stability dependency).
  const demoMetrics = React.useMemo(
    () => (isDemo ? demoMetricsFor(activeFace, scanCondition) : null),
    [isDemo, activeFace, scanCondition],
  );

  const cameraStatusText = isDemo
    ? scanCondition === 'permission_denied'
      ? 'Camera Blocked'
      : scanCondition === 'loading_model'
        ? 'Starting Demo'
        : 'Simulated Camera'
    : camera.state.status === 'active'
      ? 'Camera Live'
      : camera.state.status === 'requesting'
        ? 'Requesting Camera'
        : camera.state.status === 'idle'
          ? 'Camera Off'
          : 'Camera Unavailable';
  const cameraBlocked = isDemo
    ? scanCondition === 'permission_denied'
    : camera.state.status === 'denied' || camera.state.status === 'not-found' || camera.state.status === 'error';

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <WorkspaceHeader
        activeStage="scan"
        rightSlot={
          <div className="flex items-center gap-3">
            <div role="status" className="hidden sm:flex items-center gap-2 text-xs text-zinc-300 font-mono">
              {cameraBlocked ? (
                <CameraOff className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Video className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span>{cameraStatusText}</span>
            </div>

            {isDemo && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open scanner settings"
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            )}
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
              <span>
                {!isDemo
                  ? liveScan.connection === 'live'
                    ? 'Auto-capture on'
                    : 'Waiting for the vision service'
                  : autoCaptureEnabled
                    ? 'Auto-capture on'
                    : 'Manual capture'}
              </span>
            </div>
          </div>

          {!isDemo && <LiveUnavailablePanel readiness={readiness} onRetry={() => void refresh()} />}

          {isDemo ? (
            <DemoViewport
              condition={scanCondition}
              activeFace={activeFace}
              guide={guide}
              autoCapture={autoCaptureEnabled}
              allCaptured={allCaptured}
              onCapture={captureDemoFace}
              onResumeDetection={resumeDetection}
            />
          ) : (
            <LiveViewport
              camera={camera.state}
              videoRef={combinedVideoRef}
              onEnableCamera={camera.start}
              scan={scanView}
              capture={{ count: capturedCount, face: lastCapturedFace, soundEnabled }}
            />
          )}

          {/* Quick Controls Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRestart}>
                <RefreshCw className="h-3.5 w-3.5" />
                Restart Scan
              </Button>
              {!isDemo && camera.state.status === 'active' && (
                <Button variant="outline" size="sm" onClick={camera.stop}>
                  <CameraOff className="h-3.5 w-3.5" />
                  Turn off camera
                </Button>
              )}
            </div>

            {isDemo && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} className="text-xs">
                  Preview Scan States
                </Button>
                {capturedCount > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      // Complete remaining faces immediately if user wants to jump ahead
                      if (capturedCount < 6) {
                        startDemoShortcut();
                      } else {
                        useSessionStore.getState().setScreen('reconstructing');
                      }
                    }}
                  >
                    Skip to Reconstruction
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL (~35% = 4 of 12 cols) */}
        <aside className="lg:col-span-4 flex flex-col gap-5 min-w-0">
          <ScanGuidePanel
            stageNumber={stageIndex + 1}
            faceLabel={names.label}
            guide={guide}
            metrics={demoMetrics}
            rescanning={rescanning}
            emphasis={!isDemo && activeFace === 'F' && capturedCount === 0}
            live={!isDemo}
            step={refStep}
            stageFace={activeFace}
          />
          <CapturedFacesPanel faceStatuses={faceStatuses} captured={captured} onSelectFace={selectFace} />
        </aside>
      </main>

      {isDemo && (
        <ScanSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          autoCapture={autoCaptureEnabled}
          onAutoCaptureChange={(on) => useSessionStore.getState().setAutoCapture(on)}
          condition={scanCondition}
          onSelectCondition={(c) => useScanStore.getState().setCondition(c)}
          onFlagRightFace={() => useScanStore.getState().markFaceNeedsRescan('R')}
        />
      )}
    </div>
  );
}
