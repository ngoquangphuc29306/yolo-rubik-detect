// Strict hand-written runtime validators for wire payloads. Reject extra keys, wrong types and illegal values.
import { SOLVER_FACE_ORDER, type CenterColors, type ColorName, type FaceId } from '@/types/cube';
import type {
  ApiErrorCode,
  ApiErrorEnvelope,
  FrameCell,
  FrameResult,
  HealthResponse,
  ScanReady,
  ScanServerError,
  ScanServerMessage,
  SolveError,
  SolveResponse,
} from '@/types/api';
import { COLOR_NAMES } from '@/lib/colors';
import { validateFaceletString } from '@/engine/cube-state';
import { parseMoveToken } from '@/engine/move-engine';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: SolveError };

type ClientSolveError = Extract<SolveError, { kind: 'client' }>;

export function clientError(code: ClientSolveError['code'], message: string, retryable = false): SolveError {
  return { kind: 'client', code, message, retryable };
}

const API_CODES: readonly ApiErrorCode[] = [
  'INVALID_FACE_SHAPE', 'DUPLICATE_CENTER', 'COLOR_COUNT_MISMATCH', 'INVALID_CUBE_STATE',
  'SOLVER_TIMEOUT', 'MODEL_UNAVAILABLE', 'FRAME_TOO_LARGE', 'INVALID_FRAME',
];

class Bad extends Error {}
const bad = (msg: string): never => {
  throw new Bad(msg);
};

type Obj = Record<string, unknown>;

function exactObject(v: unknown, required: readonly string[], optional: readonly string[], what: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return bad(`${what} must be an object`);
  const o = v as Obj;
  for (const k of required) if (!Object.hasOwn(o, k)) bad(`${what} is missing "${k}"`);
  for (const k of Object.keys(o)) {
    if (!required.includes(k) && !optional.includes(k)) bad(`${what} has unexpected key "${k}"`);
  }
  return o;
}

function guarded<T>(what: string, fn: () => T): ParseResult<T> {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    const msg = e instanceof Bad ? e.message : 'could not be read';
    return { ok: false, error: clientError('BAD_RESPONSE', `Invalid ${what}: ${msg}`) };
  }
}

const isColor = (v: unknown): v is ColorName => typeof v === 'string' && (COLOR_NAMES as readonly string[]).includes(v);

function parseCenters(v: unknown): CenterColors {
  const o = exactObject(v, SOLVER_FACE_ORDER, [], 'centerColors');
  const seen = new Set<string>();
  for (const f of SOLVER_FACE_ORDER) {
    const c = o[f];
    if (!isColor(c)) bad(`centerColors.${f} is not a known colour`);
    if (seen.has(c as string)) bad(`centerColors repeats ${String(c)}`);
    seen.add(c as string);
  }
  return Object.fromEntries(SOLVER_FACE_ORDER.map((f: FaceId) => [f, o[f]])) as CenterColors;
}

export function parseSolveResponse(json: unknown): ParseResult<SolveResponse> {
  return guarded('solve response', () => {
    const o = exactObject(json, ['schemaVersion', 'centerColors', 'initialState', 'moves', 'moveCount'], [], 'solve response');
    if (o.schemaVersion !== 1) bad('unsupported schemaVersion');
    const centerColors = parseCenters(o.centerColors);
    const problem = validateFaceletString(o.initialState);
    if (problem !== null) bad(`initialState: ${problem}`);
    if (!Array.isArray(o.moves)) bad('moves must be an array');
    const moves = (o.moves as unknown[]).map((t) => {
      if (typeof t !== 'string') return bad('move token must be a string');
      try {
        return parseMoveToken(t);
      } catch {
        return bad(`illegal move token ${JSON.stringify(t)}`);
      }
    });
    if (!Number.isInteger(o.moveCount) || o.moveCount !== moves.length) bad('moveCount does not match moves.length');
    return {
      schemaVersion: 1,
      centerColors,
      initialState: o.initialState as string,
      moves: [...moves],
      moveCount: moves.length,
    };
  });
}

export function parseHealthResponse(json: unknown): ParseResult<HealthResponse> {
  return guarded('health response', () => {
    const o = exactObject(
      json,
      ['schemaVersion', 'status', 'detectorMode', 'visionReady', 'solverReady'],
      ['modelVersion', 'device', 'error'],
      'health response',
    );
    if (o.schemaVersion !== 1) bad('unsupported schemaVersion');
    if (o.status !== 'ok' && o.status !== 'degraded' && o.status !== 'error') bad('invalid status');
    if (o.detectorMode !== 'fixture' && o.detectorMode !== 'yolo') bad('invalid detectorMode');
    if (typeof o.visionReady !== 'boolean' || typeof o.solverReady !== 'boolean') bad('readiness flags must be booleans');
    for (const k of ['modelVersion', 'device', 'error']) {
      if (Object.hasOwn(o, k) && typeof o[k] !== 'string') bad(`${k} must be a string`);
    }
    return o as unknown as HealthResponse;
  });
}

const finite = (v: unknown, what: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : bad(`${what} must be a finite number`));
const nonNegInt = (v: unknown, what: string): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : bad(`${what} must be a non-negative integer`);
const str = (v: unknown, what: string): string => (typeof v === 'string' ? v : bad(`${what} must be a string`));
const color = (v: unknown, what: string): ColorName => (isColor(v) ? v : bad(`${what} is not a known colour`));
const arr = (v: unknown, what: string): unknown[] => (Array.isArray(v) ? v : bad(`${what} must be an array`));

