// Scripted DEMO scan: start-up delay, capture-flash hand-off and simulated stability. Nothing here reads a
// camera; every timer is cleared on unmount / condition change and re-checks the session before acting.
import * as React from 'react';
import { playCaptureSound } from '@/lib/utils';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';

export const DEMO_START_MS = 1000;
const FLASH_MS = 950;
const TICK_MS = 140;
const TICK_STEP = 6;

/** `capture` performs a scripted capture (bridge captureCurrentFace). Inert unless `enabled`. */
export function useDemoScanScript(enabled: boolean, capture: () => void) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const autoCapture = useSessionStore((s) => s.settings.autoCaptureEnabled);
  const soundEnabled = useSessionStore((s) => s.settings.soundEnabled);
  const condition = useScanStore((s) => s.condition);
  const allCaptured = useScanStore((s) => Object.keys(s.captured).length === 6);
  const captureRef = React.useRef(capture);
  captureRef.current = capture;

  const sameSession = React.useCallback(() => useSessionStore.getState().sessionId === sessionId, [sessionId]);

  // Scripted start-up ("Starting demo feed"), also what the 'loading_model' picker option shows.
  React.useEffect(() => {
    if (!enabled || condition !== 'loading_model') return;
    const t = window.setTimeout(() => {
      if (sameSession()) useScanStore.getState().setCondition('ready');
    }, DEMO_START_MS);
    return () => window.clearTimeout(t);
  }, [enabled, condition, sameSession]);

  // Capture confirmation flash -> next face, or Reconstruction once all six are captured.
  React.useEffect(() => {
    if (!enabled || condition !== 'captured_flash') return;
    playCaptureSound(soundEnabled);
    const t = window.setTimeout(() => {
      if (!sameSession()) return;
      if (allCaptured) useSessionStore.getState().setScreen('reconstructing');
      else useScanStore.getState().setCondition('ready');
    }, FLASH_MS);
    return () => window.clearTimeout(t);
  }, [enabled, condition, allCaptured, soundEnabled, sameSession]);

  // Simulated stability, then a scripted capture.
  React.useEffect(() => {
    if (!enabled || condition !== 'ready' || !autoCapture || allCaptured) return;
    const interval = window.setInterval(() => {
      if (!sameSession()) return;
      const curr = useScanStore.getState().stability;
      if (curr >= 100) captureRef.current();
      else useScanStore.getState().setStability(Math.min(100, curr + TICK_STEP));
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [enabled, condition, autoCapture, allCaptured, sameSession]);
}
