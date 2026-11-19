// FaceletState parsing / building. Pure: structural validation only (physical legality is the backend's job).
import {
  SOLVER_FACE_ORDER,
  type CenterColors,
  type ColorName,
  type FaceGrid,
  type FaceId,
  type FaceletState,
  type SixFaces,
} from '@/types/cube';
import { FACE_OFFSET } from './facelet-geometry';

export type CubeStateErrorCode =
  | 'INVALID_LENGTH'
  | 'INVALID_SYMBOL'
  | 'COUNT_MISMATCH'
  | 'CENTER_MISMATCH'
  | 'INVALID_FACE_SHAPE'
  | 'MISSING_FACE'
  | 'DUPLICATE_CENTER'
  | 'COLOR_COUNT_MISMATCH'
  | 'UNKNOWN_COLOR';

export class CubeStateError extends Error {
  readonly code: CubeStateErrorCode;
  constructor(code: CubeStateErrorCode, message: string) {
    super(message);
    this.name = 'CubeStateError';
    this.code = code;
  }
}

export const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB' as FaceletState;

const CENTER_INDEX: Readonly<Record<FaceId, number>> = {
  U: 4,
  R: 13,
  F: 22,
  D: 31,
  L: 40,
  B: 49,
};

const COLORS: readonly ColorName[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green'];

function assertDistinctCenters(centers: CenterColors): void {
  const seen = new Set<ColorName>();
  for (const f of SOLVER_FACE_ORDER) {
    const c = centers[f];
    if (!COLORS.includes(c)) throw new CubeStateError('UNKNOWN_COLOR', `Unknown centre colour for ${f}`);
    if (seen.has(c)) throw new CubeStateError('DUPLICATE_CENTER', `Centre colour ${c} used twice`);
    seen.add(c);
  }
}

export function parseFaceletState(state: string, centers: CenterColors): FaceletState {
  if (state.length !== 54) {
    throw new CubeStateError('INVALID_LENGTH', `State must be 54 characters, got ${state.length}`);
  }
  const counts: Record<string, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
  for (const ch of state) {
    if (!(ch in counts)) throw new CubeStateError('INVALID_SYMBOL', `Invalid symbol '${ch}'`);
    counts[ch]++;
  }
  for (const f of SOLVER_FACE_ORDER) {
    if (counts[f] !== 9) {
      throw new CubeStateError('COUNT_MISMATCH', `Expected 9 of '${f}', got ${counts[f]}`);
    }
  }
  for (const f of SOLVER_FACE_ORDER) {
    if (state[CENTER_INDEX[f]] !== f) {
      throw new CubeStateError('CENTER_MISMATCH', `Centre of face ${f} (index ${CENTER_INDEX[f]}) is not '${f}'`);
    }
  }
  assertDistinctCenters(centers);
  return state as FaceletState;
}

export function buildFaceletState(faces: SixFaces): { state: FaceletState; centers: CenterColors } {
  const grids = {} as Record<FaceId, readonly ColorName[]>;
  for (const f of SOLVER_FACE_ORDER) {
    const g = (faces as Partial<Record<FaceId, unknown>>)[f];
    if (g === undefined || g === null) throw new CubeStateError('MISSING_FACE', `Face ${f} is missing`);
    if (!Array.isArray(g) || g.length !== 9) {
      throw new CubeStateError('INVALID_FACE_SHAPE', `Face ${f} must have exactly 9 entries`);
    }
    for (const c of g) {
      if (!COLORS.includes(c as ColorName)) throw new CubeStateError('UNKNOWN_COLOR', `Unknown colour on face ${f}`);
    }
    grids[f] = g as readonly ColorName[];
  }

  const centers = {} as Record<FaceId, ColorName>;
  const homeOf = new Map<ColorName, FaceId>();
  for (const f of SOLVER_FACE_ORDER) {
    const c = grids[f][4];
    if (homeOf.has(c)) throw new CubeStateError('DUPLICATE_CENTER', `Centre colour ${c} used twice`);
    homeOf.set(c, f);
    centers[f] = c;
  }

  const counts = new Map<ColorName, number>();
  for (const f of SOLVER_FACE_ORDER) for (const c of grids[f]) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const c of COLORS) {
    if (counts.get(c) !== 9) {
      throw new CubeStateError('COLOR_COUNT_MISMATCH', `Expected 9 of ${c}, got ${counts.get(c) ?? 0}`);
    }
  }

  const chars: string[] = new Array<string>(54);
  for (const f of SOLVER_FACE_ORDER) {
    grids[f].forEach((c, i) => {
      chars[FACE_OFFSET[f] + i] = homeOf.get(c)!;
    });
  }
  return { state: parseFaceletState(chars.join(''), centers), centers };
}

export function facesFromState(state: FaceletState, centers: CenterColors): SixFaces {
  parseFaceletState(state, centers);
  const out = {} as Record<FaceId, FaceGrid>;
  for (const f of SOLVER_FACE_ORDER) {
    const grid: ColorName[] = [];
    for (let i = 0; i < 9; i++) grid.push(centers[state[FACE_OFFSET[f] + i] as FaceId]);
    out[f] = grid as unknown as FaceGrid;
  }
  return out;
}