const CELL_STATUSES: readonly FrameCell['status'][] = ['ok', 'missing', 'ambiguous', 'misaligned'];
const SCAN_ERROR_CODES: readonly ScanServerError['code'][] = ['FRAME_TOO_LARGE', 'INVALID_FRAME', 'MODEL_UNAVAILABLE'];

function parseScanReady(json: unknown): ScanReady {
  const o = exactObject(json, ['type', 'schemaVersion', 'scanId', 'modelVersion', 'imgsz', 'maxFrameBytes', 'maxFrameEdge'], [], 'ready');
  return {
    type: 'ready',
    schemaVersion: 1,
    scanId: str(o.scanId, 'scanId'),
    modelVersion: str(o.modelVersion, 'modelVersion'),
    imgsz: nonNegInt(o.imgsz, 'imgsz'),
    maxFrameBytes: nonNegInt(o.maxFrameBytes, 'maxFrameBytes'),
    maxFrameEdge: nonNegInt(o.maxFrameEdge, 'maxFrameEdge'),
  };
}

function parseScanError(json: unknown): ScanServerError {
  const o = exactObject(json, ['type', 'schemaVersion', 'code', 'message', 'retryable'], [], 'scan error');
  if (typeof o.code !== 'string' || !(SCAN_ERROR_CODES as readonly string[]).includes(o.code)) bad('unknown error code');
  if (typeof o.retryable !== 'boolean') bad('retryable must be a boolean');
  return {
    type: 'error',
    schemaVersion: 1,
    code: o.code as ScanServerError['code'],
    message: str(o.message, 'message'),
    retryable: o.retryable as boolean,
  };
}

function parseCell(v: unknown): FrameCell {
  const o = exactObject(v, ['color', 'confidence', 'status'], [], 'cell');
  if (typeof o.status !== 'string' || !(CELL_STATUSES as readonly string[]).includes(o.status)) bad('invalid cell status');
  if ((o.color === null) !== (o.confidence === null)) bad('cell colour and confidence must both be null or both set');
  return {
    color: o.color === null ? null : color(o.color, 'cell colour'),
    confidence: o.confidence === null ? null : finite(o.confidence, 'cell confidence'),
    status: o.status as FrameCell['status'],
  };
}

function parseFrameResult(json: unknown): FrameResult {
  const o = exactObject(
    json,
    ['type', 'schemaVersion', 'scanId', 'frameSeq', 'width', 'height', 'detections', 'cells', 'grid', 'quality', 'inferenceMs'],
    [],
    'frame result',
  );
  const frameSeq = nonNegInt(o.frameSeq, 'frameSeq');
  if (frameSeq < 1) bad('frameSeq must be positive');
  const detections = arr(o.detections, 'detections').map((d) => {
    const e = exactObject(d, ['classId', 'color', 'confidence', 'xyxy'], [], 'detection');
    const box = arr(e.xyxy, 'xyxy');
    if (box.length !== 4) bad('xyxy must have four numbers');
    return {
      classId: nonNegInt(e.classId, 'classId'),
      color: color(e.color, 'detection colour'),
      confidence: finite(e.confidence, 'detection confidence'),
      xyxy: box.map((n) => finite(n, 'xyxy')) as [number, number, number, number],
    };
  });
  const cellsRaw = arr(o.cells, 'cells');
  if (cellsRaw.length !== 9) bad('cells must have exactly 9 entries');
  let grid: ColorName[] | null = null;
  if (o.grid !== null) {
    const g = arr(o.grid, 'grid');
    if (g.length !== 9) bad('grid must be null or have exactly 9 colours');
    grid = g.map((c) => color(c, 'grid colour'));
  }
  const q = exactObject(o.quality, ['valid'], ['reason'], 'quality');
  if (typeof q.valid !== 'boolean') bad('quality.valid must be a boolean');
  if (q.valid === Object.hasOwn(q, 'reason')) bad('quality.reason must be present exactly when valid is false');
  const quality: FrameResult['quality'] = q.valid ? { valid: true } : { valid: false, reason: str(q.reason, 'quality.reason') };
  return {
    type: 'frame_result',
    schemaVersion: 1,
    scanId: str(o.scanId, 'scanId'),
    frameSeq,
    width: nonNegInt(o.width, 'width'),
    height: nonNegInt(o.height, 'height'),
    detections,
    cells: cellsRaw.map(parseCell),
    grid,
    quality,
    inferenceMs: finite(o.inferenceMs, 'inferenceMs'),
  };
}

export function parseScanServerMessage(json: unknown): ParseResult<ScanServerMessage> {
  return guarded('scan message', () => {
    if (typeof json !== 'object' || json === null || Array.isArray(json)) return bad('scan message must be an object');
    const o = json as Obj;
    if (o.schemaVersion !== 1) bad('unsupported schemaVersion');
    switch (o.type) {
      case 'ready':
        return parseScanReady(json);
      case 'frame_result':
        return parseFrameResult(json);
      case 'error':
        return parseScanError(json);
      default:
        return bad('unknown message type');
    }
  });
}

export function parseApiErrorEnvelope(json: unknown): ParseResult<ApiErrorEnvelope> {
  return guarded('error envelope', () => {
    const outer = exactObject(json, ['error'], [], 'error envelope');
    const e = exactObject(outer.error, ['code', 'message', 'retryable'], [], 'error');
    if (typeof e.code !== 'string' || !(API_CODES as readonly string[]).includes(e.code)) bad('unknown error code');
    if (typeof e.message !== 'string') bad('message must be a string');
    if (typeof e.retryable !== 'boolean') bad('retryable must be a boolean');
    return { error: { code: e.code as ApiErrorCode, message: e.message as string, retryable: e.retryable as boolean } };
  });
}
