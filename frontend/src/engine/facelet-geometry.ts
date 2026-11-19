// Single source of the ARCHITECTURE §6.4 facelet geometry. Integer tuples only.
// Facelet (r,c) of a face: cubie position p = n + (c-1)*a + (r-1)*b, sticker normal = n.
import { SOLVER_FACE_ORDER, type FaceId } from '@/types/cube';

export type Vec3 = readonly [number, number, number];

/** Starting index of each face in the 54-char state. */
export const FACE_OFFSET: Readonly<Record<FaceId, number>> = {
  U: 0,
  R: 9,
  F: 18,
  D: 27,
  L: 36,
  B: 45,
};

/** n = outward normal, a = image-right, b = image-down (outside view). */
export const FACE_AXES: Readonly<Record<FaceId, { n: Vec3; a: Vec3; b: Vec3 }>> = {
  U: { n: [0, 1, 0], a: [1, 0, 0], b: [0, 0, 1] },
  R: { n: [1, 0, 0], a: [0, 0, -1], b: [0, -1, 0] },
  F: { n: [0, 0, 1], a: [1, 0, 0], b: [0, -1, 0] },
  D: { n: [0, -1, 0], a: [1, 0, 0], b: [0, 0, -1] },
  L: { n: [-1, 0, 0], a: [0, 0, 1], b: [0, -1, 0] },
  B: { n: [0, 0, -1], a: [-1, 0, 0], b: [0, -1, 0] },
};

export interface Facelet {
  readonly index: number;
  readonly face: FaceId;
  readonly row: number;
  readonly col: number;
  readonly position: Vec3;
  readonly normal: Vec3;
}

function buildFacelets(): readonly Facelet[] {
  const out: Facelet[] = new Array<Facelet>(54);
  for (const face of SOLVER_FACE_ORDER) {
    const { n, a, b } = FACE_AXES[face];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const position: Vec3 = [
          n[0] + (col - 1) * a[0] + (row - 1) * b[0],
          n[1] + (col - 1) * a[1] + (row - 1) * b[1],
          n[2] + (col - 1) * a[2] + (row - 1) * b[2],
        ];
        const index = FACE_OFFSET[face] + 3 * row + col;
        out[index] = Object.freeze({ index, face, row, col, position, normal: n });
      }
    }
  }
  return Object.freeze(out);
}

export const FACELETS: readonly Facelet[] = buildFacelets();

const EQ = (u: Vec3, v: Vec3) => u[0] === v[0] && u[1] === v[1] && u[2] === v[2];

/** Index of the facelet at cubie `position` with sticker `normal`. Throws if none. */
export function faceletIndexAt(position: Vec3, normal: Vec3): number {
  const hit = FACELETS.find((f) => EQ(f.position, position) && EQ(f.normal, normal));
  if (!hit) throw new Error(`No facelet at position [${position}] with normal [${normal}]`);
  return hit.index;
}
