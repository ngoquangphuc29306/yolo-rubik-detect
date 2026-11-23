// @vitest-environment node
// Cross-check 2: real backend solutions must be accepted by the frontend's own parser and binder.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSolveResponse } from '@/services/parsers';
import { bindSolveResponse } from '@/engine/solve-binding';
import { getHealth } from '@/services/health-client';
import { solve } from '@/services/solver-client';
import { deriveLiveReadiness } from '@/services/readiness';
import type { SolveRequest } from '@/types/api';

const readJson = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

interface Case {
  id: string;
  request: SolveRequest;
  response: unknown;
}
const doc = readJson('../../../fixtures/solve/backend-solutions.json') as { schema: string; cases: Case[] };

describe('recorded backend solutions', () => {
  it('has the expected schema and 42 cases', () => {
    expect(doc.schema).toBe('backend-solutions/1');
    expect(doc.cases).toHaveLength(42);
  });

  it.each(doc.cases.map((c) => [c.id, c] as const))('%s parses and binds', (_id, c) => {
    const parsed = parseSolveResponse(c.response);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const bound = bindSolveResponse(c.request, parsed.value);
    expect(bound.ok).toBe(true);
  });
});

const baseUrl = process.env.RUBIK_LIVE_BASE_URL;

describe.runIf(baseUrl)('live backend via frontend clients', () => {
  const solved = readJson('../../../fixtures/solve/solved.request.json') as SolveRequest;
  const scrambleA = readJson('../../../fixtures/solve/scramble-a.request.json') as SolveRequest;
  const signal = new AbortController().signal;

  it('health matches the Phase 2 body and readiness is MODEL_UNAVAILABLE', async () => {
    const health = await getHealth({ signal, baseUrl });
    expect(health).toEqual({
      schemaVersion: 1,
      status: 'degraded',
      detectorMode: 'yolo',
      visionReady: false,
      solverReady: true,
      error: 'Vision is not available in this build.',
    });
    expect(deriveLiveReadiness(health)).toEqual({ kind: 'blocked', reason: 'MODEL_UNAVAILABLE', solverReady: true });
  });

  it('solves the solved cube with no moves', async () => {
    const r = await solve(solved, { signal, baseUrl });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcome.source).toBe('backend');
    expect(r.outcome.response.moves).toEqual([]);
  });

  it('solves scramble-a and the response binds', async () => {
    const r = await solve(scrambleA, { signal, baseUrl });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(bindSolveResponse(scrambleA, r.outcome.response).ok).toBe(true);
  });

  it('rejects a duplicate centre', async () => {
    const bad = structuredClone(solved);
    bad.faces.R[4] = 'white';
    const r = await solve(bad, { signal, baseUrl });
    expect(r).toMatchObject({ ok: false, error: { kind: 'api', code: 'DUPLICATE_CENTER', retryable: true } });
  });
});
