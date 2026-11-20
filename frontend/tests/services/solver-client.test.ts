import { describe, expect, it } from 'vitest';
import { solve } from '@/services/solver-client';
import { SOLVE_PATH } from '@/services/api-config';
import type { SolveRequest } from '@/types/api';
import { fixtureText, loadFixture } from './fixtures';

const request = loadFixture<SolveRequest>('solve/scramble-a.request.json');
const res = (body: string, status = 200) => new Response(body, { status });
const run = (fetchImpl: typeof fetch, signal = new AbortController().signal) => solve(request, { signal, fetchImpl });

describe('solver-client', () => {
  it('200 with a valid body is ok, sourced from the backend, and posts JSON to the solve path', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const r = await run(async (url, init) => {
      seen = { url: String(url), init };
      return res(fixtureText('solve/scramble-a.response.json'));
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.outcome.source).toBe('backend');
      expect(r.outcome.response.moveCount).toBe(12);
      expect(Object.keys(r.outcome.response)).not.toContain('source');
    }
    expect(seen?.url).toBe(SOLVE_PATH);
    expect(seen?.init?.method).toBe('POST');
    expect(JSON.parse(String(seen?.init?.body))).toEqual(request);
  });

  it('honours a base URL override', async () => {
    let url = '';
    await solve(request, {
      signal: new AbortController().signal,
      baseUrl: 'http://127.0.0.1:8000',
      fetchImpl: async (u) => { url = String(u); return res('{}', 500); },
    });
    expect(url).toBe(`http://127.0.0.1:8000${SOLVE_PATH}`);
  });

  it('422 with an envelope is a typed api error with retryable', async () => {
    const r = await run(async () => res(fixtureText('solve/invalid-cube-state.error.json'), 422));
    expect(r).toMatchObject({ ok: false, error: { kind: 'api', code: 'INVALID_CUBE_STATE', retryable: true } });
    const d = await run(async () => res(fixtureText('solve/duplicate-center.error.json'), 422));
    expect(d).toMatchObject({ ok: false, error: { kind: 'api', code: 'DUPLICATE_CENTER' } });
  });

  it('503 with an envelope is an api error; without one it is BACKEND_UNAVAILABLE', async () => {
    const env = JSON.stringify({ error: { code: 'MODEL_UNAVAILABLE', message: 'no model', retryable: false } });
    expect(await run(async () => res(env, 503))).toMatchObject({
      ok: false, error: { kind: 'api', code: 'MODEL_UNAVAILABLE', retryable: false },
    });
    expect(await run(async () => res('<html>Bad gateway</html>', 503))).toMatchObject({
      ok: false, error: { kind: 'client', code: 'BACKEND_UNAVAILABLE' },
    });
  });

  it('a network failure is BACKEND_UNAVAILABLE and never throws', async () => {
    const r = await run(async () => { throw new TypeError('Failed to fetch'); });
    expect(r).toMatchObject({ ok: false, error: { kind: 'client', code: 'BACKEND_UNAVAILABLE', retryable: true } });
  });

  it('HTTP 404 and 502 without an envelope (dead dev proxy) are BACKEND_UNAVAILABLE', async () => {
    for (const status of [404, 502]) {
      expect(await run(async () => res('<html>Bad gateway</html>', status))).toMatchObject({
        ok: false, error: { kind: 'client', code: 'BACKEND_UNAVAILABLE', retryable: true },
      });
    }
  });

  it('malformed JSON, invalid schema and extra keys are BAD_RESPONSE', async () => {
    expect(await run(async () => res('{not json'))).toMatchObject({ ok: false, error: { code: 'BAD_RESPONSE' } });
    expect(await run(async () => res('{}'))).toMatchObject({ ok: false, error: { code: 'BAD_RESPONSE' } });
    const extra = JSON.stringify({ ...loadFixture<object>('solve/solved.response.json'), source: 'backend' });
    expect(await run(async () => res(extra))).toMatchObject({ ok: false, error: { code: 'BAD_RESPONSE' } });
  });

  it('unexpected statuses are never successes', async () => {
    expect((await run(async () => res('{}', 500))).ok).toBe(false);
    expect(await run(async () => res('garbage', 422))).toMatchObject({ ok: false, error: { code: 'BAD_RESPONSE' } });
    expect((await run(async () => res(fixtureText('solve/solved.response.json'), 201))).ok).toBe(false);
  });

  it('a 200 carrying an error envelope is BAD_RESPONSE', async () => {
    const r = await run(async () => res(fixtureText('solve/invalid-cube-state.error.json'), 200));
    expect(r).toMatchObject({ ok: false, error: { kind: 'client', code: 'BAD_RESPONSE' } });
  });

  it('an aborted request is REQUEST_CANCELLED and delivers no result', async () => {
    const ac = new AbortController();
    const fetchImpl = ((_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      })) as typeof fetch;
    const p = run(fetchImpl, ac.signal);
    ac.abort();
    expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'REQUEST_CANCELLED', retryable: false } });
  });

  it('an already-aborted signal short-circuits without calling fetch', async () => {
    const ac = new AbortController();
    ac.abort();
    let called = false;
    const r = await run(async () => { called = true; return res('{}'); }, ac.signal);
    expect(called).toBe(false);
    expect(r).toMatchObject({ ok: false, error: { code: 'REQUEST_CANCELLED' } });
  });

  it('abort after fetch resolved but before the result is delivered is REQUEST_CANCELLED', async () => {
    const ac = new AbortController();
    const r = await run(async () => {
      ac.abort();
      return res(fixtureText('solve/solved.response.json'));
    }, ac.signal);
    expect(r).toMatchObject({ ok: false, error: { code: 'REQUEST_CANCELLED' } });
  });
});
