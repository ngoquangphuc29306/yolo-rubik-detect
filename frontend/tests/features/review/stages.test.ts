import { describe, expect, it } from 'vitest';
import { deriveReconstructionStages, describeSolveError, isValidationError } from '@/features/review/stages';
import type { CapturedFaces } from '@/stores/scan-store';
import type { SolutionData } from '@/stores/cube-store';
import type { SolveError } from '@/types/api';
import type { ColorName, FaceGrid, FaceId } from '@/types/cube';
import { SCAN_FACE_ORDER } from '@/types/cube';
import { demoFaces } from '@/demo/demo-fixtures';

const full = (): CapturedFaces => {
  const f = demoFaces(0);
  const out: CapturedFaces = {};
  for (const k of SCAN_FACE_ORDER) out[k] = { grid: f[k], source: 'demo' };
  return out;
};
const without = (face: FaceId): CapturedFaces => {
  const c = full();
  delete c[face];
  return c;
};
const withCell = (c: CapturedFaces, face: FaceId, index: number, color: ColorName): CapturedFaces => {
  const g = [...c[face]!.grid] as ColorName[];
  g[index] = color;
  return { ...c, [face]: { grid: g as unknown as FaceGrid, source: 'demo' } };
};
const sol = (n: number) => ({ moves: new Array(n).fill('R') }) as unknown as SolutionData;
const apiErr = (code: Extract<SolveError, { kind: 'api' }>['code']): SolveError => ({
  kind: 'api',
  code,
  message: 'msg',
  retryable: true,
});
const clientErr = (code: Extract<SolveError, { kind: 'client' }>['code']): SolveError => ({
  kind: 'client',
  code,
  message: 'msg',
  retryable: false,
});
const idle = { status: 'idle' as const, error: null, solution: null };
const states = (s: ReturnType<typeof deriveReconstructionStages>) => s.map((x) => x.state);

