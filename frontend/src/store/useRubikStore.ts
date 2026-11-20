// TEMPORARY BRIDGE -- removed in T1.17.
// Session, scan and cube data now live in stores/{session,scan,cube}-store. The fields of this legacy store that
// mirror them are DERIVED one-way by `syncMirror` (subscribed at the bottom) and are never written by the actions
// here; the session actions DELEGATE to the new stores. UI-local fields stay legacy-owned until their screen migrates.
import { create } from 'zustand';
import type { CubieState, FaceKey, MoveNotation, StickerColor } from '@/lib/cubeEngine';
import { colorNameToCode } from '@/lib/colors';
import { DEMO_CENTER_COLORS, DEMO_SCRAMBLES, demoFaces, demoInitialState } from '@/demo/demo-fixtures';
import { demoSolve } from '@/demo/demo-solver';
import { toCubies } from '@/engine/cubie-adapter';
import { runSolve } from '@/hooks/useSolveSession';
import { solve as solveBackend } from '@/services/solver-client';
import { useCubeStore } from '@/stores/cube-store';
import { buildSolveRequest, useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { solveRequestGuard } from '@/stores/solve-guard';
import { SCAN_FACE_ORDER, type FaceGrid } from '@/types/cube';

export type AppScreen =
  | 'landing'
  | 'scanning'
  | 'reconstructing'
  | 'alignment'
  | 'solving'
  | 'completion';

export type FaceCaptureStatus = 'pending' | 'scanning' | 'captured' | 'rescan';

export type ScanCondition =
  | 'ready'
  | 'loading_model'
  | 'permission_denied'
  | 'no_cube'
  | 'missing_stickers'
  | 'wrong_face'
  | 'unstable'
  | 'captured_flash';

interface RubikStoreState {
  screen: AppScreen; // mirror: session-store
  sessionSeed: number; // legacy-owned: picks the demo cube
  initialCube: CubieState[]; // mirror: cube-store solution (or the demo cube of sessionSeed before a solve)
  solution: MoveNotation[]; // mirror: cube-store solution moves
  targetFaces: Record<FaceKey, StickerColor[]>; // mirror: demo faces of sessionSeed (demo only)

  // Guided Scanning state
  activeFaceIndex: number; // mirror: scan-store
  faceStatuses: Record<FaceKey, FaceCaptureStatus>; // mirror: scan-store
  capturedFaces: Partial<Record<FaceKey, StickerColor[]>>; // mirror: scan-store
  scanCondition: ScanCondition; // mirror: scan-store
  stabilityProgress: number; // mirror: scan-store, 0..100
  useRealWebcam: boolean;
  autoCaptureEnabled: boolean; // mirror: session-store settings

  // Reconstruction state
  forceInvalidCube: boolean;
  invalidReason: string | null;
  invalidFaceKey: FaceKey | null;

  // Solving state
  moveDelaySeconds: number; // mirror: session-store settings, 2..15
  currentStepIndex: number; // 0..solution.length
  isPlaying: boolean;
  soundEnabled: boolean; // mirror: session-store settings
  solveElapsedSeconds: number;
  userConfirmedSolved: boolean;
  cameraResetToken: number;

  // Actions
  setScreen: (screen: AppScreen) => void;
  startFreshScan: (newSeed?: boolean) => void;
  startInteractiveDemo: () => void;
  setScanCondition: (condition: ScanCondition) => void;
  setStabilityProgress: (value: number) => void;
  captureCurrentFace: () => void;
  selectFaceForRescan: (face: FaceKey) => void;
  markFaceNeedsRescan: (face: FaceKey) => void;
  setUseRealWebcam: (enabled: boolean) => void;
  setAutoCaptureEnabled: (enabled: boolean) => void;
  setForceInvalidCube: (invalid: boolean) => void;
  setMoveDelaySeconds: (seconds: number) => void;
  setCurrentStepIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  toggleSound: () => void;
  incrementSolveElapsed: () => void;
  resetSolveSession: () => void;
  confirmCubeSolved: () => void;
  triggerCameraReset: () => void;
}

const FACE_ORDER: readonly FaceKey[] = SCAN_FACE_ORDER;
const EMPTY_SOLUTION: MoveNotation[] = [];

const demoIndex = (seed: number) => Math.abs(seed) % DEMO_SCRAMBLES.length;

const gridToCodes = (grid: FaceGrid): StickerColor[] => grid.map(colorNameToCode);

function demoTargetFaces(seed: number): Record<FaceKey, StickerColor[]> {
  const faces = demoFaces(demoIndex(seed));
  return Object.fromEntries(FACE_ORDER.map((f) => [f, gridToCodes(faces[f])])) as Record<FaceKey, StickerColor[]>;
}

// Memoised so unchanged inputs keep referentially stable mirrors.
let targetKey: number | null = null;
let targetCache: Record<FaceKey, StickerColor[]>;
let cubeKey: { seed: number; solution: unknown } | null = null;
let cubeCache: CubieState[];
let solutionKey: unknown = null;
let solutionCache: MoveNotation[] = EMPTY_SOLUTION;
let capturedKey: unknown = null;
let capturedCache: Partial<Record<FaceKey, StickerColor[]>> = {};

type MirroredKeys =
  | 'screen' | 'initialCube' | 'solution' | 'targetFaces' | 'activeFaceIndex' | 'faceStatuses' | 'capturedFaces'
  | 'scanCondition' | 'stabilityProgress' | 'autoCaptureEnabled' | 'moveDelaySeconds' | 'soundEnabled';

function mirrorFields(seed: number): Pick<RubikStoreState, MirroredKeys> {
  const session = useSessionStore.getState();
  const scan = useScanStore.getState();
  const cube = useCubeStore.getState();

  if (targetKey !== seed) {
    targetKey = seed;
    targetCache = demoTargetFaces(seed);
  }
  if (capturedKey !== scan.captured) {
    capturedKey = scan.captured;
    capturedCache = {};
    for (const f of FACE_ORDER) {
      const c = scan.captured[f];
      if (c) capturedCache[f] = gridToCodes(c.grid);
    }
  }
  if (!cubeKey || cubeKey.seed !== seed || cubeKey.solution !== cube.solution) {
    cubeKey = { seed, solution: cube.solution };
    cubeCache = (
      cube.solution
        ? toCubies(cube.solution.state, cube.solution.centers)
        : toCubies(demoInitialState(demoIndex(seed)), DEMO_CENTER_COLORS)
    ) as CubieState[];
  }

  if (solutionKey !== cube.solution) {
    solutionKey = cube.solution;
    solutionCache = cube.solution ? ([...cube.solution.moves] as MoveNotation[]) : EMPTY_SOLUTION;
  }

  return {
    screen: session.screen,
    moveDelaySeconds: session.settings.delayMs / 1000,
    soundEnabled: session.settings.soundEnabled,
    autoCaptureEnabled: session.settings.autoCaptureEnabled,
    activeFaceIndex: scan.stageIndex,
    faceStatuses: scan.faceStatuses,
    capturedFaces: capturedCache,
    scanCondition: scan.condition,
    stabilityProgress: scan.stability,
    targetFaces: targetCache,
    initialCube: cubeCache,
    solution: solutionCache,
  };
}

/** Starts a solve for the captured grids once all six exist. Singleton guard + session id come from the stores. */
function solveWhenComplete() {
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

const UI_LOCAL_RESET = {
  forceInvalidCube: false,
  invalidReason: null,
  invalidFaceKey: null,
  currentStepIndex: 0,
  solveElapsedSeconds: 0,
  userConfirmedSolved: false,
} as const;

export const useRubikStore = create<RubikStoreState>((set, get) => ({
  ...mirrorFields(0),
  sessionSeed: 0,

  useRealWebcam: false,

  forceInvalidCube: false,
  invalidReason: null,
  invalidFaceKey: null,

  currentStepIndex: 0,
  isPlaying: true,
  solveElapsedSeconds: 0,
  userConfirmedSolved: false,
  cameraResetToken: 0,

  setScreen: (screen) => useSessionStore.getState().setScreen(screen),

  startFreshScan: (newSeed = false) => {
    const nextSeed = newSeed ? get().sessionSeed + 1 : get().sessionSeed;
    // Seed first (legacy-owned); the session reset then republishes every mirror against it.
    set({ sessionSeed: nextSeed, ...UI_LOCAL_RESET });
    useSessionStore.getState().startSession('demo', 'scanning');
    useScanStore.getState().setCondition('loading_model');
    syncMirror();
  },

  startInteractiveDemo: () => {
    set({ ...UI_LOCAL_RESET, isPlaying: true });
    useSessionStore.getState().startSession('demo', 'reconstructing');
    const faces = demoFaces(demoIndex(get().sessionSeed));
    for (const f of FACE_ORDER) useScanStore.getState().captureFace(f, faces[f], 'demo');
    solveWhenComplete();
  },

  setScanCondition: (condition) => useScanStore.getState().setCondition(condition),

  setStabilityProgress: (value) => useScanStore.getState().setStability(value),

  captureCurrentFace: () => {
    // Fixture capture is legitimate only inside a demo session.
    if (useSessionStore.getState().mode !== 'demo') return;
    const face = SCAN_FACE_ORDER[useScanStore.getState().stageIndex];
    if (!face) return;
    const grid = demoFaces(demoIndex(get().sessionSeed))[face];
    const count = () => Object.keys(useScanStore.getState().captured).length;
    const before = count();
    // Solve only when THIS capture completed the set of six.
    if (useScanStore.getState().captureFace(face, grid, 'demo') && before < 6 && count() === 6) solveWhenComplete();
  },

  selectFaceForRescan: (face) => {
    // The captured grids change, so any solution or in-flight solve for the old grids is void.
    solveRequestGuard.reset();
    useCubeStore.getState().reset();
    useScanStore.getState().selectFaceForRescan(face);
    useSessionStore.getState().setScreen('scanning');
    set({ forceInvalidCube: false });
  },

  markFaceNeedsRescan: (face) => useScanStore.getState().markFaceNeedsRescan(face),

  setUseRealWebcam: (useRealWebcam) => set({ useRealWebcam }),

  setAutoCaptureEnabled: (enabled) => useSessionStore.getState().setAutoCapture(enabled),

  setForceInvalidCube: (forceInvalidCube) =>
    set({
      forceInvalidCube,
      invalidReason: forceInvalidCube
        ? 'Color distribution mismatch on the Back face: 10 red stickers and 8 orange stickers detected.'
        : null,
      invalidFaceKey: forceInvalidCube ? 'B' : null,
    }),

  setMoveDelaySeconds: (seconds) => useSessionStore.getState().setDelayMs(seconds * 1000),

  setCurrentStepIndex: (currentStepIndex) => set({ currentStepIndex }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  toggleSound: () => useSessionStore.getState().toggleSound(),

  incrementSolveElapsed: () =>
    set((s) => ({ solveElapsedSeconds: s.solveElapsedSeconds + 1 })),

  resetSolveSession: () => {
    set({ currentStepIndex: 0, isPlaying: true, solveElapsedSeconds: 0, userConfirmedSolved: false });
    useSessionStore.getState().setScreen('solving');
  },

  confirmCubeSolved: () => set({ userConfirmedSolved: true }),

  triggerCameraReset: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1 })),
}));

/** One-way: new stores -> legacy mirrors. The only writer of mirrored fields after boot. */
function syncMirror() {
  const current = useRubikStore.getState();
  const next = mirrorFields(current.sessionSeed);
  const changed = (Object.keys(next) as MirroredKeys[]).some((k) => !Object.is(next[k], current[k]));
  if (changed) useRubikStore.setState(next);
}

useSessionStore.subscribe(syncMirror);
useScanStore.subscribe(syncMirror);
useCubeStore.subscribe(syncMirror);
