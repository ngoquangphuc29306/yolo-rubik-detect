import { describe, expect, it } from 'vitest';
import { bindSolveResponse } from '@/engine/solve-binding';
import { SOLVED, facesFromState } from '@/engine/cube-state';
import type { SolveRequest, SolveResponse } from '@/types/api';
import type { CenterColors, ColorName, FaceId, FaceletState } from '@/types/cube';
import { SOLVED as REF_SOLVED, applySequence, toFacelets } from '../reference/cubie-reference';

const DEMO: CenterColors = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
// Rotated colour scheme (non-demo): any six distinct colours.
const ROTATED: CenterColors = { U: 'blue', R: 'orange', F: 'red', D: 'green', L: 'yellow', B: 'white' };

const SCRAMBLE = "R U R' U' F2 D L' B2 U2 R2 F' D'";
const INVERSE = SCRAMBLE.split(' ').reverse().map((t) =>
  t.endsWith('2') ? t : t.endsWith("'") ? t[0] : `${t}'`,
);
// Scrambled state from the independent reference, not from the engine under test.
const SCRAMBLED = toFacelets(applySequence(REF_SOLVED, SCRAMBLE)) as FaceletState;
// Sanity: the reference itself replays the inverse to solved.
const refSolved = toFacelets(applySequence(applySequence(REF_SOLVED, SCRAMBLE), INVERSE.join(' ')));

function requestFor(state: FaceletState, centers: CenterColors): SolveRequest {
  const faces = facesFromState(state, centers);
  const out = {} as Record<FaceId, ColorName[]>;
  for (const f of Object.keys(faces) as FaceId[]) out[f] = [...faces[f]];
  return { schemaVersion: 1, faces: out };
}
const responseFor = (state: string, centers: CenterColors, moves: string[]): SolveResponse => ({
  schemaVersion: 1,
  centerColors: centers,
  initialState: state,
  moves,
  moveCount: moves.length,
});

describe('bindSolveResponse', () => {
  it('fixture sanity: reference replays inverse scramble to solved', () => {
    expect(refSolved).toBe(SOLVED);
    expect(SCRAMBLED).not.toBe(SOLVED);
  });

  it('(a) genuine scrambled request + response binds ok', () => {
    const r = bindSolveResponse(requestFor(SCRAMBLED, DEMO), responseFor(SCRAMBLED, DEMO, INVERSE));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state).toBe(SCRAMBLED);
    expect(r.centers).toEqual(DEMO);
    expect(r.moves).toEqual(INVERSE);
    expect(r.snapshots).toHaveLength(INVERSE.length + 1);
    expect(r.snapshots[0]).toBe(SCRAMBLED);
    expect(r.snapshots[r.snapshots.length - 1]).toBe(SOLVED);
  });

  it('(b) valid-but-wrong: solved-cube response to a scrambled request is RESPONSE_MISMATCH', () => {
    const r = bindSolveResponse(requestFor(SCRAMBLED, DEMO), responseFor(SOLVED, DEMO, []));
    expect(r).toMatchObject({ ok: false, code: 'RESPONSE_MISMATCH' });
  });

  it('(c) centerColors differing from the request (U/D swapped) is RESPONSE_MISMATCH', () => {
    const swapped: CenterColors = { ...DEMO, U: 'yellow', D: 'white' };
    const r = bindSolveResponse(requestFor(SCRAMBLED, DEMO), responseFor(SCRAMBLED, swapped, INVERSE));
    expect(r).toMatchObject({ ok: false, code: 'RESPONSE_MISMATCH' });
  });

  it('(d) moveCount !== moves.length is RESPONSE_MISMATCH', () => {
    const resp = { ...responseFor(SCRAMBLED, DEMO, INVERSE), moveCount: INVERSE.length + 1 };
    expect(bindSolveResponse(requestFor(SCRAMBLED, DEMO), resp)).toMatchObject({
      ok: false,
      code: 'RESPONSE_MISMATCH',
    });
  });

  it('(e) correct state with a wrong move list is SOLUTION_REPLAY_MISMATCH', () => {
    const r = bindSolveResponse(requestFor(SCRAMBLED, DEMO), responseFor(SCRAMBLED, DEMO, INVERSE.slice(0, -1)));
    expect(r).toMatchObject({ ok: false, code: 'SOLUTION_REPLAY_MISMATCH' });
  });

  it('(f) solved request + empty moves is ok with one snapshot', () => {
    const r = bindSolveResponse(requestFor(SOLVED, DEMO), responseFor(SOLVED, DEMO, []));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.snapshots).toHaveLength(1);
      expect(r.moves).toEqual([]);
    }
  });

  it('(g) scrambled request + empty moves is SOLUTION_REPLAY_MISMATCH', () => {
    const r = bindSolveResponse(requestFor(SCRAMBLED, DEMO), responseFor(SCRAMBLED, DEMO, []));
    expect(r).toMatchObject({ ok: false, code: 'SOLUTION_REPLAY_MISMATCH' });
  });

  it('missing face is REQUEST_INVALID and does not throw', () => {
    const req = requestFor(SCRAMBLED, DEMO);
    delete (req.faces as Partial<Record<FaceId, ColorName[]>>).U;
    const r = bindSolveResponse(req, responseFor(SCRAMBLED, DEMO, INVERSE));
    expect(r).toMatchObject({ ok: false, code: 'REQUEST_INVALID' });
  });

  it('duplicate centre colour is REQUEST_INVALID and does not throw', () => {
    const req = requestFor(SCRAMBLED, DEMO);
    req.faces.D[4] = 'white';
    const r = bindSolveResponse(req, responseFor(SCRAMBLED, DEMO, INVERSE));
    expect(r).toMatchObject({ ok: false, code: 'REQUEST_INVALID' });
  });

  it('illegal move token is SOLUTION_REPLAY_MISMATCH and does not throw', () => {
    for (const bad of ['x', 'toString', '__proto__', 'U3', '']) {
      const r = bindSolveResponse(requestFor(SOLVED, DEMO), responseFor(SOLVED, DEMO, [bad]));
      expect(r, bad).toMatchObject({ ok: false, code: 'SOLUTION_REPLAY_MISMATCH' });
    }
  });

  it('non-demo centre mapping binds ok when consistent', () => {
    const r = bindSolveResponse(requestFor(SCRAMBLED, ROTATED), responseFor(SCRAMBLED, ROTATED, INVERSE));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.centers).toEqual(ROTATED);
  });

  it('non-demo request with demo-centre response is RESPONSE_MISMATCH', () => {
    const r = bindSolveResponse(requestFor(SCRAMBLED, ROTATED), responseFor(SCRAMBLED, DEMO, INVERSE));
    expect(r).toMatchObject({ ok: false, code: 'RESPONSE_MISMATCH' });
  });
});
