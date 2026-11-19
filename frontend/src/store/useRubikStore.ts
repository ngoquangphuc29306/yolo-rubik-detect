import { create } from 'zustand';
import {
  CubieState,
  FACE_ORDER,
  FaceKey,
  MoveNotation,
  StickerColor,
  extractAllFaces,
  generateScrambleSession,
} from '@/lib/cubeEngine';

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
  screen: AppScreen;
  sessionSeed: number;
  initialCube: CubieState[];
  solution: MoveNotation[];
  targetFaces: Record<FaceKey, StickerColor[]>;

  // Guided Scanning state
  activeFaceIndex: number;
  faceStatuses: Record<FaceKey, FaceCaptureStatus>;
  capturedFaces: Partial<Record<FaceKey, StickerColor[]>>;
  scanCondition: ScanCondition;
  stabilityProgress: number; // 0..100
  useRealWebcam: boolean;
  autoCaptureEnabled: boolean;

  // Reconstruction state
  forceInvalidCube: boolean;
  invalidReason: string | null;
  invalidFaceKey: FaceKey | null;

  // Solving state
  moveDelaySeconds: number; // 2..15
  currentStepIndex: number; // 0..solution.length
  isPlaying: boolean;
  soundEnabled: boolean;
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

function createInitialSession(seed: number) {
  const { initialCube, solution } = generateScrambleSession(seed);
  const targetFaces = extractAllFaces(initialCube);
  return { initialCube, solution, targetFaces };
}

function defaultFaceStatuses(): Record<FaceKey, FaceCaptureStatus> {
  return {
    F: 'scanning',
    R: 'pending',
    B: 'pending',
    L: 'pending',
    U: 'pending',
    D: 'pending',
  };
}

const bootSession = createInitialSession(0);

