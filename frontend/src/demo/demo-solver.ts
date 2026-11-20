// Demo solver: recognises ONLY the built-in demo cubes (and the solved cube); never fabricates a solution.
// Async: returns a Promise, so the orchestrator can treat it exactly like the solver client.
// The response is a strict-schema SolveResponse; provenance lives on the wrapper only.
import type { FaceletState, MoveToken } from '@/types/cube';
import type { SolveError, SolveOutcome, SolveRequest, SolveResponse } from '@/types/api';
import { SOLVED, buildFaceletState } from '@/engine/cube-state';
import { DEMO_CENTER_COLORS, DEMO_SCRAMBLES, DEMO_SOURCE, demoInitialState } from './demo-fixtures';

export type DemoSolveResult = { ok: true; outcome: SolveOutcome } | { ok: false; error: SolveError };

const invert = (m: MoveToken): MoveToken => (m.endsWith("'") ? (m[0] as MoveToken) : m.endsWith('2') ? m : (`${m}'` as MoveToken));

const unknownCube = (): DemoSolveResult => ({
  ok: false,
  error: {
    kind: 'client',
    code: 'REQUEST_INVALID',
    message: 'Demo mode only solves its built-in demo cubes',
    retryable: false,
  },
});

function outcome(initial: FaceletState, moves: readonly MoveToken[]): DemoSolveResult {
  const response: SolveResponse = {
    schemaVersion: 1,
    centerColors: { ...DEMO_CENTER_COLORS },
    initialState: initial,
    moves: [...moves],
    moveCount: moves.length,
  };
  return { ok: true, outcome: { response, source: DEMO_SOURCE } };
}

export async function demoSolve(request: SolveRequest): Promise<DemoSolveResult> {
  let built: ReturnType<typeof buildFaceletState>;
  try {
    built = buildFaceletState(request.faces as never);
  } catch {
    return unknownCube();
  }
  const sameCenters = (Object.keys(DEMO_CENTER_COLORS) as (keyof typeof DEMO_CENTER_COLORS)[]).every(
    (f) => built.centers[f] === DEMO_CENTER_COLORS[f],
  );
  if (!sameCenters) return unknownCube();
  if (built.state === SOLVED) return outcome(SOLVED, []);
  for (let i = 0; i < DEMO_SCRAMBLES.length; i++) {
    if (built.state === demoInitialState(i)) {
      return outcome(built.state, [...DEMO_SCRAMBLES[i]].reverse().map(invert));
    }
  }
  return unknownCube();
}
