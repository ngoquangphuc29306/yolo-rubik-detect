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
