import { describe, expect, it } from 'vitest';
import golden_ from '../golden/to-cubies.json';
import legacyScrambleMoves from '../golden/legacy-moves-on-scramble.json';
import legacyChar from '../golden/legacy-characterization.json';
import { toCubies } from '@/engine/cubie-adapter';
import { CubeStateError, SOLVED, facesFromState } from '@/engine/cube-state';
import { applyMove, parseMoveToken } from '@/engine/move-engine';
import { colorNameToCode } from '@/lib/colors';
import type { CenterColors, FaceletState, MoveToken } from '@/types/cube';

const DEMO: CenterColors = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };

const TOKENS: MoveToken[] = (['U', 'R', 'F', 'D', 'L', 'B'] as const).flatMap((f) => [
  f,
  `${f}'` as MoveToken,
  `${f}2` as MoveToken,
]);

const SCRAMBLE = "R U R' F2 D' L B2 U2 R' F U L' D2 B' R2 U F' D".split(' ');
const S = SCRAMBLE.reduce<FaceletState>((s, t) => applyMove(s, parseMoveToken(t)), SOLVED);

type Pos = { x: number; y: number; z: number; stickers: object };
const byPosition = (cubies: readonly Pos[]) =>
  [...cubies]
    .sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z)
    .map((c) => ({ x: c.x, y: c.y, z: c.z, stickers: c.stickers }));

describe('toCubies', () => {
  it('SOLVED + demo centres equals the frozen legacy createSolvedCube per position', () => {
    expect(byPosition(toCubies(SOLVED, DEMO))).toEqual(byPosition(golden_.solved as unknown as Pos[]));
  });

  it('scrambled state is not the solved layout (guards vacuous comparisons)', () => {
    expect(byPosition(toCubies(S, DEMO))).not.toEqual(byPosition(toCubies(SOLVED, DEMO)));
  });

  it.each(TOKENS)('frozen legacy applyMove(toCubies(S), %s) equals toCubies(applyMove(S, %s))', (t) => {
    const frozen = (legacyScrambleMoves.moves as Record<string, unknown>)[t];
    expect(frozen).toBeDefined();
    expect(byPosition(toCubies(applyMove(S, t), DEMO))).toEqual(frozen);
  });

  it('frozen legacy face grids of the scramble equal facesFromState (the cubie/facelet round trip)', () => {
    const faces = facesFromState(S, DEMO);
    const frozen = legacyChar.fixedScrambleFaceGrids.faces as Record<string, string[]>;
    expect(legacyChar.fixedScrambleFaceGrids.scramble.join(' ')).toBe(SCRAMBLE.join(' '));
    for (const f of ['U', 'R', 'F', 'D', 'L', 'B'] as const) {
      expect(frozen[f]).toEqual(faces[f].map(colorNameToCode));
    }
  });

  it('maps a custom centre mapping', () => {
    const custom: CenterColors = { U: 'blue', R: 'white', F: 'red', D: 'green', L: 'yellow', B: 'orange' };
    const cubies = toCubies(SOLVED, custom);
    const at = (x: number, y: number, z: number) => cubies.find((c) => c.x === x && c.y === y && c.z === z)!;
    expect(at(0, 1, 0).stickers).toEqual({ U: 'B' });
    expect(at(1, 0, 0).stickers).toEqual({ R: 'W' });
    expect(at(0, 0, 1).stickers).toEqual({ F: 'R' });
    expect(at(0, -1, 0).stickers).toEqual({ D: 'G' });
    expect(at(-1, 0, 0).stickers).toEqual({ L: 'Y' });
    expect(at(0, 0, -1).stickers).toEqual({ B: 'O' });
  });

  it('throws on missing centre, duplicate centres and malformed state (no fallback)', () => {
    const { B: _b, ...missing } = DEMO;
    expect(() => toCubies(SOLVED, missing as unknown as CenterColors)).toThrow(CubeStateError);
    expect(() => toCubies(SOLVED, { ...DEMO, B: 'green' })).toThrow(CubeStateError);
    expect(() => toCubies('U'.repeat(54) as FaceletState, DEMO)).toThrow(CubeStateError);
    expect(() => toCubies(SOLVED.slice(1) as FaceletState, DEMO)).toThrow(CubeStateError);
  });

  it('returns 27 cubies (core included) with unique, deterministic position-based ids', () => {
    const a = toCubies(S, DEMO);
    const b = toCubies(SOLVED, DEMO);
    expect(a).toHaveLength(27);
    expect(new Set(a.map((c) => c.id)).size).toBe(27);
    const core = a.find((c) => c.x === 0 && c.y === 0 && c.z === 0)!;
    expect(core).toEqual({ id: 13, x: 0, y: 0, z: 0, stickers: {} });
    const ids = (cs: typeof a) => Object.fromEntries(cs.map((c) => [`${c.x},${c.y},${c.z}`, c.id]));
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a)['-1,-1,-1']).toBe(0);
    expect(ids(a)['-1,-1,0']).toBe(1);
  });
});

describe('toCubies invariants (legacy-independent)', () => {
  const AXIS_OF: Record<string, (c: { x: number; y: number; z: number }) => number> = {
    R: (c) => c.x, L: (c) => -c.x, U: (c) => c.y, D: (c) => -c.y, F: (c) => c.z, B: (c) => -c.z,
  };

  it.each([['SOLVED', SOLVED], ['scramble', S]] as const)('%s: sticker counts and face/position agreement', (_n, st) => {
    const cubies = toCubies(st, DEMO);
    const counts = cubies.map((c) => Object.keys(c.stickers).length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(54);
    expect(counts).toHaveLength(27);
    expect(counts.filter((n) => n === 0)).toHaveLength(1);
    expect(counts.filter((n) => n === 1)).toHaveLength(6);
    expect(counts.filter((n) => n === 2)).toHaveLength(12);
    expect(counts.filter((n) => n === 3)).toHaveLength(8);
    for (const c of cubies) {
      for (const key of Object.keys(c.stickers)) expect(AXIS_OF[key](c)).toBe(1);
    }
  });
});

describe('toCubies frozen golden', () => {
  const golden = golden_ as unknown as {
    _meta: { note: string };
    solved: unknown;
    scramble: unknown;
    moves: Record<string, unknown>;
  };
  it('has provenance meta', () => {
    expect(golden._meta.note).toMatch(/core cubie added per R20; still verified against legacy differential/);
  });
  it('SOLVED and scramble match', () => {
    expect(toCubies(SOLVED, DEMO)).toEqual(golden.solved);
    expect(toCubies(S, DEMO)).toEqual(golden.scramble);
  });
  it.each(TOKENS)('single move %s on solved matches', (t) => {
    expect(toCubies(applyMove(SOLVED, t), DEMO)).toEqual(golden.moves[t]);
  });
});
