export type StickerColor = 'W' | 'Y' | 'G' | 'B' | 'R' | 'O';
export type FaceKey = 'F' | 'R' | 'B' | 'L' | 'U' | 'D';

export interface ColorMeta {
  code: StickerColor;
  name: string;
  hex: string;
  threeHex: string;
  tailwindBg: string;
  textDark: boolean;
}

export const STICKER_COLORS: Record<StickerColor, ColorMeta> = {
  W: {
    code: 'W',
    name: 'White',
    hex: '#F4F4F6',
    threeHex: '#F3F4F6',
    tailwindBg: 'bg-[#F4F4F6]',
    textDark: true,
  },
  Y: {
    code: 'Y',
    name: 'Yellow',
    hex: '#FACC15',
    threeHex: '#F2C929',
    tailwindBg: 'bg-[#FACC15]',
    textDark: true,
  },
  G: {
    code: 'G',
    name: 'Green',
    hex: '#16A34A',
    threeHex: '#18A957',
    tailwindBg: 'bg-[#16A34A]',
    textDark: false,
  },
  B: {
    code: 'B',
    name: 'Blue',
    hex: '#2563EB',
    threeHex: '#2563EB',
    tailwindBg: 'bg-[#2563EB]',
    textDark: false,
  },
  R: {
    code: 'R',
    name: 'Red',
    hex: '#DC2626',
    threeHex: '#DC2B2B',
    tailwindBg: 'bg-[#DC2626]',
    textDark: false,
  },
  O: {
    code: 'O',
    name: 'Orange',
    hex: '#F97316',
    threeHex: '#F2711C',
    tailwindBg: 'bg-[#F97316]',
    textDark: false,
  },
};

export const FACE_ORDER: FaceKey[] = ['F', 'R', 'B', 'L', 'U', 'D'];

export interface FaceMeta {
  key: FaceKey;
  label: string;
  fullName: string;
  defaultCenter: StickerColor;
  scanHeading: string;
  scanInstruction: string;
  rotationHint: string;
  arrowDirection: 'none' | 'left' | 'right' | 'down' | 'up';
  /** Euler angles [x, y, z] for mini reference 3D cube so that this face faces front (+Z) */
  referenceRotation: [number, number, number];
}

export const FACE_META: Record<FaceKey, FaceMeta> = {
  F: {
    key: 'F',
    label: 'F — Front',
    fullName: 'Front',
    defaultCenter: 'G',
    scanHeading: 'Hold the Front face toward your camera',
    scanInstruction: 'Start with the green center facing you and the white center on top. Keep all 9 stickers inside the frame.',
    rotationHint: 'Hold cube steady facing forward',
    arrowDirection: 'none',
    referenceRotation: [0.18, -0.22, 0],
  },
  R: {
    key: 'R',
    label: 'R — Right',
    fullName: 'Right',
    defaultCenter: 'R',
    scanHeading: 'Rotate the whole cube left to show the Right face',
    scanInstruction: 'Turn the entire cube 90° to the left (do not twist a layer) until the red center faces the camera.',
    rotationHint: 'Rotate whole cube 90° left',
    arrowDirection: 'left',
    referenceRotation: [0.18, -Math.PI / 2 - 0.22, 0],
  },
  B: {
    key: 'B',
    label: 'B — Back',
    fullName: 'Back',
    defaultCenter: 'B',
    scanHeading: 'Rotate left again to show the Back face',
    scanInstruction: 'Turn the entire cube another 90° left so the blue center faces the camera, keeping white on top.',
    rotationHint: 'Rotate whole cube 90° left',
    arrowDirection: 'left',
    referenceRotation: [0.18, -Math.PI - 0.22, 0],
  },
  L: {
    key: 'L',
    label: 'L — Left',
    fullName: 'Left',
    defaultCenter: 'O',
    scanHeading: 'Rotate left once more for the Left face',
    scanInstruction: 'Turn the entire cube 90° left so the orange center faces the camera. Hold steady for auto-capture.',
    rotationHint: 'Rotate whole cube 90° left',
    arrowDirection: 'left',
    referenceRotation: [0.18, Math.PI / 2 - 0.22, 0],
  },
  U: {
    key: 'U',
    label: 'U — Up',
    fullName: 'Top',
    defaultCenter: 'W',
    scanHeading: 'Return to Front, then tilt downward for the Top face',
    scanInstruction: 'Turn back to green front, then tilt the top of the whole cube forward toward the camera to show the white center.',
    rotationHint: 'Tilt whole cube top toward camera',
    arrowDirection: 'down',
    referenceRotation: [Math.PI / 2 + 0.18, -0.22, 0],
  },
  D: {
    key: 'D',
    label: 'D — Down',
    fullName: 'Bottom',
    defaultCenter: 'Y',
    scanHeading: 'Tilt upward to show the Bottom face',
    scanInstruction: 'Tilt the bottom of the whole cube upward toward the camera so the yellow center faces straight ahead.',
    rotationHint: 'Tilt whole cube bottom toward camera',
    arrowDirection: 'up',
    referenceRotation: [-Math.PI / 2 + 0.18, -0.22, 0],
  },
};

