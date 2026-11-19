import { describe, expect, it } from 'vitest';
import { FACELETS, FACE_OFFSET, faceletIndexAt } from '@/engine/facelet-geometry';
import type { FaceId } from '@/types/cube';

const at = (face: FaceId, row: number, col: number) => FACELETS[FACE_OFFSET[face] + 3 * row + col];

describe('facelet geometry (ARCHITECTURE 6.4)', () => {
  it('has 54 facelets with index === position in the array', () => {
    expect(FACELETS).toHaveLength(54);
    FACELETS.forEach((f, i) => expect(f.index).toBe(i));
  });

  it('uses offsets U0 R9 F18 D27 L36 B45', () => {
    expect(FACE_OFFSET).toEqual({ U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 });
  });

  it('every (position, normal) pair is unique and round-trips through faceletIndexAt', () => {
    const keys = new Set(FACELETS.map((f) => `${f.position}|${f.normal}`));
    expect(keys.size).toBe(54);
    for (const f of FACELETS) expect(faceletIndexAt(f.position, f.normal)).toBe(f.index);
  });

  it('faceletIndexAt throws when no facelet matches', () => {
    expect(() => faceletIndexAt([0, 0, 0], [0, 1, 0])).toThrow();
    expect(() => faceletIndexAt([1, 1, 1], [0, -1, 0])).toThrow();
  });

  it('corner cubies carry 3 stickers, edges 2, centres 1', () => {
    const counts = new Map<string, number>();
    for (const f of FACELETS) counts.set(`${f.position}`, (counts.get(`${f.position}`) ?? 0) + 1);
    expect(counts.size).toBe(26);
    for (const [key, n] of counts) {
      const nonZero = key.split(',').filter((v) => v !== '0').length;
      expect(n).toBe(nonZero);
    }
  });

  it('every position/normal component is an integer in [-1, 1]', () => {
    for (const f of FACELETS) {
      for (const v of [...f.position, ...f.normal]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('matches the table corners', () => {
    expect(at('F', 0, 0).position).toEqual([-1, 1, 1]);
    expect(at('F', 0, 0).normal).toEqual([0, 0, 1]);
    // U bottom row touches F: proves U image-down = +Z
    expect(at('U', 2, 0).position).toEqual([-1, 1, 1]);
    expect(at('U', 2, 0).normal).toEqual([0, 1, 0]);
    expect(at('B', 0, 0).position).toEqual([1, 1, -1]);
    expect(at('B', 0, 0).normal).toEqual([0, 0, -1]);
    expect(at('D', 0, 0).position).toEqual([-1, -1, 1]);
    expect(at('D', 0, 0).normal).toEqual([0, -1, 0]);
  });

  it('pins the (0,0) and (2,2) corner of every face (fixes both a and b)', () => {
    // p = n + (c-1)a + (r-1)b  =>  (0,0) = n - a - b,  (2,2) = n + a + b  (hand-computed from the table)
    const expected: Record<FaceId, { tl: number[]; br: number[] }> = {
      U: { tl: [-1, 1, -1], br: [1, 1, 1] },
      R: { tl: [1, 1, 1], br: [1, -1, -1] },
      F: { tl: [-1, 1, 1], br: [1, -1, 1] },
      D: { tl: [-1, -1, 1], br: [1, -1, -1] },
      L: { tl: [-1, 1, -1], br: [-1, -1, 1] },
      B: { tl: [1, 1, -1], br: [-1, -1, -1] },
    };
    for (const face of Object.keys(expected) as FaceId[]) {
      expect(at(face, 0, 0).position, `${face}(0,0)`).toEqual(expected[face].tl);
      expect(at(face, 2, 2).position, `${face}(2,2)`).toEqual(expected[face].br);
    }
  });

  it('adjacent side faces share their boundary columns, row-aligned', () => {
    const pairs: [FaceId, FaceId][] = [['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']];
    for (const [left, right] of pairs) {
      for (let r = 0; r < 3; r++) {
        expect(at(left, r, 2).position, `${left}|${right} row ${r}`).toEqual(at(right, r, 0).position);
      }
    }
  });

  it('U bottom row and D top row touch F, column-aligned', () => {
    for (let c = 0; c < 3; c++) {
      expect(at('U', 2, c).position).toEqual(at('F', 0, c).position);
      expect(at('D', 0, c).position).toEqual(at('F', 2, c).position);
    }
  });

  it('U and D share a 3-cubie edge with R, B and L (position-set equality)', () => {
    const NORMAL: Record<FaceId, number[]> = {
      U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], B: [0, 0, -1], F: [0, 0, 1],
    };
    const dot = (p: readonly number[], n: number[]) => p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
    const edgeOn = (face: FaceId, other: FaceId) =>
      FACELETS.filter((f) => f.face === face && dot(f.position, NORMAL[other]) === 1)
        .map((f) => f.position.join(','))
        .sort();
    for (const cap of ['U', 'D'] as FaceId[]) {
      for (const side of ['R', 'B', 'L'] as FaceId[]) {
        const a = edgeOn(cap, side);
        expect(a, `${cap}/${side}`).toHaveLength(3);
        expect(a).toEqual(edgeOn(side, cap));
      }
    }
  });

  it('centres sit at indices 4,13,22,31,40,49 on the face axis', () => {
    const expected: Record<number, [number, number, number]> = {
      4: [0, 1, 0],
      13: [1, 0, 0],
      22: [0, 0, 1],
      31: [0, -1, 0],
      40: [-1, 0, 0],
      49: [0, 0, -1],
    };
    for (const [i, p] of Object.entries(expected)) {
      expect(FACELETS[Number(i)].position).toEqual(p);
      expect(FACELETS[Number(i)].normal).toEqual(p);
    }
  });
});
