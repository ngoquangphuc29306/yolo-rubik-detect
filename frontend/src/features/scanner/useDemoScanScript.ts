// Scripted DEMO scan: start-up delay, capture-flash hand-off and simulated stability. Nothing here reads a
// camera. Every timer is owned by an effect whose deps include the session id, so a restart or unmount clears
// it before it can fire (there is deliberately no second "is this still my session" check inside callbacks).
import * as React from 'react';
import { playCaptureSound } from '@/lib/utils';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';

export const DEMO_START_MS = 1000;
export const FLASH_MS = 950;
export const TICK_MS = 140;
export const TICK_STEP = 6;

/** `capture` performs a scripted capture (demo-session captureDemoFace). Inert unless `enabled`. */
export function useDemoScanScript(enabled: boolean, capture: () => void) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const autoCapture = useSessionStore((s) => s.settings.autoCaptureEnabled);
  const condition = useScanStore((s) => s.condition);
  const capturedCount = useScanStore((s) => Object.keys(s.captured).length);
  const allCaptured = capturedCount === 6;
  const captureRef = React.useRef(capture);
  React.useLayoutEffect(() => {
    captureRef.current = capture;
  });
  const soundedFor = React.useRef<number | null>(null);

  // Scripted start-up ("Starting demo feed"), also what the 'loading_model' picker option shows.
  React.useEffect(() => {
    if (!enabled || condition !== 'loading_model') return;
    const t = window.setTimeout(() => useScanStore.getState().setCondition('ready'), DEMO_START_MS);
    return () => window.clearTimeout(t);
  }, [enabled, condition, sessionId]);

  // One capture sound per capture (keyed on the captured count), never replayed by a settings change or remount.
  React.useEffect(() => {
    if (condition !== 'captured_flash') {
      soundedFor.current = null;
      return;
    }
    if (!enabled || soundedFor.current === capturedCount) return;
    soundedFor.current = capturedCount;
    playCaptureSound(useSessionStore.getState().settings.soundEnabled);
  }, [enabled, condition, capturedCount]);

  // Capture confirmation flash -> next face, or Reconstruction once all six are captured.
  React.useEffect(() => {
    if (!enabled || condition !== 'captured_flash') return;
    const t = window.setTimeout(() => {
      if (allCaptured) useSessionStore.getState().setScreen('reconstructing');
      else useScanStore.getState().setCondition('ready');
    }, FLASH_MS);
    return () => window.clearTimeout(t);
  }, [enabled, condition, allCaptured, sessionId]);

  // Simulated stability, then a scripted capture.
  React.useEffect(() => {
    if (!enabled || condition !== 'ready' || !autoCapture || allCaptured) return;
    const interval = window.setInterval(() => {
      const curr = useScanStore.getState().stability;
      if (curr >= 100) captureRef.current();
      else useScanStore.getState().setStability(Math.min(100, curr + TICK_STEP));
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [enabled, condition, autoCapture, allCaptured, sessionId]);
}
