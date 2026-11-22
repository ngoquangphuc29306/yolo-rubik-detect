// The new engine reproduces the frozen legacy characterization goldens (the legacy engine itself is deleted).
// The goldens document legacy behaviour; they are NOT ground truth (the independent reference is).
import { describe, expect, it } from 'vitest';
import golden from '../golden/legacy-characterization.json';
import { SOLVED, facesFromState } from '@/engine/cube-state';
import { applyMove } from '@/engine/move-engine';
import { parseMove } from '@/engine/move-presentation';
import { DEMO_CENTER_COLORS } from '@/demo/demo-fixtures';
import { colorNameToCode } from '@/lib/colors';
import { SCAN_FACE_ORDER, type FaceletState, type MoveToken } from '@/types/cube';

const FACES = golden._meta.faceOrder as (typeof SCAN_FACE_ORDER)[number][];
const run = (moves: readonly string[]): FaceletState =>
  moves.reduce<FaceletState>((s, m) => applyMove(s, m as MoveToken), SOLVED);
/** Legacy letter grids (W Y G B R O) of a state, read with the demo centre colours. */
const codes = (s: FaceletState) => {
  const f = facesFromState(s, DEMO_CENTER_COLORS);
  return Object.fromEntries(FACES.map((k) => [k, f[k].map(colorNameToCode)]));
};

describe('legacy goldens vs the new engine', () => {
  it('records the generating commit and non-ground-truth status', () => {
    expect(golden._meta.generatedFromCommit).toBe('e0105ca');
    expect(golden._meta.status).toMatch(/NOT ground truth/);
  });

  it('solved cube faces', () => {
    expect(codes(SOLVED)).toEqual(golden.solvedFaces);
  });

  it('18 single moves on the solved cube', () => {
    const moves = Object.keys(golden.singleMoves);
    expect(moves).toHaveLength(18);
    for (const m of moves) {
      expect(codes(run([m])), m).toEqual((golden.singleMoves as Record<string, unknown>)[m]);
    }
  });

  it('parseMove descriptors for 18 tokens', () => {
    const moves = Object.keys(golden.parsedMoves);
    expect(moves).toHaveLength(18);
    for (const m of moves) {
      const d = parseMove(m as MoveToken);
      expect(
        { face: d.face, axis: d.axis, layer: d.layer, angleRad: d.angle, turns: d.turns, clockwise: d.clockwise },
        m,
      ).toEqual((golden.parsedMoves as Record<string, unknown>)[m]);
    }
  });

  it('3 presets: scrambled faces, and the frozen solution returns to the frozen solved faces', () => {
    expect(golden.presets).toHaveLength(3);
    for (const g of golden.presets) {
      const scrambled = run(g.scramble);
      expect(codes(scrambled), `preset ${g.index} scrambled`).toEqual(g.scrambledFaces);
      const solved = g.solution.reduce<FaceletState>((s, m) => applyMove(s, m as MoveToken), scrambled);
      expect(codes(solved), `preset ${g.index} after solution`).toEqual(g.afterSolutionFaces);
      expect(g.afterSolutionFaces).toEqual(golden.solvedFaces);
    }
  });

  it('face grids of all six faces on the fixed scramble', () => {
    const c = codes(run(golden.fixedScrambleFaceGrids.scramble));
    for (const f of FACES) expect(c[f], f).toEqual(golden.fixedScrambleFaceGrids.faces[f]);
  });
});
