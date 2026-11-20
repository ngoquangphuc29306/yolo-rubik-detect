// Wire contracts (schemaVersion 1; ARCHITECTURE §8.2/§8.3). T1.6 extends this file.
import type { CenterColors, ColorName, FaceId } from './cube';

export interface SolveRequest {
  schemaVersion: 1;
  faces: Record<FaceId, ColorName[]>;
}

export interface SolveResponse {
  schemaVersion: 1;
  centerColors: CenterColors;
  initialState: string;
  moves: string[];
  moveCount: number;
}
