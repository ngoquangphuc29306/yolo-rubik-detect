/*
 * Factual move tables, transcribed, not executed.
 *
 * Source:   https://raw.githubusercontent.com/ldez/cubejs/6b3da493894d9aed54f4c8aafccadbe676e745b5/src/cube.coffee
 * Repo:     https://github.com/ldez/cubejs  (commit 6b3da493894d9aed54f4c8aafccadbe676e745b5)
 * File:     src/cube.coffee  (sha256 8b161bb9c878c729f91d31bb553a7360d878097e6a24a010a870243f4afc5c4a)
 * Lines copied: 2-8 (index enums), 10-33 (facelet tables), 35-45 (colour tables), 284-337 (basic moves U R F D L B)
 * Copyright (c) 2013-2017 Petri Lehtinen <petri@digip.org>
 * Copyright (c) 2018 Ludovic Fernandez
 * Licence: MIT (see ./LICENSE-cubejs). The CoffeeScript was never compiled or run;
 * values were transcribed from the downloaded file by reading it.
 */

// cube.coffee L5: corners [URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB] = [0..7]
const URF = 0, UFL = 1, ULB = 2, UBR = 3, DFR = 4, DLF = 5, DBL = 6, DRB = 7;
// cube.coffee L8: edges [UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR] = [0..11]
const UR = 0, UF = 1, UL = 2, UB = 3, DR = 4, DF = 5, DL = 6, DB = 7, FR = 8, FL = 9, BL = 10, BR = 11;

// cube.coffee L11-16: _U(x)=x-1, _R(x)=_U(9)+x, _F=_R(9)+x, _D=_F(9)+x, _L=_D(9)+x, _B=_L(9)+x
const _U = (x: number) => x - 1;
const _R = (x: number) => _U(9) + x;
const _F = (x: number) => _R(9) + x;
const _D = (x: number) => _F(9) + x;
const _L = (x: number) => _D(9) + x;
const _B = (x: number) => _L(9) + x;

// cube.coffee L19: centerFacelet
export const CENTER_FACELET: readonly number[] = [4, 13, 22, 31, 40, 49];

// cube.coffee L21-26: cornerFacelet
export const CORNER_FACELET: readonly (readonly number[])[] = [
  [_U(9), _R(1), _F(3)], [_U(7), _F(1), _L(3)],
  [_U(1), _L(1), _B(3)], [_U(3), _B(1), _R(3)],
  [_D(3), _F(9), _R(7)], [_D(1), _L(9), _F(7)],
  [_D(7), _B(9), _L(7)], [_D(9), _R(9), _B(7)],
];

// cube.coffee L28-32: edgeFacelet
export const EDGE_FACELET: readonly (readonly number[])[] = [
  [_U(6), _R(2)], [_U(8), _F(2)], [_U(4), _L(2)], [_U(2), _B(2)],
  [_D(6), _R(8)], [_D(2), _F(8)], [_D(4), _L(8)], [_D(8), _B(8)],
  [_F(6), _R(4)], [_F(4), _L(6)], [_B(6), _L(4)], [_B(4), _R(6)],
];

// cube.coffee L35: centerColor
export const CENTER_COLOR: readonly string[] = ['U', 'R', 'F', 'D', 'L', 'B'];

// cube.coffee L37-40: cornerColor
export const CORNER_COLOR: readonly (readonly string[])[] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];

// cube.coffee L42-45: edgeColor
export const EDGE_COLOR: readonly (readonly string[])[] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'],
  ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

export interface BasicMove {
  readonly cp: readonly number[];
  readonly co: readonly number[];
  readonly ep: readonly number[];
  readonly eo: readonly number[];
}

// cube.coffee L284-337: Cube.moves[0..5] in order U R F D L B (centers omitted: identity for these)
export const BASIC_MOVES: Readonly<Record<'U' | 'R' | 'F' | 'D' | 'L' | 'B', BasicMove>> = {
  // L286-292
  U: {
    cp: [UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // L295-301
  R: {
    cp: [DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // L304-310
  F: {
    cp: [UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  // L313-319
  D: {
    cp: [URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // L322-328
  L: {
    cp: [URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // L331-337
  B: {
    cp: [URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
};
