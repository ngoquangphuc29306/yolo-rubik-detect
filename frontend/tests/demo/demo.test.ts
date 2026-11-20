import { describe, expect, it } from 'vitest';
import { generateScrambleSession } from '@/lib/cubeEngine';
import { SOLVED, facesFromState } from '@/engine/cube-state';
import { applyMove } from '@/engine/move-engine';
import { bindSolveResponse } from '@/engine/solve-binding';
import { parseSolveResponse } from '@/services/parsers';
import type { SolveRequest } from '@/types/api';
import type { MoveToken, SixFaces } from '@/types/cube';
import { DEMO_CENTER_COLORS, DEMO_SCRAMBLES, DEMO_SOURCE, demoFaces, demoInitialState } from '@/demo/demo-fixtures';
import { demoSolve } from '@/demo/demo-solver';
import { demoInvalidStateError } from '@/demo/demo-errors';
import { DEMO_SCAN_CONDITIONS } from '@/demo/demo-scan-source';

const req = (faces: SixFaces): SolveRequest => ({ schemaVersion: 1, faces: faces as unknown as SolveRequest['faces'] });
const solvedRequest = req(facesFromState(SOLVED, DEMO_CENTER_COLORS));
const demoRequests: [string, SolveRequest][] = [
  ...DEMO_SCRAMBLES.map((_, i): [string, SolveRequest] => [`demo ${i}`, req(demoFaces(i))]),
  ['solved', solvedRequest],
];

describe('demo fixtures', () => {
  it('scrambles equal the legacy presets and are frozen', () => {
    const legacy = [0, 1, 2].map((i) => generateScrambleSession(i));
    expect(DEMO_SCRAMBLES.map((s) => [...s])).toEqual(legacy.map((l) => l.scramble));
    // Pins the legacy preset count at 3 (index wraps modulo the preset count).
    expect(generateScrambleSession(3).scramble).toEqual(legacy[0].scramble);
    expect(DEMO_SCRAMBLES).toHaveLength(3);
    legacy.forEach((l, i) => {
      const inverse = [...DEMO_SCRAMBLES[i]].reverse().map((m) => (m.endsWith("'") ? m[0] : m.endsWith('2') ? m : `${m}'`));
      expect(inverse).toEqual(l.solution);
    });
    expect(Object.isFrozen(DEMO_SCRAMBLES)).toBe(true);
    DEMO_SCRAMBLES.forEach((s) => expect(Object.isFrozen(s)).toBe(true));
  });
  it('centres and source', () => {
    expect(DEMO_CENTER_COLORS).toEqual({ U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' });
    expect(DEMO_SOURCE).toBe('demo-fixture');
  });
  it('initial state is scramble applied to SOLVED and not solved', () => {
    const s = DEMO_SCRAMBLES[0].reduce((st, m) => applyMove(st, m), SOLVED);
    expect(demoInitialState(0)).toBe(s);
    expect(s).not.toBe(SOLVED);
  });
});

describe('demoSolve', () => {
  it.each(demoRequests)('%s: strict parse, bind ok, provenance only on wrapper', async (_n, request) => {
    const r = await demoSolve(request);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcome.source).toBe('demo-fixture');
    expect('source' in r.outcome.response).toBe(false);
    expect(parseSolveResponse(JSON.parse(JSON.stringify(r.outcome.response))).ok).toBe(true);
    expect(bindSolveResponse(request, r.outcome.response).ok).toBe(true);
  });
  it('solved cube has empty moves', async () => {
    const r = await demoSolve(solvedRequest);
    expect(r.ok && r.outcome.response.moves).toEqual([]);
  });
  it('rejects a valid non-demo cube without fabricating a solution', async () => {
    const other: MoveToken[] = ['R', 'U', 'F'];
    const state = other.reduce((st, m) => applyMove(st, m), SOLVED);
    const r = await demoSolve(req(facesFromState(state, DEMO_CENTER_COLORS)));
    expect(r).toEqual({
      ok: false,
      error: { kind: 'client', code: 'REQUEST_INVALID', message: 'Demo mode only solves its built-in demo cubes', retryable: false },
    });
  });
  it('rejects a demo cube shown with a different (consistent) centre colour mapping', async () => {
    const otherCenters = { U: 'yellow', D: 'white', R: 'orange', L: 'red', F: 'blue', B: 'green' } as const;
    const r = await demoSolve(req(facesFromState(demoInitialState(0), otherCenters)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ kind: 'client', code: 'REQUEST_INVALID' });
  });
  it.each<[string, () => unknown]>([
    ['empty faces', () => ({ schemaVersion: 1, faces: {} })],
    ['null request', () => null],
    ['8-entry face', () => {
      const r = JSON.parse(JSON.stringify(demoRequests[0][1])) as SolveRequest;
      r.faces.U = r.faces.U.slice(0, 8);
      return r;
    }],
  ])('rejects malformed request: %s', async (_n, make) => {
    const r = await demoSolve(make() as SolveRequest);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ kind: 'client', code: 'REQUEST_INVALID' });
  });
});

describe('demo errors and scan source', () => {
  it('invalid-state error shape', () => {
    expect(demoInvalidStateError()).toEqual({
      kind: 'api',
      code: 'INVALID_CUBE_STATE',
      message: 'The captured cube could not be validated. Check face orientation or scan again.',
      retryable: true,
    });
  });
  it('scan conditions keep values, label simulated AI/YOLO', () => {
    expect(DEMO_SCAN_CONDITIONS.map((c) => c.value)).toEqual([
      'ready', 'loading_model', 'permission_denied', 'no_cube', 'missing_stickers', 'wrong_face', 'unstable',
    ]);
    const lm = DEMO_SCAN_CONDITIONS.find((c) => c.value === 'loading_model')!;
    expect(lm.label.startsWith('Simulated: ')).toBe(true);
    expect(lm.hint.startsWith('Simulated: ')).toBe(true);
  });
});
