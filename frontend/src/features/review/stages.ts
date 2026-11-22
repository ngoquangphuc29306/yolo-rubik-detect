// Pure derivation of the Reconstruction checklist from REAL data (captured faces + solve outcome).
// The UI may reveal a passed stage later than it passed (presentation stagger) but never earlier.
import { buildFaceletState } from '@/engine/cube-state';
import type { CapturedFaces } from '@/stores/scan-store';
import type { SolutionData, SolveStatus } from '@/stores/cube-store';
import type { SessionMode } from '@/stores/session-store';
import type { SolveError } from '@/types/api';
import { COLOR_NAMES } from '@/lib/colors';
import { SCAN_FACE_ORDER, type ColorName, type FaceGrid, type FaceId, type SixFaces } from '@/types/cube';

export type StageState = 'pending' | 'active' | 'passed' | 'failed';
export type StageId = 'faces' | 'colors' | 'centers' | 'validated' | 'solution-match' | 'replay';

export interface Stage {
  id: StageId;
  label: string;
  state: StageState;
  detail?: string;
}

export interface CubeOutcome {
  status: SolveStatus;
  error: SolveError | null;
  solution: Pick<SolutionData, 'moves'> | null;
}

/** Server-side validation rejected the submitted cube (as opposed to transport or binding failures). */
export function isValidationError(error: SolveError | null): boolean {
  return (
    error?.kind === 'api' &&
    (error.code === 'INVALID_CUBE_STATE' ||
      error.code === 'COLOR_COUNT_MISMATCH' ||
      error.code === 'DUPLICATE_CENTER' ||
      error.code === 'INVALID_FACE_SHAPE')
  );
}

/** Short human text for the error panel. Server messages are passed through verbatim (render as plain text). */
export function describeSolveError(error: SolveError): string {
  if (error.kind === 'api') return error.message;
  switch (error.code) {
    case 'RESPONSE_MISMATCH':
      return 'The solver answered for a different cube';
    case 'SOLUTION_REPLAY_MISMATCH':
      return 'The solution did not solve your cube';
    case 'BACKEND_UNAVAILABLE':
      return 'Solver service is not running';
    case 'BAD_RESPONSE':
      return 'The solver sent an unreadable answer';
    case 'NETWORK':
      return 'Could not reach the solver';
    case 'REQUEST_CANCELLED':
      return '';
    case 'REQUEST_INVALID':
      return error.message;
  }
}

const LABELS: Record<StageId, string> = {
  faces: 'Six faces captured',
  colors: 'Color counts (9 of each)',
  centers: 'Six distinct centers',
  validated: 'Cube state validated',
  'solution-match': 'Solution received and matches your scan',
  replay: 'Solution replays to solved',
};
const ORDER: readonly StageId[] = ['faces', 'colors', 'centers', 'validated', 'solution-match', 'replay'];

interface Verdict {
  state: StageState;
  detail?: string;
}

function frontendVerdicts(captured: CapturedFaces): Partial<Record<StageId, Verdict>> {
  const present = SCAN_FACE_ORDER.filter((f) => captured[f]);
  if (present.length < 6) return { faces: { state: 'failed', detail: `${present.length} of 6` } };
  const out: Partial<Record<StageId, Verdict>> = { faces: { state: 'passed' } };

  const counts = new Map<ColorName, number>();
  for (const f of SCAN_FACE_ORDER) for (const c of captured[f]!.grid) counts.set(c, (counts.get(c) ?? 0) + 1);
  const bad = COLOR_NAMES.filter((c) => (counts.get(c) ?? 0) !== 9);
  if (bad.length > 0) {
    out.colors = { state: 'failed', detail: bad.map((c) => `${c} ${counts.get(c) ?? 0}`).join(', ') };
    return out;
  }
  out.colors = { state: 'passed' };

  const centres = SCAN_FACE_ORDER.map((f) => captured[f]!.grid[4]);
  if (new Set(centres).size !== 6) {
    out.centers = { state: 'failed', detail: 'Two faces share a center color' };
    return out;
  }
  out.centers = { state: 'passed' };

  // Defence in depth: the canonical structural check must agree with the checks above.
  try {
    const faces = {} as Record<FaceId, FaceGrid>;
    for (const f of SCAN_FACE_ORDER) faces[f] = captured[f]!.grid;
    buildFaceletState(faces as SixFaces);
  } catch {
    out.validated = { state: 'failed', detail: 'Structural check failed' };
  }
  return out;
}

/** True when the six captured grids pass the frontend structural checks (stages 1-3 and the canonical builder). */
export function capturedFacesAreStructurallyValid(captured: CapturedFaces): boolean {
  const v = frontendVerdicts(captured);
  return ORDER.slice(0, 3).every((id) => v[id]?.state === 'passed') && !v.validated;
}

export function deriveReconstructionStages(input: {
  captured: CapturedFaces;
  mode: SessionMode | null;
  cube: CubeOutcome;
}): Stage[] {
  const { captured, mode, cube } = input;
  const demo = mode === 'demo';
  const verdicts: Partial<Record<StageId, Verdict>> = frontendVerdicts(captured);
  const label = (id: StageId): string =>
    id === 'solution-match' && demo ? 'Demo solution (pre-computed) matches your scan' : LABELS[id];

  const frontendOk = ORDER.slice(0, 3).every((id) => verdicts[id]?.state === 'passed') && !verdicts.validated;
  if (frontendOk) {
    const { status, error, solution } = cube;
    const passed = (detail?: string): Verdict => ({ state: 'passed', detail });
    if (status === 'ready') {
      verdicts.validated = passed(demo ? 'Demo fixture' : undefined);
      verdicts['solution-match'] = passed(demo ? 'Demo fixture' : undefined);
      const n = solution?.moves.length;
      verdicts.replay = passed(n === undefined ? undefined : n === 0 ? 'Already solved' : `${n} moves`);
    } else if (status === 'error' && error && !(error.kind === 'client' && error.code === 'REQUEST_CANCELLED')) {
      if (error.kind === 'client' && error.code === 'RESPONSE_MISMATCH') {
        verdicts.validated = passed(demo ? 'Demo fixture' : undefined);
        verdicts['solution-match'] = { state: 'failed', detail: 'Answered for a different cube' };
      } else if (error.kind === 'client' && error.code === 'SOLUTION_REPLAY_MISMATCH') {
        verdicts.validated = passed(demo ? 'Demo fixture' : undefined);
        verdicts['solution-match'] = passed(demo ? 'Demo fixture' : undefined);
        verdicts.replay = { state: 'failed', detail: 'Did not solve your cube' };
      } else if (isValidationError(error)) {
        verdicts.validated = { state: 'failed', detail: 'Rejected by validation' };
      } else {
        // Transport / timeout / unreadable answer: the cube could not be validated by the solver at all.
        verdicts.validated = { state: 'failed', detail: 'Not validated by the solver' };
      }
    }
  }

  // Walk in order: the first unresolved stage is active, everything after a failure or an active stage is pending.
  let blocked = false;
  return ORDER.map((id): Stage => {
    const v = verdicts[id];
    const base = { id, label: label(id) };
    if (blocked) return { ...base, state: 'pending' };
    if (!v) {
      blocked = true;
      const solvable = frontendOk;
      return { ...base, state: solvable ? 'active' : 'pending' };
    }
    if (v.state === 'failed') blocked = true;
    return v.detail === undefined ? { ...base, state: v.state } : { ...base, state: v.state, detail: v.detail };
  });
}
