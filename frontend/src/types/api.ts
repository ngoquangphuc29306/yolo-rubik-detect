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

// Server wire codes ONLY (ARCHITECTURE §8.3). Client-only failures are a separate union below.
export type ApiErrorCode =
  | 'INVALID_FACE_SHAPE'
  | 'DUPLICATE_CENTER'
  | 'COLOR_COUNT_MISMATCH'
  | 'INVALID_CUBE_STATE'
  | 'SOLVER_TIMEOUT'
  | 'MODEL_UNAVAILABLE'
  | 'FRAME_TOO_LARGE'
  | 'INVALID_FRAME';

export interface ApiErrorEnvelope {
  error: { code: ApiErrorCode; message: string; retryable: boolean };
}

/** Client-side only; never part of a wire payload. */
export type ClientErrorCode =
  | 'NETWORK'
  | 'BACKEND_UNAVAILABLE'
  | 'BAD_RESPONSE'
  | 'RESPONSE_MISMATCH'
  | 'SOLUTION_REPLAY_MISMATCH'
  | 'REQUEST_CANCELLED'
  | 'REQUEST_INVALID';

export type SolveError =
  | { kind: 'api'; code: ApiErrorCode; message: string; retryable: boolean }
  | { kind: 'client'; code: ClientErrorCode; message: string; retryable: boolean };

export type SolveProvenance = 'backend' | 'demo-fixture';

/** Provenance lives OUTSIDE the wire object. */
export interface SolveOutcome {
  readonly response: SolveResponse;
  readonly source: SolveProvenance;
}

export interface HealthResponse {
  schemaVersion: 1;
  status: 'ok' | 'degraded' | 'error';
  detectorMode: 'fixture' | 'yolo';
  visionReady: boolean;
  solverReady: boolean;
  modelVersion?: string;
  device?: string;
  error?: string;
}

export type LiveReadiness =
  | { kind: 'ready' }
  | { kind: 'fixture-only'; solverReady: boolean }
  | { kind: 'blocked'; reason: 'MODEL_UNAVAILABLE' | 'BACKEND_UNAVAILABLE'; solverReady: boolean };

export interface FrameCell {
  color: ColorName | null;
  confidence: number | null;
  status: 'ok' | 'missing' | 'ambiguous' | 'misaligned';
}

export interface ScanReady {
  type: 'ready';
  schemaVersion: 1;
  scanId: string;
  modelVersion: string;
  imgsz: number;
  maxFrameBytes: number;
  maxFrameEdge: number;
}

export interface ScanServerError {
  type: 'error';
  schemaVersion: 1;
  code: 'FRAME_TOO_LARGE' | 'INVALID_FRAME' | 'MODEL_UNAVAILABLE';
  message: string;
  retryable: boolean;
}

export type ScanServerMessage = ScanReady | FrameResult | ScanServerError;

export interface FrameResult {
  type: 'frame_result';
  schemaVersion: 1;
  scanId: string;
  frameSeq: number;
  width: number;
  height: number;
  detections: { classId: number; color: ColorName; confidence: number; xyxy: [number, number, number, number] }[];
  cells: FrameCell[];
  grid: ColorName[] | null;
  quality: { valid: boolean; reason?: string };
  inferenceMs: number;
}
