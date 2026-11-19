// Asserts the legacy engine still reproduces the frozen characterization goldens.
// The goldens document legacy behaviour; they are NOT ground truth.
import { describe, expect, it } from 'vitest';
import golden from '../golden/legacy-characterization.json';
import {
  applyMove,
  applyMoves,
  createSolvedCube,
  extractAllFaces,
  extractFaceGrid,
  generateScrambleSession,
  parseMove,
  type FaceKey,
  type MoveNotation,
} from '@/lib/cubeEngine';

const solved = createSolvedCube();
const FACES = golden._meta.faceOrder as FaceKey[];

describe('legacy goldens', () => {
  it('records the generating commit and non-ground-truth status', () => {
    expect(golden._meta.generatedFromCommit).toBe('e0105ca');
    expect(golden._meta.status).toMatch(/NOT ground truth/);
  });

  it('solved cube faces', () => {
    expect(extractAllFaces(solved)).toEqual(golden.solvedFaces);
  });

  it('18 single moves on the solved cube', () => {
    const moves = Object.keys(golden.singleMoves) as MoveNotation[];
    expect(moves).toHaveLength(18);
    for (const m of moves) {
      expect(extractAllFaces(applyMove(solved, m)), m).toEqual(
        (golden.singleMoves as Record<string, unknown>)[m],
      );
    }
  });

  it('parseMove descriptors for 18 tokens', () => {
    const moves = Object.keys(golden.parsedMoves) as MoveNotation[];
    expect(moves).toHaveLength(18);
    for (const m of moves) {
      const d = parseMove(m);
      expect(
        { face: d.face, axis: d.axis, layer: d.layer, angleRad: d.angle, turns: d.turns, clockwise: d.clockwise },
        m,
      ).toEqual((golden.parsedMoves as Record<string, unknown>)[m]);
    }
  });

  it('3 presets: scramble, solution, scrambled and solved faces', () => {
    expect(golden.presets).toHaveLength(3);
    for (const g of golden.presets) {
      const s = generateScrambleSession(g.index);
      expect(s.scramble).toEqual(g.scramble);
      expect(s.solution).toEqual(g.solution);
      expect(extractAllFaces(s.initialCube)).toEqual(g.scrambledFaces);
      expect(extractAllFaces(applyMoves(s.initialCube, s.solution))).toEqual(g.afterSolutionFaces);
      expect(g.afterSolutionFaces).toEqual(golden.solvedFaces);
    }
  });

  it('extractFaceGrid for all six faces on the fixed scramble', () => {
    const cube = applyMoves(solved, golden.fixedScrambleFaceGrids.scramble as MoveNotation[]);
    for (const f of FACES) {
      expect(extractFaceGrid(cube, f), f).toEqual(golden.fixedScrambleFaceGrids.faces[f]);
    }
  });
});
