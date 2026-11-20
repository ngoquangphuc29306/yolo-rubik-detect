// Canonical facelet move engine. Pure: integer geometry only, no React/DOM/Three/timers.
// Each basic clockwise face turn is a 54-index permutation derived at module load from FACELETS plus an
// integer rotation (ARCHITECTURE §7.2). `next[dest] = state[src]`.
import type { FaceId, FaceletState, MoveToken } from '@/types/cube';
import { SOLVED, CubeStateError, validateFaceletString } from './cube-state';
import { FACELETS, faceletIndexAt, type Vec3 } from './facelet-geometry';

/** Thrown by parseMoveToken for anything outside the 18 legal tokens (a CubeStateError, code INVALID_SYMBOL). */
const TOKEN_RE = /^[URFDLB]['2]?$/;

export function parseMoveToken(token: string): MoveToken {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) {
    throw new CubeStateError('INVALID_SYMBOL', `Illegal move token ${JSON.stringify(token)}`);
  }
  return token as MoveToken;
}

// +90 degrees about the positive axis (right-hand rule); integer maths only.
const ROT_POS: Record<'x' | 'y' | 'z', (v: Vec3) => Vec3> = {
  x: ([x, y, z]) => [x, -z, y],
  y: ([x, y, z]) => [z, y, -x],
  z: ([x, y, z]) => [-y, x, z],
};
// -90 degrees about the positive axis (inverse of the above).
const ROT_NEG: Record<'x' | 'y' | 'z', (v: Vec3) => Vec3> = {
  x: ([x, y, z]) => [x, z, -y],
  y: ([x, y, z]) => [-z, y, x],
  z: ([x, y, z]) => [y, -x, z],
};

// Clockwise viewed from outside the face: -90 about the positive axis for R,U,F; +90 for L,D,B.
const FACE_TURN: Record<FaceId, { axis: 'x' | 'y' | 'z'; layer: -1 | 1; positive: boolean }> = {
  R: { axis: 'x', layer: 1, positive: false },
  L: { axis: 'x', layer: -1, positive: true },
  U: { axis: 'y', layer: 1, positive: false },
  D: { axis: 'y', layer: -1, positive: true },
  F: { axis: 'z', layer: 1, positive: false },
  B: { axis: 'z', layer: -1, positive: true },
};
const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

/** perm[dest] = src for one clockwise quarter turn of `face`. */
function quarterPermutation(face: FaceId): readonly number[] {
  const { axis, layer, positive } = FACE_TURN[face];
  const rot = positive ? ROT_POS[axis] : ROT_NEG[axis];
  const perm = Array.from({ length: 54 }, (_, i) => i);
  for (const f of FACELETS) {
    if (f.position[AXIS_INDEX[axis]] !== layer) continue;
    perm[faceletIndexAt(rot(f.position), rot(f.normal))] = f.index;
  }
  return perm;
}

function buildTokenPermutations(): Readonly<Record<MoveToken, readonly number[]>> {
  const out = {} as Record<MoveToken, readonly number[]>;
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as FaceId[]) {
    const q = quarterPermutation(face);
    // state1[i] = state[q[i]], so state2[d] = state1[q[d]] = state[q[q[d]]]; likewise for three turns.
    const q2 = q.map((s) => q[s]);
    const q3 = q.map((s) => q2[s]);
    out[face] = q;
    out[`${face}2`] = q2;
    // The inverse of a clockwise quarter is three clockwise quarters.
    out[`${face}'`] = q3;
  }
  return out;
}

const PERMUTATIONS = buildTokenPermutations();

export function applyMove(state: FaceletState, move: MoveToken): FaceletState {
  // Own-property lookup: runtime tokens like "toString" or "__proto__" must not reach the prototype chain.
  const perm = Object.hasOwn(PERMUTATIONS, move) ? PERMUTATIONS[move] : undefined;
  if (!perm) throw new CubeStateError('INVALID_SYMBOL', `Illegal move token ${JSON.stringify(move)}`);
  let next = '';
  for (let d = 0; d < 54; d++) next += state[perm[d]];
  return next as FaceletState;
}

export function buildSnapshots(initial: FaceletState, moves: readonly MoveToken[]): readonly FaceletState[] {
  const snaps: FaceletState[] = [initial];
  for (const m of moves) snaps.push(applyMove(snaps[snaps.length - 1], m));
  return snaps;
}

export function verifySolution(
  initial: FaceletState,
  moves: readonly MoveToken[],
): { ok: true; snapshots: readonly FaceletState[] } | { ok: false; reason: string } {
  const stateProblem = validateFaceletString(initial);
  if (stateProblem) return { ok: false, reason: `Invalid initial state: ${stateProblem}` };
  for (const m of moves) {
    if (typeof m !== 'string' || !Object.hasOwn(PERMUTATIONS, m)) {
      return { ok: false, reason: `Illegal move token ${JSON.stringify(m)}` };
    }
  }
  const snapshots = buildSnapshots(initial, moves);
  if (snapshots[snapshots.length - 1] !== SOLVED) {
    return { ok: false, reason: 'Replaying the moves does not end in the solved state' };
  }
  return { ok: true, snapshots };
}
