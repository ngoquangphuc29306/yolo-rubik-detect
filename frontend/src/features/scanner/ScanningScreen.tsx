import * as React from 'react';
import { ArrowRight, CameraOff, RefreshCw, RotateCcw, Settings, Video } from 'lucide-react';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { Button } from '@/components/ui/button';
import { COLOR_META, colorNameToCode, type StickerCode } from '@/lib/colors';
import { DEMO_CENTER_COLORS } from '@/demo/demo-fixtures';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { useCamera } from '@/hooks/useCamera';
// TEMPORARY bridge — removed in T1.17 (legacy store: three demo actions + the demo target-grid mirror)
import { useRubikStore } from '@/store/useRubikStore';
import { useCubeStore } from '@/stores/cube-store';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { solveRequestGuard } from '@/stores/solve-guard';
import { SCAN_FACE_ORDER, type CenterColors, type ColorName, type FaceId } from '@/types/cube';
import { CapturedFacesPanel } from './CapturedFacesPanel';
import { LiveUnavailablePanel } from './LiveUnavailablePanel';
import { ScanGuidePanel, type ScanMetrics } from './ScanGuidePanel';
import { ScanSettingsDialog } from './ScanSettingsDialog';
import { ScanViewport } from './ScanViewport';
import { FACE_NAMES, scanGuide } from './scan-guide';
import { useDemoScanScript } from './useDemoScanScript';

/** Documented initial scan convention; every other centre is known only after its face is captured. */
const LIVE_START_CENTERS: Partial<Record<FaceId, ColorName>> = { F: 'green', U: 'white' };

export function ScanningScreen() {
  const mode = useSessionStore((s) => s.mode);
  const isDemo = mode === 'demo';
  const sessionId = useSessionStore((s) => s.sessionId);
  const screenNow = useSessionStore((s) => s.screen);
  const autoCaptureEnabled = useSessionStore((s) => s.settings.autoCaptureEnabled);
  const stageIndex = useScanStore((s) => s.stageIndex);
  const faceStatuses = useScanStore((s) => s.faceStatuses);
  const captured = useScanStore((s) => s.captured);
  const scanCondition = useScanStore((s) => s.condition);
  const stability = useScanStore((s) => s.stability);
  const demoTargetFaces = useRubikStore((s) => s.targetFaces); // TEMPORARY bridge — removed in T1.17

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [rescan, setRescan] = React.useState<{ face: FaceId; sessionId: number } | null>(null);

  const camera = useCamera({ enabled: false });
  const { readiness, refresh } = useBackendHealth(mode === 'live');

  const activeFace: FaceId = SCAN_FACE_ORDER[stageIndex] ?? 'F';
  const names = FACE_NAMES[activeFace];
  const capturedCount = SCAN_FACE_ORDER.filter((k) => faceStatuses[k] === 'captured').length;
  const allCaptured = SCAN_FACE_ORDER.every((k) => captured[k]);

  // TEMPORARY bridge — removed in T1.17
  const captureDemoFace = React.useCallback(() => useRubikStore.getState().captureCurrentFace(), []);
  useDemoScanScript(isDemo, captureDemoFace);

  // The camera never outlives the scan: leaving the screen or restarting the session stops every track.
  const lastSession = React.useRef(sessionId);
  const stopCamera = camera.stop;
  React.useEffect(() => {
    const restarted = lastSession.current !== sessionId;
    lastSession.current = sessionId;
    if (restarted || screenNow !== 'scanning') stopCamera();
  }, [screenNow, sessionId, stopCamera]);

  const selectFace = (face: FaceId) => {
    const before = faceStatuses[face];
    // The captured grids change, so any in-flight or finished solve for the old grids is void.
    solveRequestGuard.reset();
    useCubeStore.getState().reset();
    useScanStore.getState().selectFaceForRescan(face);
    setRescan(before === 'captured' || before === 'rescan' ? { face, sessionId } : null);
  };

  const restartScan = () => {
    stopCamera();
    if (isDemo) {
      useRubikStore.getState().startFreshScan(true); // TEMPORARY bridge — removed in T1.17
    } else {
      useSessionStore.getState().startSession('live', 'scanning');
    }
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
  const guide = scanGuide(activeFace, knownCenters);
  const rescanning = rescan?.face === activeFace && rescan.sessionId === sessionId && !captured[activeFace];

  // ----- demo-only scripted readouts -----
  const demoMetrics: ScanMetrics | null = (() => {
    if (!isDemo) return null;
    const expectedCenter = COLOR_META[DEMO_CENTER_COLORS[activeFace]];
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
  })();

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

  const demoCenterCode = colorNameToCode(DEMO_CENTER_COLORS[activeFace]);

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <WorkspaceHeader
        activeStage="scan"
        rightSlot={
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-300 font-mono">
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
              <span>{!isDemo ? 'Capture unavailable' : autoCaptureEnabled ? 'Auto-capture on' : 'Manual capture'}</span>
            </div>
          </div>

          {!isDemo && <LiveUnavailablePanel readiness={readiness} onRetry={() => void refresh()} />}

          {isDemo ? (
            <ScanViewport
              mode="demo"
              condition={scanCondition}
              targetStickers={demoTargetFaces[activeFace] as StickerCode[]}
              guide={guide}
              expectedCenterCode={demoCenterCode}
              expectedCenterName={COLOR_META[DEMO_CENTER_COLORS[activeFace]].name}
              faceFullName={names.fullName}
              stability={stability}
              autoCapture={autoCaptureEnabled}
              allCaptured={allCaptured}
              onCapture={captureDemoFace}
              onResumeDetection={() => useScanStore.getState().setCondition('ready')}
            />
          ) : (
            <ScanViewport
              mode="live"
              camera={camera.state}
              videoRef={camera.videoRef}
              onEnableCamera={camera.start}
            />
          )}

          {/* Quick Controls Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={restartScan}>
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
                        useRubikStore.getState().startInteractiveDemo(); // TEMPORARY bridge — removed in T1.17
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
