// Solve lifecycle state. The solution is only ever set from a bound + replay-verified response.
import { create } from 'zustand';
import type { CenterColors, FaceletState, MoveToken } from '@/types/cube';
import type { SolveError, SolveProvenance } from '@/types/api';

export interface SolutionData {
  readonly state: FaceletState;
  readonly centers: CenterColors;
  readonly moves: readonly MoveToken[];
  readonly snapshots: readonly FaceletState[];
  readonly source: SolveProvenance;
}

export type SolveStatus = 'idle' | 'solving' | 'ready' | 'error';

interface CubeStoreState {
  status: SolveStatus;
  solution: SolutionData | null;
  error: SolveError | null;
  beginSolve: () => void;
  setReady: (solution: SolutionData) => void;
  setError: (error: SolveError) => void;
  reset: () => void;
}

export const useCubeStore = create<CubeStoreState>((set) => ({
  status: 'idle',
  solution: null,
  error: null,
  beginSolve: () => set({ status: 'solving', solution: null, error: null }),
  setReady: (solution) => set({ status: 'ready', solution, error: null }),
  setError: (error) => set({ status: 'error', solution: null, error }),
  reset: () => set({ status: 'idle', solution: null, error: null }),
}));
