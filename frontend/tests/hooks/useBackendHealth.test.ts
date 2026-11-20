import { describe, expect, it } from 'vitest';
import { checkHealth } from '@/hooks/useBackendHealth';
import { createLatestGuard } from '@/lib/request-guard';
import type { HealthResponse, LiveReadiness } from '@/types/api';
import { loadFixture } from '../services/fixtures';

const ok = loadFixture<HealthResponse>('health/ok.json');
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const run = (getHealth: () => Promise<HealthResponse | null>) => {
  const out: LiveReadiness[] = [];
  const p = checkHealth({ guard: createLatestGuard(), getHealth, onResult: (r) => out.push(r) });
  return { out, p };
};

describe('checkHealth', () => {
  it('maps health to readiness', async () => {
    const a = run(async () => ok); await a.p;
    expect(a.out).toEqual([{ kind: 'ready' }]);
    const b = run(async () => null); await b.p;
    expect(b.out).toEqual([{ kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: false }]);
    const c = run(async () => loadFixture<HealthResponse>('health/model-unavailable.json')); await c.p;
    expect(c.out[0]).toMatchObject({ kind: 'blocked', reason: 'MODEL_UNAVAILABLE' });
  });
  it('status !== ok is never ready', async () => {
    const a = run(async () => ({ ...ok, status: 'degraded' })); await a.p;
    expect(a.out).toEqual([{ kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: true }]);
  });
  it('a stale health result is ignored', async () => {
    const guard = createLatestGuard();
    const first = deferred<HealthResponse | null>();
    const second = deferred<HealthResponse | null>();
    const q = [first, second];
    const out: LiveReadiness[] = [];
    const deps = { guard, getHealth: () => q.shift()!.promise, onResult: (r: LiveReadiness) => out.push(r) };
    const p1 = checkHealth(deps);
    const p2 = checkHealth(deps);
    first.resolve(ok);
    await p1;
    expect(out).toEqual([]);
    second.resolve(null);
    await p2;
    expect(out).toEqual([{ kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: false }]);
  });
});
