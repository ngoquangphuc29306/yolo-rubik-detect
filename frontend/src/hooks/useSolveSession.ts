// Solve orchestration. runSolve is pure (no React) so it can be tested directly.
import { useCallback, useEffect, useRef } from 'react';
import { bindSolveResponse } from '@/engine/solve-binding';
import { createLatestGuard, type LatestGuard } from '@/lib/request-guard';
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
  actions.beginSolve();

  if (deps.mode === null) {
    actions.setError({ kind: 'client', code: 'REQUEST_INVALID', message: 'No active session mode.', retryable: false });
    return;
  }
  // Live NEVER falls back to demo.
  const result: SolveResult | DemoSolveResult =
    deps.mode === 'demo' ? await deps.solveDemo(request) : await deps.solveBackend(request, { signal: handle.signal });
  if (stale()) return;

  if (!result.ok) {
    if (result.error.kind === 'client' && result.error.code === 'REQUEST_CANCELLED') return;
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
}

export function useSolveSession() {
  const status = useCubeStore((s) => s.status);
  const error = useCubeStore((s) => s.error);
  const solution = useCubeStore((s) => s.solution);
  const sessionId = useSessionStore((s) => s.sessionId);
  const guardRef = useRef<LatestGuard | null>(null);
  guardRef.current ??= createLatestGuard();
  const guard = guardRef.current;

  // New session or unmount: abort any in-flight request.
  useEffect(() => () => guard.reset(), [guard, sessionId]);

  const solve = useCallback(
    (request: SolveRequest) => {
      const c = useCubeStore.getState();
      return runSolve(request, {
        mode: useSessionStore.getState().mode,
        getSessionId: () => useSessionStore.getState().sessionId,
        guard,
        solveBackend: (r, o) => solveBackendDefault(r, o),
        solveDemo: demoSolveDefault,
        actions: { beginSolve: c.beginSolve, setReady: c.setReady, setError: c.setError },
      });
    },
    [guard],
  );

  return { status, error, solution, solve };
}
