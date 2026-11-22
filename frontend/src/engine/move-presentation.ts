// Presentation descriptor for a move token (axis, layer, angle, copy). Behaviour copied verbatim from the
// legacy lib/cubeEngine.ts parseMove (frozen in tests/golden/legacy-parse-move.json). Pure: no React/DOM/Three.
import type { FaceId, MoveToken } from '@/types/cube';

export interface MoveDescriptor {
  notation: MoveToken;
  face: FaceId;
  axis: 'x' | 'y' | 'z';
  layer: -1 | 1;
  /** Signed angle in radians in Three.js right-handed coordinate system */
  angle: number;
  turns: 1 | 2;
  clockwise: boolean;
  naturalLanguage: string;
  shortAction: string;
  /** Preferred camera direction vector [x, y, z] so this face is clearly visible */
  cameraPosition: [number, number, number];
}

const FACE_CONFIG: Record<
  FaceId,
  { axis: 'x' | 'y' | 'z'; layer: -1 | 1; cwSign: 1 | -1; faceWord: string; cam: [number, number, number] }
> = {
  R: { axis: 'x', layer: 1, cwSign: -1, faceWord: 'right', cam: [4.6, 2.8, 4.4] },
  L: { axis: 'x', layer: -1, cwSign: 1, faceWord: 'left', cam: [-4.5, 2.8, 4.5] },
  U: { axis: 'y', layer: 1, cwSign: -1, faceWord: 'top', cam: [3.8, 4.5, 4.2] },
  D: { axis: 'y', layer: -1, cwSign: 1, faceWord: 'bottom', cam: [3.9, -3.6, 4.5] },
  F: { axis: 'z', layer: 1, cwSign: -1, faceWord: 'front', cam: [3.2, 2.5, 5.2] },
  B: { axis: 'z', layer: -1, cwSign: 1, faceWord: 'back', cam: [3.6, 2.8, -5.0] },
};

export function parseMove(notation: MoveToken): MoveDescriptor {
  const face = notation[0] as FaceId;
  const isPrime = notation.includes("'");
  const isDouble = notation.includes('2');
  const turns: 1 | 2 = isDouble ? 2 : 1;
  const clockwise = !isPrime;

  const cfg = FACE_CONFIG[face];
  const baseSign = clockwise ? cfg.cwSign : (-cfg.cwSign as 1 | -1);
  const angle = baseSign * (Math.PI / 2) * turns;

  let naturalLanguage = '';
  let shortAction = '';
  if (isDouble) {
    naturalLanguage = `Rotate the ${cfg.faceWord} face 180° (half turn).`;
    shortAction = '180° turn';
  } else if (clockwise) {
    naturalLanguage = `Rotate the ${cfg.faceWord} face 90° clockwise.`;
    shortAction = '90° clockwise';
  } else {
    naturalLanguage = `Rotate the ${cfg.faceWord} face 90° counter-clockwise.`;
    shortAction = '90° counter-clockwise';
  }

  return {
    notation,
    face,
    axis: cfg.axis,
    layer: cfg.layer,
    angle,
    turns,
    clockwise,
    naturalLanguage,
    shortAction,
    cameraPosition: cfg.cam,
  };
}
