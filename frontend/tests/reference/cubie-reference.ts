// Independent cubie-level mover for tests. Mover only, no solver. Imports nothing from src/.
// Semantics follow ldez/cubejs cube.coffee (see PROVENANCE.md): multiply L256-275, move L442-448.
import {
  BASIC_MOVES,
  CENTER_COLOR,
  CORNER_COLOR,
  CORNER_FACELET,
  EDGE_COLOR,
  EDGE_FACELET,
} from './vendor/cubejs-tables';

export interface CubieState {
  readonly cp: readonly number[];
  readonly co: readonly number[];
  readonly ep: readonly number[];
  readonly eo: readonly number[];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const SOLVED: CubieState = {
  cp: range(8),
  co: range(8).map(() => 0),
  ep: range(12),
  eo: range(12).map(() => 0),
};

// cube.coffee cornerMultiply L256-264 and edgeMultiply L267-275.
export function multiply(a: CubieState, b: CubieState): CubieState {
  return {
    cp: range(8).map((to) => a.cp[b.cp[to]]),
    co: range(8).map((to) => (a.co[b.cp[to]] + b.co[to]) % 3),
    ep: range(12).map((to) => a.ep[b.ep[to]]),
    eo: range(12).map((to) => (a.eo[b.ep[to]] + b.eo[to]) % 2),
  };
}

const FACE_LETTERS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
type Face = (typeof FACE_LETTERS)[number];

export const MOVE_TOKENS: readonly string[] = FACE_LETTERS.flatMap((f) => [f, `${f}2`, `${f}'`]);

// X = basic once, X2 = twice, X' = three times (cube.coffee L446: power+1 multiplies).
export function applyMove(state: CubieState, token: string): CubieState {
  const m = /^([URFDLB])(2|')?$/.exec(token);
  if (!m) throw new Error(`Invalid move token: ${token}`);
  const basic = BASIC_MOVES[m[1] as Face];
  const times = m[2] === '2' ? 2 : m[2] === "'" ? 3 : 1;
  let s = state;
  for (let i = 0; i < times; i++) s = multiply(s, basic);
  return s;
}

export function applySequence(state: CubieState, seq: string): CubieState {
  return seq
    .split(/\s+/)
    .filter(Boolean)
    .reduce((s, t) => applyMove(s, t), state);
}

// cube.coffee asString L83-101 (centres never move under the six face moves).
export function toFacelets(state: CubieState): string {
  const out: string[] = new Array(54).fill('');
  CENTER_COLOR.forEach((c, i) => {
    out[9 * i + 4] = c;
  });
  for (let i = 0; i < 8; i++) {
    for (let n = 0; n < 3; n++) {
      out[CORNER_FACELET[i][(n + state.co[i]) % 3]] = CORNER_COLOR[state.cp[i]][n];
    }
  }
  for (let i = 0; i < 12; i++) {
    for (let n = 0; n < 2; n++) {
      out[EDGE_FACELET[i][(n + state.eo[i]) % 2]] = EDGE_COLOR[state.ep[i]][n];
    }
  }
  return out.join('');
}
