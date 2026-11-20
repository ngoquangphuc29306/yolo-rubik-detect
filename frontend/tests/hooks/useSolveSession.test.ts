import { beforeEach, describe, expect, it } from 'vitest';
import { runSolve, type SolveDeps } from '@/hooks/useSolveSession';
import { createLatestGuard } from '@/lib/request-guard';
import { useCubeStore } from '@/stores/cube-store';
import { useSessionStore } from '@/stores/session-store';
import { demoSolve } from '@/demo/demo-solver';
import { DEMO_CENTER_COLORS, demoFaces } from '@/demo/demo-fixtures';
import { SOLVED, facesFromState } from '@/engine/cube-state';
import { parseSolveResponse } from '@/services/parsers';
import type { SolveRequest, SolveResponse, SolveError } from '@/types/api';
import type { SixFaces } from '@/types/cube';
import type { SolveResult } from '@/services/solver-client';
import { loadFixture } from '../services/fixtures';

const req = (f: SixFaces): SolveRequest => ({ schemaVersion: 1, faces: f as unknown as SolveRequest['faces'] });
const scrambled = req(demoFaces(0));
const solvedReq = req(facesFromState(SOLVED, DEMO_CENTER_COLORS));
const solvedResponse = (): SolveResponse => {
  const p = parseSolveResponse(loadFixture('solve/solved.response.json'));
  if (!p.ok) throw new Error('fixture');
  return p.value;
};
const okBackend = (response: SolveResponse): SolveResult => ({ ok: true, outcome: { response, source: 'backend' } });
const netErr: SolveError = { kind: 'client', code: 'BACKEND_UNAVAILABLE', message: 'down', retryable: true };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function deps(over: Partial<SolveDeps> = {}): SolveDeps {
  const c = useCubeStore.getState();
  return {
    mode: 'demo',
    getSessionId: () => useSessionStore.getState().sessionId,
    guard: createLatestGuard(),
    solveBackend: async () => { throw new Error('backend must not be called'); },
    solveDemo: demoSolve,
    actions: { beginSolve: c.beginSolve, setReady: c.setReady, setError: c.setError },
    ...over,
  };
}
const state = () => useCubeStore.getState();

beforeEach(() => {
  useSessionStore.setState({ mode: null, screen: 'landing', sessionId: 0 });
  useCubeStore.getState().reset();
});

