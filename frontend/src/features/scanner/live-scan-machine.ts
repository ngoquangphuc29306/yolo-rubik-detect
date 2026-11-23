// Pure guided-scan state machine (no React, timers or network).
// Centre-colour checks catch some mistakes only; they do not prove whole-cube
// orientation or face roll.
import { SCAN_FACE_ORDER, type ColorName, type FaceGrid, type FaceId } from '@/types/cube';
import type { FrameResult } from '@/types/api';

export const STABLE_RESULTS = 5;
export const STABLE_MS = 1000;
export const ROTATION_MS = 1500;

export type LivePhase = 'aligning' | 'stabilizing' | 'captured' | 'rotating' | 'done';
type Centers = Partial<Record<FaceId, ColorName>>;

export interface LiveScanState {
  stage: FaceId;
  phase: LivePhase;
  epoch: number;
  streak: { grid: ColorName[]; count: number; since: number } | null;
  hint: string | null;
  capturedCenters: Centers;
  rescan: { face: FaceId; previousCenter: ColorName } | null;
  pendingCapture: { face: FaceId; grid: FaceGrid } | null;
}

export type LiveScanEvent =
  | { type: 'RESULT'; epoch: number; result: FrameResult; at: number }
  | { type: 'CAPTURE_STORED'; epoch: number }
  | { type: 'CAPTURE_FAILED'; epoch: number }
  | { type: 'ROTATION_DONE'; epoch: number }
  | { type: 'RESCAN'; face: FaceId; previousCenter: ColorName }
  | { type: 'RESET'; centers?: Centers };

const firstUncaptured = (centers: Centers): FaceId | null =>
  SCAN_FACE_ORDER.find((f) => centers[f] === undefined) ?? null;

function build(centers: Centers, epoch: number): LiveScanState {
  const stage = firstUncaptured(centers);
  return {
    stage: stage ?? SCAN_FACE_ORDER[SCAN_FACE_ORDER.length - 1]!,
    phase: stage ? 'aligning' : 'done',
    epoch,
    streak: null,
    hint: null,
    capturedCenters: { ...centers },
    rescan: null,
    pendingCapture: null,
  };
}

export function initialLiveScanState(centers: Centers = {}): LiveScanState {
  return build(centers, 0);
}

export function hintForReason(reason: string | undefined): string {
  switch (reason) {
    case 'NO_FACE': return 'Place one cube face inside the square.';
    case 'INCOMPLETE': return 'Some stickers are not detected. Hold the face flat and steady.';
    case 'AMBIGUOUS': return 'A sticker colour is unclear. Improve the light or the angle.';
    case 'MISALIGNED': return 'Line the face up with the grid.';
    case 'TILTED': return 'Hold the face straight toward the camera.';
    default: return 'Hold the face steady inside the square.';
  }
}

export function stabilityProgress(state: LiveScanState, at: number): number {
  const s = state.streak;
  if (!s) return 0;
  const p = Math.min(s.count / STABLE_RESULTS, (at - s.since) / STABLE_MS);
  return Math.max(0, Math.min(1, p));
}

const sameGrid = (a: readonly ColorName[], b: readonly ColorName[]) =>
  a.length === b.length && a.every((c, i) => c === b[i]);

/** Returns a rejection hint, or null when the centre colour may be captured. */
function gateHint(state: LiveScanState, c: ColorName): string | null {
  if (state.stage === 'F' && c !== 'green') {
    return 'Hold the face with the green centre toward the camera and white on top.';
  }
  if (state.stage === 'U' && c !== 'white') {
    return 'The top face centre should be white. Return to the green face, then tilt the top toward you.';
  }
  if (Object.values(state.capturedCenters).includes(c)) {
    return `We still see the ${c} face. Follow the arrow and turn the whole cube.`;
  }
  if (state.rescan && state.rescan.face === state.stage && c !== state.rescan.previousCenter) {
    return `This is not the same face as before. Show the ${state.rescan.previousCenter}-centred face again.`;
  }
  return null;
}

function onResult(state: LiveScanState, result: FrameResult, at: number): LiveScanState {
  if (!result.quality.valid || result.grid === null) {
    return { ...state, streak: null, phase: 'aligning', hint: hintForReason(result.quality.reason) };
  }
  const grid = result.grid;
  const streak =
    state.streak && sameGrid(state.streak.grid, grid)
      ? { ...state.streak, count: state.streak.count + 1 }
      : { grid: [...grid], count: 1, since: at };
  const next: LiveScanState = { ...state, streak, phase: 'stabilizing', hint: null };
  if (streak.count < STABLE_RESULTS || at - streak.since < STABLE_MS) return next;
  const hint = gateHint(state, grid[4]!);
  if (hint) return { ...next, streak: null, phase: 'aligning', hint };
  return {
    ...next,
    phase: 'captured',
    pendingCapture: { face: state.stage, grid: [...grid] as unknown as FaceGrid },
  };
}

export function liveScanReducer(state: LiveScanState, event: LiveScanEvent): LiveScanState {
  switch (event.type) {
    case 'RESULT':
      if (event.epoch !== state.epoch) return state;
      if (state.phase === 'captured' || state.phase === 'rotating' || state.phase === 'done') return state;
      return onResult(state, event.result, event.at);
    case 'CAPTURE_STORED': {
      if (event.epoch !== state.epoch || state.phase !== 'captured' || !state.pendingCapture) return state;
      const centers: Centers = { ...state.capturedCenters, [state.stage]: state.pendingCapture.grid[4] };
      const stage = firstUncaptured(centers);
      return {
        ...state,
        stage: stage ?? state.stage,
        phase: stage ? 'rotating' : 'done',
        capturedCenters: centers,
        pendingCapture: null,
        rescan: null,
        streak: null,
        hint: null,
        epoch: state.epoch + 1,
      };
    }
    case 'CAPTURE_FAILED':
      if (event.epoch !== state.epoch || state.phase !== 'captured') return state;
      return {
        ...state,
        phase: 'aligning',
        streak: null,
        pendingCapture: null,
        hint: 'Could not save this face — hold steady to try again.',
      };
    case 'ROTATION_DONE':
      if (event.epoch !== state.epoch || state.phase !== 'rotating') return state;
      return { ...state, phase: 'aligning', hint: null, epoch: state.epoch + 1 };
    case 'RESCAN': {
      const rest: Centers = { ...state.capturedCenters };
      delete rest[event.face];
      return {
        ...state,
        stage: event.face,
        phase: 'aligning',
        capturedCenters: rest,
        rescan: { face: event.face, previousCenter: event.previousCenter },
        streak: null,
        pendingCapture: null,
        hint: null,
        epoch: state.epoch + 1,
      };
    }
    case 'RESET':
      return build(event.centers ?? {}, state.epoch + 1);
  }
}
