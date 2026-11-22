// Demo-session actions. Stores layer: orchestrates the session, scan and cube stores with the explicit demo fixtures.
// Everything started here is a DEMO session (mode 'demo'); nothing in it is a camera reading.
import { DEMO_SCRAMBLES, demoFaces } from '@/demo/demo-fixtures';
import { demoSolve } from '@/demo/demo-solver';
import { runSolve } from '@/hooks/useSolveSession';
import { solve as solveBackend } from '@/services/solver-client';
import { useCubeStore } from '@/stores/cube-store';
import { buildSolveRequest, useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { solveRequestGuard } from '@/stores/solve-guard';
import { SCAN_FACE_ORDER, type FaceId, type SixFaces } from '@/types/cube';

/** Demo cube index of a seed (wraps over the preset scrambles). */
export const demoIndexForSeed = (seed: number): number => Math.abs(seed) % DEMO_SCRAMBLES.length;

/** The six grids a demo "scan" captures for `seed`. */
export const demoFacesForSeed = (seed: number): SixFaces => demoFaces(demoIndexForSeed(seed));

/** Starts a solve for the captured grids once all six exist. Singleton guard + session id come from the stores. */
function solveWhenComplete(): void {
  // One solve per completion: never restart while solving, or blank an already-ready solution.
  if (useCubeStore.getState().status !== 'idle') return;
  const request = buildSolveRequest(useScanStore.getState().captured);
  if (!request) return;
  const c = useCubeStore.getState();
  void runSolve(request, {
    mode: useSessionStore.getState().mode,
    getSessionId: () => useSessionStore.getState().sessionId,
    guard: solveRequestGuard,
    solveBackend: (r, o) => solveBackend(r, o),
    solveDemo: demoSolve,
    actions: { beginSolve: c.beginSolve, setReady: c.setReady, setError: c.setError },
  });
}

/** Fresh demo scan session on the current demo cube, or the next one when `newSeed`. */
export function startDemoScan(newSeed = false): void {
  if (newSeed) useSessionStore.getState().advanceDemoSeed();
  useSessionStore.getState().startSession('demo', 'scanning');
  useScanStore.getState().setCondition('loading_model');
}

/** "Interactive demo" shortcut: all six demo faces captured, straight to reconstruction, solve started once. */
export function startDemoShortcut(): void {
  useSessionStore.getState().startSession('demo', 'reconstructing');
  const faces = demoFacesForSeed(useSessionStore.getState().demoSeed);
  for (const f of SCAN_FACE_ORDER) useScanStore.getState().captureFace(f, faces[f], 'demo');
  solveWhenComplete();
}

/** Captures the current face from the demo fixture. Demo sessions only; a no-op otherwise. */
export function captureDemoFace(): void {
  const session = useSessionStore.getState();
  if (session.mode !== 'demo') return;
  const face: FaceId | undefined = SCAN_FACE_ORDER[useScanStore.getState().stageIndex];
  if (!face) return;
  const grid = demoFacesForSeed(session.demoSeed)[face];
  const count = () => Object.keys(useScanStore.getState().captured).length;
  const before = count();
  // Solve only when THIS capture completed the set of six.
  if (useScanStore.getState().captureFace(face, grid, 'demo') && before < 6 && count() === 6) solveWhenComplete();
}
