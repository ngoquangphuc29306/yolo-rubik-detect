// Pure table of the seven whole-cube rotation steps between the guided captures. No DOM.
// Arrow directions are for the MIRRORED on-screen preview, starting with green toward the camera
// and white on top. Centre colours follow the fixed start convention; they guide the user and
// are not proof of whole-cube orientation or face roll.
import type { ColorName, FaceId } from '@/types/cube';

export type ArrowDirection = 'left' | 'right' | 'up' | 'down';

export interface RotationStep {
  /** 1-based position in the chain. */
  step: number;
  /** Centre colour toward the camera before the move. */
  from: ColorName;
  /** Whole-cube rotation as it must look on the mirrored screen. */
  arrow: ArrowDirection;
  /** Centre colour toward the camera after the move. */
  to: ColorName;
  /** The face captured after the move; null for a return step (nothing is scanned). */
  captures: FaceId | null;
}

export const ROTATION_STEPS: readonly RotationStep[] = [
  { step: 1, from: 'green', arrow: 'right', to: 'red', captures: 'R' },
  { step: 2, from: 'red', arrow: 'right', to: 'blue', captures: 'B' },
  { step: 3, from: 'blue', arrow: 'right', to: 'orange', captures: 'L' },
  { step: 4, from: 'orange', arrow: 'right', to: 'green', captures: null },
  { step: 5, from: 'green', arrow: 'down', to: 'white', captures: 'U' },
  { step: 6, from: 'white', arrow: 'up', to: 'green', captures: null },
  { step: 7, from: 'green', arrow: 'up', to: 'yellow', captures: 'D' },
];

export function rotationStep(step: number | null): RotationStep | null {
  if (step === null || !Number.isInteger(step)) return null;
  return ROTATION_STEPS[step - 1] ?? null;
}

export function isReturnStep(step: number | null): boolean {
  const s = rotationStep(step);
  return s !== null && s.captures === null;
}

/** The step that follows the capture of `face`; null after the last face. */
export function nextStepAfterCapture(face: FaceId): number | null {
  switch (face) {
    case 'F': return 1;
    case 'R': return 2;
    case 'B': return 3;
    case 'L': return 4;
    case 'U': return 6;
    case 'D': return null;
  }
}

/** The step that follows a completed return step; null when `step` is not a return step. */
export function nextStepAfterReturn(step: number): number | null {
  return isReturnStep(step) ? step + 1 : null;
}

/** The face the next scan will capture once `step` is done (the first capturing step at or after it). */
export function faceAfterStep(step: number): FaceId | null {
  return ROTATION_STEPS.slice(step - 1).find((s) => s.captures !== null)?.captures ?? null;
}

const FACE_PHRASE: Readonly<Record<FaceId, string>> = {
  F: 'Front face',
  R: 'Right face',
  B: 'Back face',
  L: 'Left face',
  U: 'Top face',
  D: 'Bottom face',
};

/** One short caption line plus the target stage name. */
export function stepCaption(s: RotationStep): { line: string; target: string } {
  return {
    line: `Next: ${s.to} centre`,
    target: s.captures ? FACE_PHRASE[s.captures] : 'Return to the Front face (not scanned)',
  };
}
