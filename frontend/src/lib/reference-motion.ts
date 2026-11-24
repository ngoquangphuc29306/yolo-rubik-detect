// Pure maths for the reference-cube demonstration. No DOM, no React, no three.
// The cube repeats the whole-cube move of the current rotation step. Poses come from scanGuide's
// referenceRotation (Euler XYZ, radians): the END pose is the face the move brings to the camera
// (a return step ends on the Front pose), the START pose is that pose turned back by 90 degrees.
//   right: the previous face turns the other way about Y, so start.y = end.y + PI/2
//          (the reference canvas is displayed mirrored, so the front face leaves to the screen's right
//          and the new face enters from the left, exactly like the mirrored preview)
//   down:  top toward the camera = +X rotation, so start.x = end.x - PI/2
//   up:    bottom toward the camera = -X rotation, so start.x = end.x + PI/2
import { scanGuide } from '@/features/scanner/scan-guide';
import type { RotationStep } from '@/lib/rotation-steps';

export type Rotation3 = [number, number, number];

export const REST_MS = 800;
export const TURN_MS = 900;
export const HOLD_MS = 800;
export const LOOP_MS = REST_MS + TURN_MS + HOLD_MS;

/** Smoothstep-style ease in-out on [0,1]; clamps outside. */
export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Eased turn progress for a time since the loop began: rest at 0, turn 0..1, hold at 1, then snap back to 0. */
export function loopProgress(elapsedMs: number): number {
  const m = ((elapsedMs % LOOP_MS) + LOOP_MS) % LOOP_MS;
  if (m < REST_MS) return 0;
  if (m < REST_MS + TURN_MS) return easeInOut((m - REST_MS) / TURN_MS);
  return 1;
}

/** The face that ends toward the camera: the scanned face, or Front for a return step. */
export function stepTargetFace(step: RotationStep): 'F' | NonNullable<RotationStep['captures']> {
  return step.captures ?? 'F';
}

const poseOf = (face: Parameters<typeof scanGuide>[0]): Rotation3 => scanGuide(face, {}, true).referenceRotation;

export function stepEndPose(step: RotationStep): Rotation3 {
  return poseOf(stepTargetFace(step));
}

export function stepStartPose(step: RotationStep): Rotation3 {
  const [x, y, z] = stepEndPose(step);
  switch (step.arrow) {
    case 'right': return [x, y + Math.PI / 2, z];
    case 'left': return [x, y - Math.PI / 2, z];
    case 'down': return [x - Math.PI / 2, y, z];
    case 'up': return [x + Math.PI / 2, y, z];
  }
}

/** Rotation at eased progress p in [0,1] (0 = start pose, 1 = end pose). */
export function referenceRotationAt(step: RotationStep, p: number): Rotation3 {
  const a = stepStartPose(step);
  const b = stepEndPose(step);
  const c = Math.min(1, Math.max(0, p));
  return [a[0] + (b[0] - a[0]) * c, a[1] + (b[1] - a[1]) * c, a[2] + (b[2] - a[2]) * c];
}
