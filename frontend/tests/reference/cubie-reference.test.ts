// Self-test of the independent cubie reference, on the reference ALONE (no src/ imports).
import { describe, expect, it } from 'vitest';
import { applyMove, applySequence, MOVE_TOKENS, SOLVED, toFacelets, type CubieState } from './cubie-reference';

const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

function isSolved(s: CubieState): boolean {
  return JSON.stringify(s) === JSON.stringify(SOLVED);
}
function orderOf(seq: string): number {
  let s = SOLVED;
  for (let n = 1; n <= 2000; n++) {
    s = applySequence(s, seq);
    if (isSolved(s)) return n;
  }
  return -1;
}
function seededTokens(seed: number, n: number): string[] {
  let x = seed >>> 0;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out.push(MOVE_TOKENS[(x >>> 8) % MOVE_TOKENS.length]);
  }
  return out;
}

describe('cubie reference (self-test)', () => {
  it('has 18 distinct tokens', () => {
    expect(new Set(MOVE_TOKENS).size).toBe(18);
  });
  it('SOLVED serializes to URFDLB solved string', () => {
    expect(toFacelets(SOLVED)).toBe(SOLVED_FACELETS);
  });
  it.each(FACES)('%s^4 = identity, %s2^2 = identity, %s %s\' = identity', (f) => {
    let s = SOLVED;
    for (let i = 0; i < 4; i++) s = applyMove(s, f);
    expect(isSolved(s)).toBe(true);
    expect(isSolved(applyMove(applyMove(SOLVED, `${f}2`), `${f}2`))).toBe(true);
    expect(isSolved(applyMove(applyMove(SOLVED, f), `${f}'`))).toBe(true);
    expect(isSolved(applyMove(applyMove(SOLVED, `${f}'`), f))).toBe(true);
    expect(isSolved(applyMove(SOLVED, f))).toBe(false);
  });
  it('order of R U R\' U\' is 6, order of R U is 105', () => {
    expect(orderOf("R U R' U'")).toBe(6);
    expect(orderOf('R U')).toBe(105);
  });
  it('centres never move under any move', () => {
    for (const t of MOVE_TOKENS) {
      const f = toFacelets(applyMove(SOLVED, t));
      for (let i = 0; i < 6; i++) expect(f[9 * i + 4]).toBe(FACES[i]);
    }
  });
  it('seeded 25-move sequence keeps 9 of each letter', () => {
    const f = toFacelets(applySequence(SOLVED, seededTokens(12345, 25).join(' ')));
    for (const l of FACES) expect(f.split(l).length - 1).toBe(9);
    expect(f).not.toBe(SOLVED_FACELETS);
  });
  it('U on solved matches the hand-derived physical result', () => {
    expect(toFacelets(applyMove(SOLVED, 'U'))).toBe(
      'UUUUUUUUU' + 'BBBRRRRRR' + 'RRRFFFFFF' + 'DDDDDDDDD' + 'FFFLLLLLL' + 'LLLBBBBBB',
    );
  });
});
