// Canonical cube types (ARCHITECTURE §6.4). Pure types: no runtime imports.

/** Face direction, NOT a colour. */
export type FaceId = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
/** Solver / state serialization order (URFDLB). */
export const SOLVER_FACE_ORDER: readonly FaceId[] = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
/** Guided capture order. */
export const SCAN_FACE_ORDER: readonly FaceId[] = ['F', 'R', 'B', 'L', 'U', 'D'] as const;

/** API colour vocabulary. */
export type ColorName = 'white' | 'yellow' | 'red' | 'orange' | 'blue' | 'green';
export type CenterColors = Readonly<Record<FaceId, ColorName>>;

/** 54 chars of URFDLB; each char is the home face of the sticker's colour. */
export type FaceletState = string & { readonly __brand: 'FaceletState54' };

/** Exactly 18 tokens. */
export type MoveToken = `${FaceId}` | `${FaceId}'` | `${FaceId}2`;

/** Row-major, outside view. */
export type FaceGrid = readonly [
  ColorName, ColorName, ColorName,
  ColorName, ColorName, ColorName,
  ColorName, ColorName, ColorName,
];
export type SixFaces = Readonly<Record<FaceId, FaceGrid>>;
