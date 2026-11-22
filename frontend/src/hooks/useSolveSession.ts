// Solve orchestration. runSolve is pure (no React) so it can be tested directly.
import { useCallback } from 'react';
import { CubeStateError, buildFaceletState } from '@/engine/cube-state';
import type { SixFaces } from '@/types/cube';
import { bindSolveResponse } from '@/engine/solve-binding';
import type { LatestGuard } from '@/lib/request-guard';
import { solveRequestGuard } from '@/stores/solve-guard';
import { solve as solveBackendDefault, type SolveResult } from '@/services/solver-client';
import { demoSolve as demoSolveDefault, type DemoSolveResult } from '@/demo/demo-solver';
import { useCubeStore, type SolutionData } from '@/stores/cube-store';
import { useSessionStore, type SessionMode } from '@/stores/session-store';
import type { SolveError, SolveRequest } from '@/types/api';

export interface SolveDeps {
  mode: SessionMode | null;
  getSessionId: () => number;
  guard: LatestGuard;
  solveBackend: (request: SolveRequest, opts: { signal: AbortSignal }) => Promise<SolveResult>;
  solveDemo: (request: SolveRequest) => Promise<DemoSolveResult>;
  actions: {
    beginSolve: () => void;
    setReady: (solution: SolutionData) => void;
    setError: (error: SolveError) => void;
  };
}

export async function runSolve(request: SolveRequest, deps: SolveDeps): Promise<void> {
  const { actions, guard } = deps;
  const handle = guard.begin();
  const sessionId = deps.getSessionId();
  const stale = () => !handle.isCurrent() || deps.getSessionId() !== sessionId;

  // Fail closed BEFORE any solver/network call: a malformed scan is never sent anywhere.
  // guard.begin() above already superseded (and aborted) any earlier in-flight run.
  try {
    buildFaceletState(request.faces as unknown as SixFaces);
  } catch (e) {
    actions.setError({
      kind: 'client',
      code: 'REQUEST_INVALID',
      message: e instanceof CubeStateError ? e.message : 'The scanned cube data is malformed.',
      retryable: false,
    });
    return;
  }
  actions.beginSolve();

  try {
    if (deps.mode === null) {
      actions.setError({ kind: 'client', code: 'REQUEST_INVALID', message: 'No active session mode.', retryable: false });
      return;
    }
    // Live NEVER falls back to demo.
    const result: SolveResult | DemoSolveResult =
      deps.mode === 'demo' ? await deps.solveDemo(request) : await deps.solveBackend(request, { signal: handle.signal });
    // A stale drop never strands 'solving': a newer solve owns the status, or startSession reset the stores.
    if (stale()) return;

    if (!result.ok) {
      actions.setError(result.error);
      return;
    }
    const binding = bindSolveResponse(request, result.outcome.response);
    if (!binding.ok) {
      actions.setError({ kind: 'client', code: binding.code, message: binding.reason, retryable: false });
      return;
    }
    const { state, centers, moves, snapshots } = binding;
    actions.setReady({ state, centers, moves, snapshots, source: result.outcome.source });
  } catch (e) {
    if (stale()) return;
    actions.setError({
      kind: 'client',
      code: 'BAD_RESPONSE',
      message: e instanceof Error ? e.message : 'The solve failed unexpectedly.',
      retryable: false,
    });
  }
}

export function useSolveSession() {
  const status = useCubeStore((s) => s.status);
  const error = useCubeStore((s) => s.error);
  const solution = useCubeStore((s) => s.solution);
  // The guard is a session-owned singleton (reset synchronously by startSession), not per-hook state.
  const solve = useCallback(
    (request: SolveRequest) => {
      const c = useCubeStore.getState();
      return runSolve(request, {
        mode: useSessionStore.getState().mode,
        getSessionId: () => useSessionStore.getState().sessionId,
        guard: solveRequestGuard,
        solveBackend: (r, o) => solveBackendDefault(r, o),
        solveDemo: demoSolveDefault,
        actions: { beginSolve: c.beginSolve, setReady: c.setReady, setError: c.setError },
      });
    },
    [],
  );

  return { status, error, solution, solve };
}
