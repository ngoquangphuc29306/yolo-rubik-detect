import { describe, expect, it } from 'vitest';
import { parseApiErrorEnvelope, parseHealthResponse, parseSolveResponse } from '@/services/parsers';
import { bindSolveResponse } from '@/engine/solve-binding';
import { SOLVED, facesFromState } from '@/engine/cube-state';
import type { ApiErrorCode, ClientErrorCode, SolveError, SolveOutcome, SolveRequest, SolveResponse } from '@/types/api';
import type { FaceletState } from '@/types/cube';
import { SOLVED as REF_SOLVED, applySequence, toFacelets } from '../reference/cubie-reference';
import { loadFixture } from './fixtures';

type Obj = Record<string, unknown>;
const scrambleA = () => loadFixture<Obj>('solve/scramble-a.response.json');

function expectBad(json: unknown, parse: (j: unknown) => { ok: boolean }) {
  const r = parse(json) as { ok: boolean; error?: SolveError };
  expect(r.ok).toBe(false);
  expect(r.error).toMatchObject({ kind: 'client', code: 'BAD_RESPONSE' });
}

const invert = (moves: string[]) =>
  [...moves].reverse().map((t) => (t.endsWith('2') ? t : t.endsWith("'") ? t[0] : `${t}'`));

describe('parseSolveResponse', () => {
  it('accepts the solved and scrambled fixtures', () => {
    for (const f of ['solve/solved.response.json', 'solve/scramble-a.response.json']) {
      expect(parseSolveResponse(loadFixture(f)).ok).toBe(true);
    }
  });

  it('rejects non-objects', () => {
    for (const j of [null, undefined, 3, 'x', [], true]) expectBad(j, parseSolveResponse);
  });

  it('rejects wrong schemaVersion', () => {
    for (const v of [2, '1', undefined, 0]) expectBad({ ...scrambleA(), schemaVersion: v }, parseSolveResponse);
  });

  it('rejects missing keys', () => {
    for (const k of ['schemaVersion', 'centerColors', 'initialState', 'moves', 'moveCount']) {
      const j = scrambleA();
      delete j[k];
      expectBad(j, parseSolveResponse);
    }
  });

  it('rejects extra keys such as source', () => {
    expectBad({ ...scrambleA(), source: 'backend' }, parseSolveResponse);
    const j = scrambleA();
    (j.centerColors as Obj).X = 'red';
    expectBad(j, parseSolveResponse);
  });

  it('rejects wrong types', () => {
    expectBad({ ...scrambleA(), moveCount: '12' }, parseSolveResponse);
    expectBad({ ...scrambleA(), moves: 'R U' }, parseSolveResponse);
    expectBad({ ...scrambleA(), moves: [1, 2] }, parseSolveResponse);
    expectBad({ ...scrambleA(), initialState: 5 }, parseSolveResponse);
    expectBad({ ...scrambleA(), moveCount: 12.5 }, parseSolveResponse);
  });

  it('rejects unknown, duplicate and missing centre colours', () => {
    const unknown = scrambleA();
    (unknown.centerColors as Obj).U = 'purple';
    expectBad(unknown, parseSolveResponse);
    const dup = scrambleA();
    (dup.centerColors as Obj).U = 'red';
    expectBad(dup, parseSolveResponse);
    const missingFace = scrambleA();
    delete (missingFace.centerColors as Obj).B;
    expectBad(missingFace, parseSolveResponse);
  });

  it('rejects an invalid initialState', () => {
    for (const s of ['', 'U'.repeat(54), SOLVED.slice(1), SOLVED.replace('U', 'X'), SOLVED.toLowerCase()]) {
      expectBad({ ...scrambleA(), initialState: s }, parseSolveResponse);
    }
  });

  it('rejects illegal move tokens', () => {
    for (const t of ['x', "R2'", 'r', 'Rw', '', 'R3', 'toString']) {
      const j = scrambleA();
      (j.moves as string[])[0] = t;
      expectBad(j, parseSolveResponse);
    }
  });

  it('rejects moveCount that differs from moves.length', () => {
    expectBad({ ...scrambleA(), moveCount: 11 }, parseSolveResponse);
    expectBad({ ...loadFixture<Obj>('solve/solved.response.json'), moveCount: 1 }, parseSolveResponse);
  });

  it('keeps provenance outside the wire object (B5)', () => {
    const r = parseSolveResponse(loadFixture('solve/scramble-a.response.json'));
    if (!r.ok) throw new Error('fixture must parse');
    const outcome: SolveOutcome = { response: r.value, source: 'demo-fixture' };
    expect(Object.keys(outcome.response)).not.toContain('source');
    expect(parseSolveResponse(outcome.response).ok).toBe(true);
    expectBad({ ...outcome.response, source: outcome.source }, parseSolveResponse);
  });
});

