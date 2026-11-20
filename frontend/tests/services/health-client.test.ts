import { describe, expect, it } from 'vitest';
import { getHealth } from '@/services/health-client';
import { deriveLiveReadiness } from '@/services/readiness';
import { HEALTH_PATH } from '@/services/api-config';
import type { HealthResponse } from '@/types/api';
import { fixtureText, loadFixture } from './fixtures';

const sig = () => new AbortController().signal;
const res = (body: string, status = 200) => new Response(body, { status });
const health = (f: string) => loadFixture<HealthResponse>(`health/${f}.json`);

describe('getHealth', () => {
  it('returns the parsed health on 200 and requests the health path', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const h = await getHealth({
      signal: sig(),
      fetchImpl: async (u, i) => { url = String(u); init = i; return res(fixtureText('health/ok.json')); },
    });
    expect(h).toEqual(health('ok'));
    expect(url).toBe(HEALTH_PATH);
    expect(init?.cache).toBe('no-store');
  });

  it('returns null when unreachable, non-200, malformed, invalid or aborted; never throws', async () => {
    expect(await getHealth({ signal: sig(), fetchImpl: async () => { throw new TypeError('down'); } })).toBeNull();
    expect(await getHealth({ signal: sig(), fetchImpl: async () => res('{}', 503) })).toBeNull();
    expect(await getHealth({ signal: sig(), fetchImpl: async () => res('nope') })).toBeNull();
    expect(await getHealth({ signal: sig(), fetchImpl: async () => res('{"schemaVersion":1}') })).toBeNull();
    const ac = new AbortController();
    ac.abort();
    expect(await getHealth({ signal: ac.signal, fetchImpl: async () => res(fixtureText('health/ok.json')) })).toBeNull();
  });
});

describe('deriveLiveReadiness', () => {
  it('yolo + visionReady + solverReady is ready', () => {
    expect(deriveLiveReadiness(health('ok'))).toEqual({ kind: 'ready' });
  });
  it('fixture detector is fixture-only even when everything is true', () => {
    const h = health('fixture-mode');
    expect(h.visionReady && h.solverReady && h.status === 'ok').toBe(true);
    expect(deriveLiveReadiness(h)).toEqual({ kind: 'fixture-only', solverReady: true });
    expect(deriveLiveReadiness({ ...h, solverReady: false })).toEqual({ kind: 'fixture-only', solverReady: false });
  });
  it('visionReady false is blocked MODEL_UNAVAILABLE and reports solverReady', () => {
    expect(deriveLiveReadiness(health('model-unavailable'))).toEqual({
      kind: 'blocked', reason: 'MODEL_UNAVAILABLE', solverReady: true,
    });
  });
  it('yolo with vision ready but the solver down is blocked BACKEND_UNAVAILABLE', () => {
    expect(deriveLiveReadiness({ ...health('ok'), solverReady: false })).toEqual({
      kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: false,
    });
  });
  it('any status other than ok is never ready, even with everything else true', () => {
    for (const status of ['degraded', 'error'] as const) {
      expect(deriveLiveReadiness({ ...health('ok'), status })).toEqual({
        kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: true,
      });
    }
  });
  it('null (unreachable) is blocked BACKEND_UNAVAILABLE', () => {
    expect(deriveLiveReadiness(null)).toEqual({ kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: false });
  });
});
