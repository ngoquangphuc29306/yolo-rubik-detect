import { describe, expect, it } from 'vitest';
import golden from '../golden/legacy-characterization.json';
import {
  CubeStateError,
  SOLVED,
  buildFaceletState,
  facesFromState,
  parseFaceletState,
} from '@/engine/cube-state';
import { codeToColorName, type StickerCode } from '@/lib/colors';
import { SOLVER_FACE_ORDER, type CenterColors, type FaceId, type SixFaces } from '@/types/cube';

const CENTERS: CenterColors = {
  F: 'green',
  U: 'white',
  R: 'red',
  B: 'blue',
  L: 'orange',
  D: 'yellow',
};

function legacyFaces(raw: Record<string, string[]>): SixFaces {
  const out: Record<string, string[]> = {};
  for (const f of SOLVER_FACE_ORDER) out[f] = raw[f].map((c) => codeToColorName(c as StickerCode));
  return out as unknown as SixFaces;
}

const solvedFaces = legacyFaces(golden.solvedFaces);
const scrambledFaces = legacyFaces(golden.presets['0'].scrambledFaces);

type Loose = Partial<Record<FaceId, string[]>>;
const mutable = (f: SixFaces) => structuredClone(f) as unknown as Loose;
const asSix = (f: Loose) => f as unknown as SixFaces;

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof CubeStateError ? e.code : `other:${String(e)}`;
  }
  return undefined;
}

function withChars(base: string, edits: Record<number, string>): string {
  const s = base.split('');
  for (const [i, c] of Object.entries(edits)) s[Number(i)] = c;
  return s.join('');
}

describe('SOLVED', () => {
  it('is the canonical URFDLB string', () => {
    expect(SOLVED).toBe('UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
  });
});

describe('parseFaceletState', () => {
  it('accepts SOLVED', () => {
    expect(parseFaceletState(SOLVED, CENTERS)).toBe(SOLVED);
  });
  it('rejects length 53 and 55', () => {
    expect(codeOf(() => parseFaceletState(SOLVED.slice(1), CENTERS))).toBe('INVALID_LENGTH');
    expect(codeOf(() => parseFaceletState(SOLVED + 'U', CENTERS))).toBe('INVALID_LENGTH');
  });
  it('rejects symbols outside URFDLB', () => {
    expect(codeOf(() => parseFaceletState(withChars(SOLVED, { 0: 'X' }), CENTERS))).toBe('INVALID_SYMBOL');
    expect(codeOf(() => parseFaceletState(withChars(SOLVED, { 0: 'u' }), CENTERS))).toBe('INVALID_SYMBOL');
  });
  it('rejects 10 U and 8 R', () => {
    expect(codeOf(() => parseFaceletState(withChars(SOLVED, { 9: 'U' }), CENTERS))).toBe('COUNT_MISMATCH');
  });
  it('rejects centres not in place', () => {
    // swap U centre (4) with an R facelet (9): counts stay 9 each
    expect(codeOf(() => parseFaceletState(withChars(SOLVED, { 4: 'R', 9: 'U' }), CENTERS))).toBe(
      'CENTER_MISMATCH',
    );
  });
  it('rejects a centres argument with duplicate colours', () => {
    expect(codeOf(() => parseFaceletState(SOLVED, { ...CENTERS, D: 'white' }))).toBe('DUPLICATE_CENTER');
  });
});

describe('buildFaceletState', () => {
  it('builds SOLVED from solved legacy faces with F=green U=white R=red B=blue L=orange D=yellow', () => {
    const { state, centers } = buildFaceletState(solvedFaces);
    expect(state).toBe(SOLVED);
    expect(centers).toEqual(CENTERS);
  });

  it('rejects a duplicate centre', () => {
    const faces = mutable(solvedFaces);
    faces.D![4] = 'white';
    expect(codeOf(() => buildFaceletState(asSix(faces)))).toBe('DUPLICATE_CENTER');
  });

  it('rejects 10 white / 8 yellow', () => {
    const faces = mutable(solvedFaces);
    faces.D![0] = 'white';
    expect(codeOf(() => buildFaceletState(asSix(faces)))).toBe('COLOR_COUNT_MISMATCH');
  });

  it('rejects a missing face (never filled)', () => {
    const faces = mutable(solvedFaces);
    delete faces.B;
    expect(codeOf(() => buildFaceletState(asSix(faces)))).toBe('MISSING_FACE');
  });

  it('rejects a face with 8 entries', () => {
    const faces = mutable(solvedFaces);
    faces.R = faces.R!.slice(0, 8);
    expect(codeOf(() => buildFaceletState(asSix(faces)))).toBe('INVALID_FACE_SHAPE');
  });

  it('rejects an unknown colour string', () => {
    const faces = mutable(solvedFaces);
    faces.U![0] = 'purple';
    expect(codeOf(() => buildFaceletState(asSix(faces)))).toBe('UNKNOWN_COLOR');
  });
});

describe('facesFromState round-trip', () => {
  it('solved faces', () => {
    const { state, centers } = buildFaceletState(solvedFaces);
    expect(facesFromState(state, centers)).toEqual(solvedFaces);
  });

  it('asymmetric scrambled faces from the legacy golden', () => {
    const { state, centers } = buildFaceletState(scrambledFaces);
    expect(state).not.toBe(SOLVED);
    expect(centers).toEqual(CENTERS);
    expect(facesFromState(state, centers)).toEqual(scrambledFaces);
  });

  it('stores the colour-home letter of each sticker', () => {
    const { state } = buildFaceletState(scrambledFaces);
    // legacy U face row 0 = Y R W -> yellow home D, red home R, white home U
    expect(state.slice(0, 3)).toBe('DRU');
  });
});