describe('parseHealthResponse', () => {
  it('accepts every health fixture', () => {
    for (const f of ['ok', 'model-unavailable', 'fixture-mode']) {
      expect(parseHealthResponse(loadFixture(`health/${f}.json`)).ok).toBe(true);
    }
  });
  it('rejects bad health payloads', () => {
    const ok = () => loadFixture<Obj>('health/ok.json');
    expectBad(null, parseHealthResponse);
    expectBad({ ...ok(), schemaVersion: 2 }, parseHealthResponse);
    expectBad({ ...ok(), status: 'fine' }, parseHealthResponse);
    expectBad({ ...ok(), detectorMode: 'coco' }, parseHealthResponse);
    expectBad({ ...ok(), visionReady: 'yes' }, parseHealthResponse);
    expectBad({ ...ok(), extra: 1 }, parseHealthResponse);
    expectBad({ ...ok(), modelVersion: 3 }, parseHealthResponse);
    const missing = ok();
    delete missing.solverReady;
    expectBad(missing, parseHealthResponse);
  });
});

describe('parseApiErrorEnvelope', () => {
  it('accepts both error fixtures with server codes', () => {
    const a = parseApiErrorEnvelope(loadFixture('solve/invalid-cube-state.error.json'));
    const b = parseApiErrorEnvelope(loadFixture('solve/duplicate-center.error.json'));
    expect(a.ok && a.value.error.code).toBe('INVALID_CUBE_STATE');
    expect(b.ok && b.value.error.code).toBe('DUPLICATE_CENTER');
  });
  it('rejects client-only codes, unknown codes, extra keys and wrong types', () => {
    const env = (e: Obj) => ({ error: { code: 'INVALID_CUBE_STATE', message: 'm', retryable: true, ...e } });
    for (const code of ['NETWORK', 'BACKEND_UNAVAILABLE', 'BAD_RESPONSE', 'REQUEST_CANCELLED', 'NOPE']) {
      expectBad(env({ code }), parseApiErrorEnvelope);
    }
    expectBad(env({ extra: 1 }), parseApiErrorEnvelope);
    expectBad(env({ retryable: 'yes' }), parseApiErrorEnvelope);
    expectBad(env({ message: 3 }), parseApiErrorEnvelope);
    expectBad({ ...env({}), other: 1 }, parseApiErrorEnvelope);
    expectBad({}, parseApiErrorEnvelope);
  });
});

describe('error typing', () => {
  it('has exhaustive switches over server and client codes (compile-time)', () => {
    const api = (c: ApiErrorCode): number => {
      switch (c) {
        case 'INVALID_FACE_SHAPE': case 'DUPLICATE_CENTER': case 'COLOR_COUNT_MISMATCH': case 'INVALID_CUBE_STATE':
        case 'SOLVER_TIMEOUT': case 'MODEL_UNAVAILABLE': case 'FRAME_TOO_LARGE': case 'INVALID_FRAME':
          return 1;
        default: { const n: never = c; return n; }
      }
    };
    const client = (c: ClientErrorCode): number => {
      switch (c) {
        case 'NETWORK': case 'BACKEND_UNAVAILABLE': case 'BAD_RESPONSE': case 'RESPONSE_MISMATCH':
        case 'SOLUTION_REPLAY_MISMATCH': case 'REQUEST_CANCELLED': case 'REQUEST_INVALID':
          return 1;
        default: { const n: never = c; return n; }
      }
    };
    expect(api('INVALID_FRAME') + client('NETWORK')).toBe(2);
  });
});

describe('shared fixtures', () => {
  const asReq = (f: string) => loadFixture<SolveRequest>(f);
  const asRes = (f: string) => {
    const r = parseSolveResponse(loadFixture(f));
    if (!r.ok) throw new Error('fixture must parse');
    return r.value as SolveResponse;
  };

  it('scramble-a is bound to its request', () => {
    expect(bindSolveResponse(asReq('solve/scramble-a.request.json'), asRes('solve/scramble-a.response.json')).ok).toBe(true);
  });

  it('solved fixture binds with empty moves', () => {
    expect(bindSolveResponse(asReq('solve/solved.request.json'), asRes('solve/solved.response.json')).ok).toBe(true);
  });

  it('solved response does not bind to the scrambled request', () => {
    expect(bindSolveResponse(asReq('solve/scramble-a.request.json'), asRes('solve/solved.response.json')).ok).toBe(false);
  });

  it('the independent reference reproduces scramble-a initialState and replays its moves to solved', () => {
    const res = asRes('solve/scramble-a.response.json');
    expect(res.initialState).not.toBe(SOLVED);
    // scramble = inverse(solution), applied from solved by the reference
    const scrambled = applySequence(REF_SOLVED, invert(res.moves).join(' '));
    expect(toFacelets(scrambled)).toBe(res.initialState);
    expect(toFacelets(applySequence(scrambled, res.moves.join(' ')))).toBe(SOLVED);
    const faces = facesFromState(res.initialState as FaceletState, res.centerColors);
    expect(Object.fromEntries(Object.entries(faces).map(([k, v]) => [k, [...v]]))).toEqual(asReq('solve/scramble-a.request.json').faces);
  });
});
