// Scan-stage presentation text. A colour word is used ONLY for a centre in `knownCenters`;
// otherwise the face direction is named. Wording otherwise matches legacy FACE_META.
import type { ColorName, FaceId } from '@/types/cube';

export type ScanArrow = 'none' | 'left' | 'right' | 'down' | 'up';

export interface ScanGuide {
  heading: string;
  instruction: string;
  rotationHint: string;
  arrowDirection: ScanArrow;
  referenceRotation: [number, number, number];
}

export function scanGuide(stage: FaceId, knownCenters: Partial<Record<FaceId, ColorName>>): ScanGuide {
  /** "green center" when the colour is known, else the supplied face-direction phrase. */
  const center = (face: FaceId, unknown: string) =>
    knownCenters[face] ? `${knownCenters[face]} center` : unknown;

  switch (stage) {
    case 'F':
      return {
        heading: 'Hold the Front face toward your camera',
        instruction: `Start with the ${center('F', 'front face')} facing you and the ${center('U', "top face's center")} on top. Keep all 9 stickers inside the frame.`,
        rotationHint: 'Hold cube steady facing forward',
        arrowDirection: 'none',
        referenceRotation: [0.18, -0.22, 0],
      };
    case 'R':
      return {
        heading: 'Rotate the whole cube left to show the Right face',
        instruction: `Turn the entire cube 90° to the left (do not twist a layer) until the ${center('R', 'face that was on the right')} faces the camera.`,
        rotationHint: 'Rotate whole cube 90° left',
        arrowDirection: 'left',
        referenceRotation: [0.18, -Math.PI / 2 - 0.22, 0],
      };
    case 'B':
      return {
        heading: 'Rotate left again to show the Back face',
        instruction: `Turn the entire cube another 90° left so the ${center('B', 'face that was on the back')} faces the camera, ${knownCenters.U ? `keeping ${knownCenters.U} on top` : 'keeping the top side up'}.`,
        rotationHint: 'Rotate whole cube 90° left',
        arrowDirection: 'left',
        referenceRotation: [0.18, -Math.PI - 0.22, 0],
      };
    case 'L':
      return {
        heading: 'Rotate left once more for the Left face',
        instruction: `Turn the entire cube 90° left so the ${center('L', 'face that was on the left')} faces the camera. Hold steady for auto-capture.`,
        rotationHint: 'Rotate whole cube 90° left',
        arrowDirection: 'left',
        referenceRotation: [0.18, Math.PI / 2 - 0.22, 0],
      };
    case 'U':
      return {
        heading: 'Return to Front, then tilt downward for the Top face',
        instruction: `Turn back to ${knownCenters.F ? `${knownCenters.F} front` : 'the front face'}, then tilt the top of the whole cube forward toward the camera to show the ${center('U', 'top face')}.`,
        rotationHint: 'Tilt whole cube top toward camera',
        arrowDirection: 'down',
        referenceRotation: [Math.PI / 2 + 0.18, -0.22, 0],
      };
    case 'D':
      return {
        heading: 'Tilt upward to show the Bottom face',
        instruction: `Tilt the bottom of the whole cube upward toward the camera so the ${center('D', 'bottom face')} faces straight ahead.`,
        rotationHint: 'Tilt whole cube bottom toward camera',
        arrowDirection: 'up',
        referenceRotation: [-Math.PI / 2 + 0.18, -0.22, 0],
      };
  }
}

/** Face names for the scan UI (wording matches legacy FACE_META label / fullName). */
export const FACE_NAMES: Readonly<Record<FaceId, { label: string; fullName: string }>> = {
  F: { label: 'F — Front', fullName: 'Front' },
  R: { label: 'R — Right', fullName: 'Right' },
  B: { label: 'B — Back', fullName: 'Back' },
  L: { label: 'L — Left', fullName: 'Left' },
  U: { label: 'U — Up', fullName: 'Top' },
  D: { label: 'D — Down', fullName: 'Bottom' },
};
