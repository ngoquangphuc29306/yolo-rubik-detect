import type { HealthResponse, LiveReadiness } from '@/types/api';

/** Pure. null means the backend is unreachable. Only a real YOLO detector with status ok, vision and solver ready is `ready` (fail closed). */
export function deriveLiveReadiness(h: HealthResponse | null): LiveReadiness {
  if (h === null) return { kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: false };
  if (h.detectorMode === 'fixture') return { kind: 'fixture-only', solverReady: h.solverReady };
  if (!h.visionReady) return { kind: 'blocked', reason: 'MODEL_UNAVAILABLE', solverReady: h.solverReady };
  if (!h.solverReady) return { kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: false };
  if (h.status !== 'ok') return { kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: true };
  return { kind: 'ready' };
}
