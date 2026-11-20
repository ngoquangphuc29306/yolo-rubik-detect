// Guided scan state. Stores the grids it is GIVEN; it never reads any fixture.
import { create } from 'zustand';
import { SCAN_FACE_ORDER, type ColorName, type FaceGrid, type FaceId } from '@/types/cube';
import type { SolveRequest } from '@/types/api';
import type { DemoScanCondition } from '@/demo/demo-scan-source';

export type ScanCondition = DemoScanCondition | 'captured_flash';
export type FaceCaptureStatus = 'pending' | 'scanning' | 'captured' | 'rescan';
export type CaptureSource = 'demo' | 'live';
export type CapturedFaces = Partial<Record<FaceId, { grid: FaceGrid; source: CaptureSource }>>;

const COLORS: readonly string[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green'];

const initialStatuses = (): Record<FaceId, FaceCaptureStatus> => ({
  F: 'scanning', R: 'pending', B: 'pending', L: 'pending', U: 'pending', D: 'pending',
});

function isValidGrid(grid: unknown): grid is FaceGrid {
  if (!Array.isArray(grid) || grid.length !== 9) return false;
  for (let i = 0; i < 9; i++) {
    // Own property check rejects sparse arrays (holes) that `every` would skip.
    if (!Object.prototype.hasOwnProperty.call(grid, i)) return false;
    const c: unknown = grid[i];
    if (typeof c !== 'string' || !COLORS.includes(c)) return false;
  }
  return true;
}

interface ScanStoreState {
  stageIndex: number;
  faceStatuses: Record<FaceId, FaceCaptureStatus>;
  captured: CapturedFaces;
  condition: ScanCondition;
  stability: number;
  /** Returns false (state untouched) when the face or grid is invalid. */
  captureFace: (face: FaceId, grid: FaceGrid, source: CaptureSource) => boolean;
  selectFaceForRescan: (face: FaceId) => void;
  /** Flags a face as needing a rescan without discarding its grid (status only). */
  markFaceNeedsRescan: (face: FaceId) => void;
  setCondition: (condition: ScanCondition) => void;
  setStability: (value: number) => void;
  reset: () => void;
}

const initial = () => ({
  stageIndex: 0,
  faceStatuses: initialStatuses(),
  captured: {} as CapturedFaces,
  condition: 'ready' as ScanCondition,
  stability: 0,
});

export const useScanStore = create<ScanStoreState>((set, get) => ({
  ...initial(),

  captureFace: (face, grid, source) => {
    if (!SCAN_FACE_ORDER.includes(face) || !isValidGrid(grid)) return false;
    const { captured, faceStatuses } = get();
    const nextCaptured: CapturedFaces = { ...captured, [face]: { grid: [...grid] as unknown as FaceGrid, source } };
    const statuses = { ...faceStatuses };
    for (const f of SCAN_FACE_ORDER) {
      if (statuses[f] === 'scanning' && f !== face) statuses[f] = nextCaptured[f] ? 'captured' : 'pending';
    }
    statuses[face] = 'captured';
    const nextIdx = SCAN_FACE_ORDER.findIndex((f) => statuses[f] === 'rescan' || statuses[f] === 'pending');
    if (nextIdx === -1) {
      set({ captured: nextCaptured, faceStatuses: statuses, stability: 100, condition: 'captured_flash' });
    } else {
      statuses[SCAN_FACE_ORDER[nextIdx]] = 'scanning';
      set({ captured: nextCaptured, faceStatuses: statuses, stageIndex: nextIdx, stability: 0, condition: 'captured_flash' });
    }
    return true;
  },

  selectFaceForRescan: (face) => {
    const idx = SCAN_FACE_ORDER.indexOf(face);
    if (idx === -1) return;
    set((s) => {
      const statuses = { ...s.faceStatuses };
      for (const f of SCAN_FACE_ORDER) if (statuses[f] === 'scanning') statuses[f] = s.captured[f] ? 'captured' : 'pending';
      statuses[face] = 'scanning';
      const captured = { ...s.captured };
      delete captured[face];
      return { faceStatuses: statuses, captured, stageIndex: idx, stability: 0, condition: 'ready' as ScanCondition };
    });
  },

  markFaceNeedsRescan: (face) => {
    if (!SCAN_FACE_ORDER.includes(face)) return;
    set((s) => ({ faceStatuses: { ...s.faceStatuses, [face]: 'rescan' as FaceCaptureStatus } }));
  },

  setCondition: (condition) => set((s) => ({ condition, stability: condition === 'ready' ? s.stability : 0 })),
  setStability: (value) => set({ stability: Math.max(0, Math.min(100, value)) }),
  reset: () => set(initial()),
}));

/** Pure. null unless all six faces are captured. */
export function buildSolveRequest(captured: CapturedFaces): SolveRequest | null {
  const faces = {} as Record<FaceId, ColorName[]>;
  for (const f of SCAN_FACE_ORDER) {
    const c = captured[f];
    if (!c) return null;
    faces[f] = [...c.grid];
  }
  return { schemaVersion: 1, faces };
}