describe('deriveReconstructionStages', () => {
  it('returns six stages with stable ids', () => {
    const s = deriveReconstructionStages({ captured: full(), mode: 'demo', cube: idle });
    expect(s.map((x) => x.id)).toEqual(['faces', 'colors', 'centers', 'validated', 'solution-match', 'replay']);
  });

  it('five faces: stage 1 failed with the count, everything later pending (never filled)', () => {
    const s = deriveReconstructionStages({ captured: without('B'), mode: 'demo', cube: idle });
    expect(states(s)).toEqual(['failed', 'pending', 'pending', 'pending', 'pending', 'pending']);
    expect(s[0].detail).toBe('5 of 6');
  });

  it('idle with all faces: stages 1-3 passed, stage 4 active, rest pending', () => {
    const s = deriveReconstructionStages({ captured: full(), mode: 'demo', cube: idle });
    expect(states(s)).toEqual(['passed', 'passed', 'passed', 'active', 'pending', 'pending']);
  });

  it('solving: server validation is not yet claimed', () => {
    const s = deriveReconstructionStages({
      captured: full(),
      mode: 'live',
      cube: { status: 'solving', error: null, solution: null },
    });
    expect(states(s)).toEqual(['passed', 'passed', 'passed', 'active', 'pending', 'pending']);
  });

  it('ready: all six passed with a move count', () => {
    const s = deriveReconstructionStages({
      captured: full(),
      mode: 'live',
      cube: { status: 'ready', error: null, solution: sol(18) },
    });
    expect(states(s)).toEqual(['passed', 'passed', 'passed', 'passed', 'passed', 'passed']);
    expect(s[5].detail).toBe('18 moves');
  });

  it('ready with an empty solution says Already solved', () => {
    const s = deriveReconstructionStages({
      captured: full(),
      mode: 'live',
      cube: { status: 'ready', error: null, solution: sol(0) },
    });
    expect(s[5].detail).toBe('Already solved');
  });

  it('colour count mismatch fails stage 2; later pending', () => {
    // Flip a non-centre sticker: 10 of one colour, 8 of another, six distinct centres kept.
    const c = withCell(full(), 'U', 0, demoFaces(0).U[0] === 'red' ? 'orange' : 'red');
    const s = deriveReconstructionStages({ captured: c, mode: 'demo', cube: idle });
    expect(states(s)).toEqual(['passed', 'failed', 'pending', 'pending', 'pending', 'pending']);
  });

  it('duplicate centres fail stage 3 (counts still 9 each)', () => {
    // U centre becomes green (as F); one green non-centre sticker becomes white: counts stay 9/9.
    const base = full();
    const white = base.U!.grid[4];
    const green = base.F!.grid[4];
    let c = withCell(base, 'U', 4, green);
    const face = SCAN_FACE_ORDER.find((f) => f !== 'U' && base[f]!.grid.some((x, i) => i !== 4 && x === green))!;
    const idx = base[face]!.grid.findIndex((x, i) => i !== 4 && x === green);
    c = withCell(c, face, idx, white);
    const s = deriveReconstructionStages({ captured: c, mode: 'demo', cube: idle });
    expect(states(s)).toEqual(['passed', 'passed', 'failed', 'pending', 'pending', 'pending']);
  });

  it.each(['INVALID_CUBE_STATE', 'COLOR_COUNT_MISMATCH', 'DUPLICATE_CENTER', 'INVALID_FACE_SHAPE'] as const)(
    'server %s fails stage 4; 5 and 6 pending',
    (code) => {
      const e = apiErr(code);
      const s = deriveReconstructionStages({
        captured: full(),
        mode: 'live',
        cube: { status: 'error', error: e, solution: null },
      });
      expect(states(s)).toEqual(['passed', 'passed', 'passed', 'failed', 'pending', 'pending']);
      expect(isValidationError(e)).toBe(true);
    },
  );

  it.each(['BACKEND_UNAVAILABLE', 'NETWORK', 'BAD_RESPONSE', 'REQUEST_INVALID'] as const)(
    'client %s fails stage 4 (not validated) and is not a validation error',
    (code) => {
      const e = clientErr(code);
      const s = deriveReconstructionStages({
        captured: full(),
        mode: 'live',
        cube: { status: 'error', error: e, solution: null },
      });
      expect(states(s)).toEqual(['passed', 'passed', 'passed', 'failed', 'pending', 'pending']);
      expect(isValidationError(e)).toBe(false);
    },
  );

  it('SOLVER_TIMEOUT fails stage 4 and is not a validation error', () => {
    const e = apiErr('SOLVER_TIMEOUT');
    const s = deriveReconstructionStages({
      captured: full(),
      mode: 'live',
      cube: { status: 'error', error: e, solution: null },
    });
    expect(s[3].state).toBe('failed');
    expect(isValidationError(e)).toBe(false);
  });

  it('RESPONSE_MISMATCH: 4 passed, 5 failed, 6 pending', () => {
    const s = deriveReconstructionStages({
      captured: full(),
      mode: 'live',
      cube: { status: 'error', error: clientErr('RESPONSE_MISMATCH'), solution: null },
    });
    expect(states(s)).toEqual(['passed', 'passed', 'passed', 'passed', 'failed', 'pending']);
  });

  it('SOLUTION_REPLAY_MISMATCH: 4 and 5 passed, 6 failed', () => {
    const s = deriveReconstructionStages({
      captured: full(),
      mode: 'live',
      cube: { status: 'error', error: clientErr('SOLUTION_REPLAY_MISMATCH'), solution: null },
    });
    expect(states(s)).toEqual(['passed', 'passed', 'passed', 'passed', 'passed', 'failed']);
  });

  it('REQUEST_CANCELLED is not a failure', () => {
    const s = deriveReconstructionStages({
      captured: full(),
      mode: 'live',
      cube: { status: 'error', error: clientErr('REQUEST_CANCELLED'), solution: null },
    });
    expect(states(s)).toEqual(['passed', 'passed', 'passed', 'active', 'pending', 'pending']);
  });

  it('an earlier frontend failure wins over a later cube error', () => {
    const s = deriveReconstructionStages({
      captured: without('U'),
      mode: 'live',
      cube: { status: 'error', error: clientErr('BACKEND_UNAVAILABLE'), solution: null },
    });
    expect(states(s)).toEqual(['failed', 'pending', 'pending', 'pending', 'pending', 'pending']);
  });

  it('demo wording is labelled as demo; no mode ever says Kociemba', () => {
    for (const mode of ['demo', 'live', null] as const) {
      const s = deriveReconstructionStages({
        captured: full(),
        mode,
        cube: { status: 'ready', error: null, solution: sol(3) },
      });
      expect(JSON.stringify(s)).not.toMatch(/kociemba/i);
    }
    const demo = deriveReconstructionStages({
      captured: full(),
      mode: 'demo',
      cube: { status: 'ready', error: null, solution: sol(3) },
    });
    expect(demo[3].detail).toBe('Demo fixture');
    expect(demo[4].detail).toBe('Demo fixture');
    expect(demo[4].label).toMatch(/Demo solution \(pre-computed\)/);
    const live = deriveReconstructionStages({
      captured: full(),
      mode: 'live',
      cube: { status: 'ready', error: null, solution: sol(3) },
    });
    expect(live[3].detail).toBeUndefined();
    expect(live[4].label).toBe('Solution received and matches your scan');
  });
});

describe('describeSolveError', () => {
  it('maps client codes to short human text', () => {
    expect(describeSolveError(clientErr('RESPONSE_MISMATCH'))).toBe('The solver answered for a different cube');
    expect(describeSolveError(clientErr('SOLUTION_REPLAY_MISMATCH'))).toBe('The solution did not solve your cube');
    expect(describeSolveError(clientErr('BACKEND_UNAVAILABLE'))).toBe('Solver service is not running');
    expect(describeSolveError(clientErr('REQUEST_CANCELLED'))).toBe('');
  });
  it('uses the server message verbatim for api errors', () => {
    const e: SolveError = { kind: 'api', code: 'INVALID_CUBE_STATE', message: 'Hello <b>x</b>', retryable: true };
    expect(describeSolveError(e)).toBe('Hello <b>x</b>');
  });
});