describe('runSolve', () => {
  it('demo success is ready with snapshots and demo-fixture source', async () => {
    await runSolve(scrambled, deps());
    const s = state();
    expect(s.status).toBe('ready');
    expect(s.solution?.source).toBe('demo-fixture');
    expect(s.solution?.snapshots.length).toBe(s.solution!.moves.length + 1);
    expect(s.solution!.moves.length).toBeGreaterThan(0);
  });
  it('live success via backend is ready with source backend; demo is not called', async () => {
    const d = deps({
      mode: 'live',
      solveBackend: async () => okBackend(solvedResponse()),
      solveDemo: async () => { throw new Error('no demo in live'); },
    });
    await runSolve(solvedReq, d);
    expect(state().status).toBe('ready');
    expect(state().solution?.source).toBe('backend');
  });
  it('empty solution on a solved cube is ready with moves=[] and one snapshot', async () => {
    await runSolve(solvedReq, deps({ mode: 'live', solveBackend: async () => okBackend(solvedResponse()) }));
    expect(state().status).toBe('ready');
    expect(state().solution?.moves).toEqual([]);
    expect(state().solution?.snapshots).toHaveLength(1);
  });
  it('valid-but-wrong response (solved response for scrambled request) is RESPONSE_MISMATCH and never ready', async () => {
    const seen: string[] = [];
    const unsub = useCubeStore.subscribe((s) => seen.push(s.status));
    await runSolve(scrambled, deps({ mode: 'live', solveBackend: async () => okBackend(solvedResponse()) }));
    unsub();
    expect(state()).toMatchObject({ status: 'error', solution: null, error: { kind: 'client', code: 'RESPONSE_MISMATCH', retryable: false } });
    expect(seen).not.toContain('ready');
  });
  it('wrong moves are SOLUTION_REPLAY_MISMATCH', async () => {
    const good = await demoSolve(scrambled);
    if (!good.ok) throw new Error('demo');
    const bad: SolveResponse = { ...good.outcome.response, moves: ['R'], moveCount: 1 };
    await runSolve(scrambled, deps({ mode: 'live', solveBackend: async () => okBackend(bad) }));
    expect(state()).toMatchObject({ status: 'error', error: { code: 'SOLUTION_REPLAY_MISMATCH' } });
  });
  it('live with backend unavailable errors and does not fall back to demo', async () => {
    let demoCalled = false;
    await runSolve(scrambled, deps({
      mode: 'live',
      solveBackend: async () => ({ ok: false, error: netErr }),
      solveDemo: async (r) => { demoCalled = true; return demoSolve(r); },
    }));
    expect(demoCalled).toBe(false);
    expect(state()).toMatchObject({ status: 'error', solution: null, error: netErr });
  });
  it('null mode is an error and calls neither solver', async () => {
    await runSolve(scrambled, deps({ mode: null }));
    expect(state()).toMatchObject({ status: 'error', error: { code: 'REQUEST_INVALID' } });
  });
  it('a cancelled result leaves the state untouched', async () => {
    await runSolve(scrambled, deps({
      mode: 'live',
      solveBackend: async () => ({ ok: false, error: { kind: 'client', code: 'REQUEST_CANCELLED', message: 'c', retryable: false } }),
    }));
    expect(state().status).toBe('solving');
    expect(state().error).toBeNull();
  });

  describe('stale results', () => {
    const goodResp = async () => {
      const g = await demoSolve(scrambled);
      if (!g.ok) throw new Error('demo');
      return g.outcome.response;
    };
    it('first solve resolving after a second began is ignored (success)', async () => {
      const guard = createLatestGuard();
      const first = deferred<SolveResult>();
      const second = deferred<SolveResult>();
      const queue = [first, second];
      const d = deps({ mode: 'live', guard, solveBackend: () => queue.shift()!.promise });
      const p1 = runSolve(scrambled, d);
      const p2 = runSolve(scrambled, d);
      first.resolve(okBackend(await goodResp()));
      await p1;
      expect(state().status).toBe('solving');
      second.resolve({ ok: false, error: netErr });
      await p2;
      expect(state()).toMatchObject({ status: 'error', error: netErr });
    });
    it('first solve failing after a second began is ignored (error)', async () => {
      const guard = createLatestGuard();
      const first = deferred<SolveResult>();
      const second = deferred<SolveResult>();
      const queue = [first, second];
      const d = deps({ mode: 'live', guard, solveBackend: () => queue.shift()!.promise });
      const p1 = runSolve(scrambled, d);
      const p2 = runSolve(scrambled, d);
      first.resolve({ ok: false, error: netErr });
      await p1;
      expect(state()).toMatchObject({ status: 'solving', error: null });
      second.resolve(okBackend(await goodResp()));
      await p2;
      expect(state().status).toBe('ready');
    });
    it('a result arriving after startSession (sessionId changed) is ignored', async () => {
      const pending = deferred<SolveResult>();
      const d = deps({ mode: 'live', solveBackend: () => pending.promise });
      const p = runSolve(scrambled, d);
      useSessionStore.getState().startSession('live', 'scanning');
      pending.resolve(okBackend(await goodResp()));
      await p;
      expect(state().status).toBe('idle');
      expect(state().solution).toBeNull();
    });
    it('an error arriving after startSession is ignored too', async () => {
      const pending = deferred<SolveResult>();
      const p = runSolve(scrambled, deps({ mode: 'live', solveBackend: () => pending.promise }));
      useSessionStore.getState().startSession('live', 'scanning');
      pending.resolve({ ok: false, error: netErr });
      await p;
      expect(state()).toMatchObject({ status: 'idle', error: null });
    });
  });
});