export const useRubikStore = create<RubikStoreState>((set, get) => ({
  screen: 'landing',
  sessionSeed: 0,
  initialCube: bootSession.initialCube,
  solution: bootSession.solution,
  targetFaces: bootSession.targetFaces,

  activeFaceIndex: 0,
  faceStatuses: defaultFaceStatuses(),
  capturedFaces: {},
  scanCondition: 'ready',
  stabilityProgress: 0,
  useRealWebcam: false,
  autoCaptureEnabled: true,

  forceInvalidCube: false,
  invalidReason: null,
  invalidFaceKey: null,

  moveDelaySeconds: 5,
  currentStepIndex: 0,
  isPlaying: true,
  soundEnabled: true,
  solveElapsedSeconds: 0,
  userConfirmedSolved: false,
  cameraResetToken: 0,

  setScreen: (screen) => set({ screen }),

  startFreshScan: (newSeed = false) => {
    const nextSeed = newSeed ? get().sessionSeed + 1 : get().sessionSeed;
    const session = createInitialSession(nextSeed);
    set({
      screen: 'scanning',
      sessionSeed: nextSeed,
      initialCube: session.initialCube,
      solution: session.solution,
      targetFaces: session.targetFaces,
      activeFaceIndex: 0,
      faceStatuses: defaultFaceStatuses(),
      capturedFaces: {},
      scanCondition: 'loading_model',
      stabilityProgress: 0,
      forceInvalidCube: false,
      invalidReason: null,
      invalidFaceKey: null,
      currentStepIndex: 0,
      solveElapsedSeconds: 0,
      userConfirmedSolved: false,
    });
  },

  startInteractiveDemo: () => {
    const session = createInitialSession(get().sessionSeed);
    const allStatuses: Record<FaceKey, FaceCaptureStatus> = {
      F: 'captured',
      R: 'captured',
      B: 'captured',
      L: 'captured',
      U: 'captured',
      D: 'captured',
    };
    set({
      screen: 'reconstructing',
      initialCube: session.initialCube,
      solution: session.solution,
      targetFaces: session.targetFaces,
      faceStatuses: allStatuses,
      capturedFaces: { ...session.targetFaces },
      activeFaceIndex: 5,
      forceInvalidCube: false,
      invalidReason: null,
      invalidFaceKey: null,
      currentStepIndex: 0,
      solveElapsedSeconds: 0,
      userConfirmedSolved: false,
      isPlaying: true,
    });
  },

  setScanCondition: (scanCondition) =>
    set((state) => ({
      scanCondition,
      stabilityProgress: scanCondition === 'ready' ? state.stabilityProgress : 0,
    })),

  setStabilityProgress: (stabilityProgress) => set({ stabilityProgress }),

  captureCurrentFace: () => {
    const state = get();
    const faceKey = FACE_ORDER[state.activeFaceIndex];
    if (!faceKey) return;

    const updatedCaptured: Partial<Record<FaceKey, StickerColor[]>> = {
      ...state.capturedFaces,
      [faceKey]: [...state.targetFaces[faceKey]],
    };

    const updatedStatuses: Record<FaceKey, FaceCaptureStatus> = {
      ...state.faceStatuses,
      [faceKey]: 'captured',
    };

    // Find next uncaptured face (rescan or pending)
    const nextIdx = FACE_ORDER.findIndex(
      (k) => updatedStatuses[k] === 'rescan' || updatedStatuses[k] === 'pending'
    );

    if (nextIdx === -1) {
      set({
        capturedFaces: updatedCaptured,
        faceStatuses: updatedStatuses,
        stabilityProgress: 100,
        scanCondition: 'captured_flash',
      });
    } else {
      const nextFaceKey = FACE_ORDER[nextIdx];
      updatedStatuses[nextFaceKey] = 'scanning';
      set({
        capturedFaces: updatedCaptured,
        faceStatuses: updatedStatuses,
        activeFaceIndex: nextIdx,
        stabilityProgress: 0,
        scanCondition: 'captured_flash',
      });
    }
  },

  selectFaceForRescan: (face) => {
    const idx = FACE_ORDER.indexOf(face);
    if (idx === -1) return;
    set((state) => {
      const updatedStatuses = { ...state.faceStatuses };
      // Revert any previously scanning face that wasn't captured back to pending
      for (const k of FACE_ORDER) {
        if (updatedStatuses[k] === 'scanning') {
          updatedStatuses[k] = state.capturedFaces[k] ? 'captured' : 'pending';
        }
      }
      updatedStatuses[face] = 'scanning';
      const updatedCaptured = { ...state.capturedFaces };
      delete updatedCaptured[face];
      return {
        screen: 'scanning',
        activeFaceIndex: idx,
        faceStatuses: updatedStatuses,
        capturedFaces: updatedCaptured,
        stabilityProgress: 0,
        scanCondition: 'ready',
        forceInvalidCube: false,
      };
    });
  },

  markFaceNeedsRescan: (face) => {
    set((state) => ({
      faceStatuses: {
        ...state.faceStatuses,
        [face]: 'rescan',
      },
    }));
  },

  setUseRealWebcam: (useRealWebcam) => set({ useRealWebcam }),

  setAutoCaptureEnabled: (autoCaptureEnabled) => set({ autoCaptureEnabled }),

  setForceInvalidCube: (forceInvalidCube) =>
    set({
      forceInvalidCube,
      invalidReason: forceInvalidCube
        ? 'Color distribution mismatch on the Back face: 10 red stickers and 8 orange stickers detected.'
        : null,
      invalidFaceKey: forceInvalidCube ? 'B' : null,
    }),

  setMoveDelaySeconds: (seconds) =>
    set({ moveDelaySeconds: Math.max(2, Math.min(15, Math.round(seconds))) }),

  setCurrentStepIndex: (currentStepIndex) => set({ currentStepIndex }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  incrementSolveElapsed: () =>
    set((s) => ({ solveElapsedSeconds: s.solveElapsedSeconds + 1 })),

  resetSolveSession: () =>
    set({
      currentStepIndex: 0,
      isPlaying: true,
      solveElapsedSeconds: 0,
      userConfirmedSolved: false,
      screen: 'solving',
    }),

  confirmCubeSolved: () => set({ userConfirmedSolved: true }),

  triggerCameraReset: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1 })),
}));
