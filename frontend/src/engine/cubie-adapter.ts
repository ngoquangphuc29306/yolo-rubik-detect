// Renderer-only derived model: 27 cubies (incl. the stickerless core at (0,0,0), id 13, the renderer shows it through layer gaps) from the authoritative FaceletState. Pure; no React/three.
// Cubie ids identify POSITION SLOTS, not physical cubies: the same (x,y,z) always gets the same id.
import type { CenterColors, FaceId, FaceletState, RenderCubie } from '@/types/cube';
import { SOLVER_FACE_ORDER } from '@/types/cube';
import { colorNameToCode } from '@/lib/colors';
import { CubeStateError, parseFaceletState } from './cube-state';
import { FACELETS } from './facelet-geometry';

const NORMAL_TO_FACE: Readonly<Record<string, FaceId>> = {
  '1,0,0': 'R',
  '-1,0,0': 'L',
  '0,1,0': 'U',
  '0,-1,0': 'D',
  '0,0,1': 'F',
  '0,0,-1': 'B',
};

const AXIS = [-1, 0, 1] as const;

/** Throws CubeStateError on a malformed state or invalid centres; never substitutes a default colour. */
export function toCubies(state: FaceletState, centers: CenterColors): RenderCubie[] {
  const c = centers as Partial<Record<FaceId, unknown>>;
  for (const f of SOLVER_FACE_ORDER) {
    if (c[f] === undefined) throw new CubeStateError('MISSING_FACE', `Centre colour for face ${f} is missing`);
  }
  parseFaceletState(state, centers); // structure + six distinct, known colours

  const cubies: RenderCubie[] = [];
  const slot = new Map<string, RenderCubie>();
  let id = 0;
  for (const x of AXIS) {
    for (const y of AXIS) {
      for (const z of AXIS) {
        const cubie: RenderCubie = { id: id++, x, y, z, stickers: {} };
        cubies.push(cubie);
        slot.set(`${x},${y},${z}`, cubie);
      }
    }
  }

  for (const fl of FACELETS) {
    const cubie = slot.get(fl.position.join(','));
    const face = NORMAL_TO_FACE[fl.normal.join(',')];
    if (!cubie || !face) throw new Error(`Facelet ${fl.index} has no cubie slot`);
    cubie.stickers[face] = colorNameToCode(centers[state[fl.index] as FaceId]);
  }
  return cubies;
}
