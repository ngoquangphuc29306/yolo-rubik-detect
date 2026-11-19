// Characterization of the legacy cubie engine (src/lib/cubeEngine.ts).
// Differential tests: retired together with the legacy engine in T1.17.
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applyMoves,
  createSolvedCube,
  extractAllFaces,
  extractFaceGrid,
  generateScrambleSession,
  invertMove,
  parseMove,
  type FaceKey,
  type MoveNotation,
} from '@/lib/cubeEngine';

const MOVES: MoveNotation[] = [
  'U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2',
  'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2',
];
const FACES: FaceKey[] = ['F', 'R', 'B', 'L', 'U', 'D'];
const QUARTER = Math.PI / 2;

// ARCHITECTURE 7.2: quarter turn clockwise viewed from outside, about the positive axis.
const SPEC: Record<FaceKey, { axis: 'x' | 'y' | 'z'; layer: 1 | -1; cwDegrees: number }> = {
  R: { axis: 'x', layer: 1, cwDegrees: -90 },
  L: { axis: 'x', layer: -1, cwDegrees: 90 },
  U: { axis: 'y', layer: 1, cwDegrees: -90 },
  D: { axis: 'y', layer: -1, cwDegrees: 90 },
  F: { axis: 'z', layer: 1, cwDegrees: -90 },
  B: { axis: 'z', layer: -1, cwDegrees: 90 },
};

const solved = createSolvedCube();
const presets = [0, 1, 2].map((i) => generateScrambleSession(i));

describe('legacy engine invariants', () => {
  it.each(presets.map((p, i) => [i, p] as const))(
    'preset %i: scramble followed by solution returns to solved',
    (_i, p) => {
      expect(extractAllFaces(applyMoves(p.initialCube, p.solution))).toEqual(extractAllFaces(solved));
    },
  );

  const scrambles = [solved, ...presets.map((p) => p.initialCube)];
  describe.each(scrambles.map((c, i) => [i, c] as const))('scramble %i', (_i, cube) => {
    it.each(MOVES)('%s then its inverse is identity', (m) => {
      const after = applyMove(applyMove(cube, m), invertMove(m));
      expect(after).toEqual(cube);
    });
  });

  it.each(['U', 'D', 'R', 'L', 'F', 'B'] as const)('%s quarter turn x4 is identity', (f) => {
    expect(applyMoves(solved, [f, f, f, f])).toEqual(solved);
    const s = presets[0].initialCube;
    expect(applyMoves(s, [f, f, f, f])).toEqual(s);
  });
});

describe('parseMove vs ARCHITECTURE 7.2', () => {
  it.each(MOVES)('%s axis, layer, angle', (m) => {
    const face = m[0] as FaceKey;
    const spec = SPEC[face];
    const turns = m.endsWith('2') ? 2 : 1;
    const sign = (spec.cwDegrees > 0 ? 1 : -1) * (m.endsWith("'") ? -1 : 1);
    const d = parseMove(m);
    expect(d.face).toBe(face);
    expect(d.axis).toBe(spec.axis);
    expect(d.layer).toBe(spec.layer);
    expect(d.turns).toBe(turns);
    expect(d.angle).toBeCloseTo(sign * QUARTER * turns, 12);
  });

  it('plain quarter turns are -90,+90,-90,+90,-90,+90 degrees for R,L,U,D,F,B', () => {
    const deg = (['R', 'L', 'U', 'D', 'F', 'B'] as const).map((f) =>
      Math.round((parseMove(f).angle * 180) / Math.PI),
    );
    expect(deg).toEqual([-90, 90, -90, 90, -90, 90]);
  });
});

describe('extractFaceGrid', () => {
  it('returns 9 stickers per face with the solved centre colours', () => {
    const centres = { F: 'G', R: 'R', B: 'B', L: 'O', U: 'W', D: 'Y' };
    for (const f of FACES) {
      const g = extractFaceGrid(solved, f);
      expect(g).toHaveLength(9);
      expect(g.every((c) => c === centres[f])).toBe(true);
    }
  });

  it('U on solved: top rows cycle F<-R<-B<-L<-F (hand-derived)', () => {
    const faces = extractAllFaces(applyMove(solved, 'U'));
    expect(faces.F.slice(0, 3)).toEqual(['R', 'R', 'R']);
    expect(faces.R.slice(0, 3)).toEqual(['B', 'B', 'B']);
    expect(faces.B.slice(0, 3)).toEqual(['O', 'O', 'O']);
    expect(faces.L.slice(0, 3)).toEqual(['G', 'G', 'G']);
    expect(faces.F.slice(3)).toEqual(Array(6).fill('G'));
  });

  it('a fixed scramble keeps nine stickers of each colour', () => {
    const faces = extractAllFaces(presets[0].initialCube);
    const all = FACES.flatMap((f) => faces[f]);
    for (const c of ['W', 'Y', 'G', 'B', 'R', 'O']) expect(all.filter((x) => x === c)).toHaveLength(9);
  });
});
