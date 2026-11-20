// Deterministic DEMO fixtures. Everything here is simulated; never present it as a camera reading.
// Scrambles are copied (not moved) from the legacy lib/cubeEngine PRESET_SCRAMBLES.
import type { CenterColors, FaceletState, MoveToken, SixFaces } from '@/types/cube';
import type { SolveProvenance } from '@/types/api';
import { SOLVED, facesFromState } from '@/engine/cube-state';
import { applyMove } from '@/engine/move-engine';

export const DEMO_SOURCE: SolveProvenance = 'demo-fixture';

/** Documented initial scan convention: green front, white up. */
export const DEMO_CENTER_COLORS: CenterColors = Object.freeze({
  U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue',
});

const scramble = (...m: MoveToken[]): readonly MoveToken[] => Object.freeze(m);

export const DEMO_SCRAMBLES: readonly (readonly MoveToken[])[] = Object.freeze([
  scramble('R', 'U', "R'", 'F2', "D'", 'L', 'B2', 'U2', "R'", 'F', 'U', "L'", 'D2', "B'", 'R2', 'U', "F'", 'D'),
  scramble('F', 'R2', "U'", 'B', 'L2', 'D', "R'", 'F2', 'U', "L'", "B'", 'D2', 'R', "U'", 'F', 'L', "D'", 'B2'),
  scramble('U2', 'R', "F'", 'L2', 'D', "B'", 'R2', 'U', "L'", 'F2', "D'", 'B', "R'", 'U2', 'L', "F'", 'D2', 'R'),
]);

/** Scrambled state of demo `index` (applied to SOLVED with the engine). */
export function demoInitialState(index: number): FaceletState {
  const s = DEMO_SCRAMBLES[index];
  if (!s) throw new RangeError(`No demo cube at index ${index}`);
  return s.reduce<FaceletState>((st, m) => applyMove(st, m), SOLVED);
}

/** What a demo "scan" captures: six grids of the demo cube using the demo centre colours. */
export function demoFaces(index: number): SixFaces {
  return facesFromState(demoInitialState(index), DEMO_CENTER_COLORS);
}