export interface CubieState {
  id: number;
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  z: -1 | 0 | 1;
  stickers: Partial<Record<FaceKey, StickerColor>>;
}

export type MoveNotation =
  | 'U' | "U'" | 'U2'
  | 'D' | "D'" | 'D2'
  | 'R' | "R'" | 'R2'
  | 'L' | "L'" | 'L2'
  | 'F' | "F'" | 'F2'
  | 'B' | "B'" | 'B2';

export interface MoveDescriptor {
  notation: MoveNotation;
  face: FaceKey;
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

export function createSolvedCube(): CubieState[] {
  const cubies: CubieState[] = [];
  let id = 0;
  for (const x of [-1, 0, 1] as const) {
    for (const y of [-1, 0, 1] as const) {
      for (const z of [-1, 0, 1] as const) {
        const stickers: Partial<Record<FaceKey, StickerColor>> = {};
        if (y === 1) stickers.U = 'W';
        if (y === -1) stickers.D = 'Y';
        if (z === 1) stickers.F = 'G';
        if (z === -1) stickers.B = 'B';
        if (x === 1) stickers.R = 'R';
        if (x === -1) stickers.L = 'O';
        cubies.push({ id: id++, x, y, z, stickers });
      }
    }
  }
  return cubies;
}

export function cloneCube(cubies: CubieState[]): CubieState[] {
  return cubies.map((c) => ({
    ...c,
    stickers: { ...c.stickers },
  }));
}

export function parseMove(notation: MoveNotation): MoveDescriptor {
  const face = notation[0] as FaceKey;
  const isPrime = notation.includes("'");
  const isDouble = notation.includes('2');
  const turns: 1 | 2 = isDouble ? 2 : 1;
  const clockwise = !isPrime;

  // Standard Rubik's Cube clockwise rotation when looking directly at the face:
  // Right (+X): clockwise looking from +X means rotating -90deg around +X
  // Left  (-X): clockwise looking from -X means rotating +90deg around +X
  // Up    (+Y): clockwise looking from +Y means rotating -90deg around +Y
  // Down  (-Y): clockwise looking from -Y means rotating +90deg around +Y
  // Front (+Z): clockwise looking from +Z means rotating -90deg around +Z
  // Back  (-Z): clockwise looking from -Z means rotating +90deg around +Z
  const faceConfig: Record<
    FaceKey,
    { axis: 'x' | 'y' | 'z'; layer: -1 | 1; cwSign: 1 | -1; faceWord: string; cam: [number, number, number] }
  > = {
    R: { axis: 'x', layer: 1, cwSign: -1, faceWord: 'right', cam: [4.6, 2.8, 4.4] },
    L: { axis: 'x', layer: -1, cwSign: 1, faceWord: 'left', cam: [-4.5, 2.8, 4.5] },
    U: { axis: 'y', layer: 1, cwSign: -1, faceWord: 'top', cam: [3.8, 4.5, 4.2] },
    D: { axis: 'y', layer: -1, cwSign: 1, faceWord: 'bottom', cam: [3.9, -3.6, 4.5] },
    F: { axis: 'z', layer: 1, cwSign: -1, faceWord: 'front', cam: [3.2, 2.5, 5.2] },
    B: { axis: 'z', layer: -1, cwSign: 1, faceWord: 'back', cam: [3.6, 2.8, -5.0] },
  };

  const cfg = faceConfig[face];
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

export function invertMove(notation: MoveNotation): MoveNotation {
  const face = notation[0] as FaceKey;
  if (notation.endsWith('2')) return notation;
  if (notation.endsWith("'")) return face as MoveNotation;
  return `${face}'` as MoveNotation;
}

/** Rotate a single cubie 90 degrees around axis by +1 (+90deg) or -1 (-90deg) */
function rotateCubieOnce(cubie: CubieState, axis: 'x' | 'y' | 'z', sign: 1 | -1): CubieState {
  const { x, y, z, stickers } = cubie;
  let nx = x;
  let ny = y;
  let nz = z;
  const nextStickers: Partial<Record<FaceKey, StickerColor>> = {};

  // Right-handed 90 deg rotation formulas:
  // Around X by +90deg: (x, y, z) -> (x, -z, y); +Y -> +Z (U->F), +Z -> -Y (F->D), -Y -> -Z (D->B), -Z -> +Y (B->U)
  // Around Y by +90deg: (x, y, z) -> (z, y, -x); +Z -> +X (F->R), +X -> -Z (R->B), -Z -> -X (B->L), -X -> +Z (L->F)
  // Around Z by +90deg: (x, y, z) -> (-y, x, z); +Y -> -X (U->L), -X -> -Y (L->D), -Y -> +X (D->R), +X -> +Y (R->U)

  if (axis === 'x') {
    if (sign === 1) {
      ny = (-z) as -1 | 0 | 1;
      nz = y;
      if (stickers.R) nextStickers.R = stickers.R;
      if (stickers.L) nextStickers.L = stickers.L;
      if (stickers.U) nextStickers.F = stickers.U;
      if (stickers.F) nextStickers.D = stickers.F;
      if (stickers.D) nextStickers.B = stickers.D;
      if (stickers.B) nextStickers.U = stickers.B;
    } else {
      ny = z;
      nz = (-y) as -1 | 0 | 1;
      if (stickers.R) nextStickers.R = stickers.R;
      if (stickers.L) nextStickers.L = stickers.L;
      if (stickers.U) nextStickers.B = stickers.U;
      if (stickers.B) nextStickers.D = stickers.B;
      if (stickers.D) nextStickers.F = stickers.D;
      if (stickers.F) nextStickers.U = stickers.F;
    }
  } else if (axis === 'y') {
    if (sign === 1) {
      nx = z;
      nz = (-x) as -1 | 0 | 1;
      if (stickers.U) nextStickers.U = stickers.U;
      if (stickers.D) nextStickers.D = stickers.D;
      if (stickers.F) nextStickers.R = stickers.F;
      if (stickers.R) nextStickers.B = stickers.R;
      if (stickers.B) nextStickers.L = stickers.B;
      if (stickers.L) nextStickers.F = stickers.L;
    } else {
      nx = (-z) as -1 | 0 | 1;
      nz = x;
      if (stickers.U) nextStickers.U = stickers.U;
      if (stickers.D) nextStickers.D = stickers.D;
      if (stickers.F) nextStickers.L = stickers.F;
      if (stickers.L) nextStickers.B = stickers.L;
      if (stickers.B) nextStickers.R = stickers.B;
      if (stickers.R) nextStickers.F = stickers.R;
    }
  } else {
    if (sign === 1) {
      nx = (-y) as -1 | 0 | 1;
      ny = x;
      if (stickers.F) nextStickers.F = stickers.F;
      if (stickers.B) nextStickers.B = stickers.B;
      if (stickers.U) nextStickers.L = stickers.U;
      if (stickers.L) nextStickers.D = stickers.L;
      if (stickers.D) nextStickers.R = stickers.D;
      if (stickers.R) nextStickers.U = stickers.R;
    } else {
      nx = y;
      ny = (-x) as -1 | 0 | 1;
      if (stickers.F) nextStickers.F = stickers.F;
      if (stickers.B) nextStickers.B = stickers.B;
      if (stickers.U) nextStickers.R = stickers.U;
      if (stickers.R) nextStickers.D = stickers.R;
      if (stickers.D) nextStickers.L = stickers.D;
      if (stickers.L) nextStickers.U = stickers.L;
    }
  }

  return {
    ...cubie,
    x: (nx === 0 ? 0 : nx) as -1 | 0 | 1,
    y: (ny === 0 ? 0 : ny) as -1 | 0 | 1,
    z: (nz === 0 ? 0 : nz) as -1 | 0 | 1,
    stickers: nextStickers,
  };
}

export function applyMove(cubies: CubieState[], notation: MoveNotation): CubieState[] {
  const desc = parseMove(notation);
  const sign: 1 | -1 = desc.angle >= 0 ? 1 : -1;
  return cubies.map((cubie) => {
    if (cubie[desc.axis] !== desc.layer) return { ...cubie, stickers: { ...cubie.stickers } };
    let next = cubie;
    for (let i = 0; i < desc.turns; i++) {
      next = rotateCubieOnce(next, desc.axis, sign);
    }
    return next;
  });
}

export function applyMoves(cubies: CubieState[], moves: MoveNotation[]): CubieState[] {
  return moves.reduce((acc, m) => applyMove(acc, m), cloneCube(cubies));
}

/**
 * Extracts a 3x3 face grid (row-major, top-left to bottom-right when looking straight at that face)
 * from the 27-cubie representation.
 */
export function extractFaceGrid(cubies: CubieState[], face: FaceKey): StickerColor[] {
  const grid: StickerColor[] = [];
  const findColor = (x: number, y: number, z: number): StickerColor => {
    const c = cubies.find((item) => item.x === x && item.y === y && item.z === z);
    return c?.stickers[face] ?? 'W';
  };

  if (face === 'F') {
    for (const y of [1, 0, -1]) {
      for (const x of [-1, 0, 1]) grid.push(findColor(x, y, 1));
    }
  } else if (face === 'B') {
    for (const y of [1, 0, -1]) {
      for (const x of [1, 0, -1]) grid.push(findColor(x, y, -1));
    }
  } else if (face === 'R') {
    for (const y of [1, 0, -1]) {
      for (const z of [1, 0, -1]) grid.push(findColor(1, y, z));
    }
  } else if (face === 'L') {
    for (const y of [1, 0, -1]) {
      for (const z of [-1, 0, 1]) grid.push(findColor(-1, y, z));
    }
  } else if (face === 'U') {
    for (const z of [-1, 0, 1]) {
      for (const x of [-1, 0, 1]) grid.push(findColor(x, 1, z));
    }
  } else if (face === 'D') {
    for (const z of [1, 0, -1]) {
      for (const x of [-1, 0, 1]) grid.push(findColor(x, -1, z));
    }
  }
  return grid;
}

export function extractAllFaces(cubies: CubieState[]): Record<FaceKey, StickerColor[]> {
  return {
    F: extractFaceGrid(cubies, 'F'),
    R: extractFaceGrid(cubies, 'R'),
    B: extractFaceGrid(cubies, 'B'),
    L: extractFaceGrid(cubies, 'L'),
    U: extractFaceGrid(cubies, 'U'),
    D: extractFaceGrid(cubies, 'D'),
  };
}

export function getCenterColorForFace(cubies: CubieState[], face: FaceKey): StickerColor {
  const grid = extractFaceGrid(cubies, face);
  return grid[4] ?? FACE_META[face].defaultCenter;
}

// Curated authentic Kociemba-length scrambles (18-20 moves) whose inverses produce exact step-by-step solutions
const PRESET_SCRAMBLES: MoveNotation[][] = [
  ['R', 'U', "R'", 'F2', "D'", 'L', 'B2', 'U2', "R'", 'F', 'U', "L'", 'D2', "B'", 'R2', 'U', "F'", 'D'],
  ['F', 'R2', "U'", 'B', 'L2', 'D', "R'", 'F2', 'U', "L'", "B'", 'D2', 'R', "U'", 'F', 'L', "D'", 'B2'],
  ['U2', 'R', "F'", 'L2', 'D', "B'", 'R2', 'U', "L'", 'F2', "D'", 'B', "R'", 'U2', 'L', "F'", 'D2', 'R'],
];

export function generateScrambleSession(seedIndex?: number): {
  initialCube: CubieState[];
  solution: MoveNotation[];
  scramble: MoveNotation[];
} {
  const idx =
    typeof seedIndex === 'number'
      ? Math.abs(seedIndex) % PRESET_SCRAMBLES.length
      : Math.floor(Math.random() * PRESET_SCRAMBLES.length);
  const scramble = PRESET_SCRAMBLES[idx];
  const initialCube = applyMoves(createSolvedCube(), scramble);
  const solution = [...scramble].reverse().map(invertMove);
  return { initialCube, solution, scramble };
}

export function getCubeStateAtStep(
  initialCube: CubieState[],
  solution: MoveNotation[],
  stepIndex: number
): CubieState[] {
  const clamped = Math.max(0, Math.min(stepIndex, solution.length));
  return applyMoves(initialCube, solution.slice(0, clamped));
}
