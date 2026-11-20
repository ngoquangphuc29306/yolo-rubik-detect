// Binds a backend solve response to the request that produced it. Pure; never throws for bad input data.
// A valid-looking solution for a DIFFERENT cube (e.g. the solved cube) is rejected here (B4).
import { SOLVER_FACE_ORDER, type CenterColors, type FaceletState, type MoveToken, type SixFaces } from '@/types/cube';
import type { SolveRequest, SolveResponse } from '@/types/api';
import { CubeStateError, buildFaceletState } from './cube-state';
import { parseMoveToken, verifySolution } from './move-engine';

export type BindFailureCode = 'RESPONSE_MISMATCH' | 'SOLUTION_REPLAY_MISMATCH' | 'REQUEST_INVALID';

export type BindResult =
  | {
      ok: true;
      state: FaceletState;
      centers: CenterColors;
      moves: readonly MoveToken[];
      snapshots: readonly FaceletState[];
    }
  | { ok: false; code: BindFailureCode; reason: string };

const fail = (code: BindFailureCode, reason: string): BindResult => ({ ok: false, code, reason });

export function bindSolveResponse(request: SolveRequest, response: SolveResponse): BindResult {
  let built: { state: FaceletState; centers: CenterColors };
  try {
    built = buildFaceletState(request.faces as unknown as SixFaces);
  } catch (e) {
    if (e instanceof CubeStateError) return fail('REQUEST_INVALID', e.message);
    return fail('REQUEST_INVALID', 'Request could not be read');
  }

  if (response.initialState !== built.state) {
    return fail('RESPONSE_MISMATCH', 'Response initialState does not match the submitted cube');
  }
  const rc = response.centerColors as Partial<Record<string, unknown>> | null | undefined;
  for (const f of SOLVER_FACE_ORDER) {
    if (!rc || rc[f] !== built.centers[f]) {
      return fail('RESPONSE_MISMATCH', `Response centre colour for ${f} does not match the submitted cube`);
    }
  }
  if (!Array.isArray(response.moves) || response.moveCount !== response.moves.length) {
    return fail('RESPONSE_MISMATCH', 'Response moveCount does not match its move list');
  }

  const moves: MoveToken[] = [];
  for (const t of response.moves) {
    try {
      moves.push(parseMoveToken(t));
    } catch {
      return fail('SOLUTION_REPLAY_MISMATCH', `Illegal move token ${JSON.stringify(t)}`);
    }
  }

  const verified = verifySolution(built.state, moves);
  if (!verified.ok) return fail('SOLUTION_REPLAY_MISMATCH', verified.reason);
  return { ok: true, state: built.state, centers: built.centers, moves, snapshots: verified.snapshots };
}
