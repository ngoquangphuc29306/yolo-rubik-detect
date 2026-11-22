// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SolveError, SolveRequest } from '@/types/api';
import type { SolveResult } from '@/services/solver-client';

const cube = vi.hoisted(() => ({ props: null as null | Record<string, any> }));
vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return {
    RubiksCube3D: (props: Record<string, any>) => {
      cube.props = props;
      return React.createElement('div', { 'data-testid': 'cube-stub' });
    },
  };
});
const gate = vi.hoisted(() => ({ hold: null as null | Promise<void>, calls: 0 }));
vi.mock('@/demo/demo-solver', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/demo/demo-solver')>();
  return { ...orig, demoSolve: (r: SolveRequest) => (gate.calls++, gate.hold ? gate.hold.then(() => orig.demoSolve(r)) : orig.demoSolve(r)) };
});
const backend = vi.hoisted(() => ({ solve: vi.fn() }));
vi.mock('@/services/solver-client', () => ({ solve: backend.solve }));

import { ReconstructionScreen } from '@/features/review/ReconstructionScreen';
import { demoSolve } from '@/demo/demo-solver';
import { DEMO_CENTER_COLORS, demoFaces } from '@/demo/demo-fixtures';
import { SOLVED, facesFromState } from '@/engine/cube-state';
import { toCubies } from '@/engine/cubie-adapter';
import { useCubeStore } from '@/stores/cube-store';
import { demoInvalidStateError } from '@/demo/demo-errors';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { SCAN_FACE_ORDER, type FaceGrid, type FaceId, type SixFaces } from '@/types/cube';
import { parseSolveResponse } from '@/services/parsers';
import { loadFixture } from '../services/fixtures';

const STEP = 340;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function capture(mode: 'demo' | 'live', faces: SixFaces = demoFaces(0), skip: FaceId[] = []) {
  act(() => {
    useSessionStore.getState().startSession(mode, 'reconstructing');
    for (const f of SCAN_FACE_ORDER) {
      if (!skip.includes(f)) useScanStore.getState().captureFace(f, faces[f], mode);
    }
  });
}
const stage = (id: string) => screen.getByTestId(`stage-${id}`).getAttribute('data-state');
const stageStates = () =>
  ['faces', 'colors', 'centers', 'validated', 'solution-match', 'replay'].map(stage);
const summary = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const netValidated = () => SCAN_FACE_ORDER.map((f) => screen.getByTestId(`net-face-${f}`).getAttribute('data-validated'));
const statusText = () => screen.getByRole('status').textContent;
const prepare = () => screen.getByRole('button', { name: /Prepare to Solve/ }) as HTMLButtonElement;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const unavailable: SolveError = {
  kind: 'client',
  code: 'BACKEND_UNAVAILABLE',
  message: 'connection refused',
  retryable: true,
};
const goodBackend = async (request: SolveRequest): Promise<SolveResult> => {
  const r = await demoSolve(request);
  if (!r.ok) throw new Error('fixture');
  return { ok: true, outcome: { response: r.outcome.response, source: 'backend' } };
};

beforeEach(() => {
  vi.useFakeTimers();
  cube.props = null;
  gate.hold = null;
  gate.calls = 0;
  backend.solve.mockReset();
  backend.solve.mockImplementation(() => { throw new Error('backend must not be called'); });
  useSessionStore.getState().startSession('demo', 'reconstructing');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ReconstructionScreen - demo happy path', () => {
  it('shows real faces, validates with a stagger, and enables Prepare only when complete', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    expect(useCubeStore.getState().status).toBe('ready');
    expect(prepare().disabled).toBe(true);
    await advance(STEP * 6);
    expect(stageStates()).toEqual(['passed', 'passed', 'passed', 'passed', 'passed', 'passed']);
    expect(prepare().disabled).toBe(false);
    expect(summary('Captured Faces')).toBe('6/6');
    expect(summary('Captured Stickers')).toBe('54/54');
    expect(summary('Cube State')).toBe('Valid');
    const moves = useCubeStore.getState().solution!.moves.length;
    expect(summary('Demo Solution')).toBe(`${moves} moves · demo, pre-computed`);
    expect(document.body.textContent).not.toMatch(/kociemba/i);
    expect(document.body.textContent).not.toMatch(/Detected Stickers/);
  });

  it('net faces come from the scan store, in the captured colours', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    for (const f of SCAN_FACE_ORDER) expect(screen.getByTestId(`net-face-${f}`).getAttribute('data-state')).toBe('captured');
  });

  it('3D twin shows toCubies of the verified solution state', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    fireEvent.click(screen.getByRole('button', { name: '3D Twin' }));
    const s = useCubeStore.getState().solution!;
    expect(cube.props?.cubies).toEqual(toCubies(s.state, s.centers));
    expect(cube.props?.mode).toBe('interactive');
  });

  it('Prepare to Solve goes to alignment', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    fireEvent.click(prepare());
    expect(useSessionStore.getState().screen).toBe('alignment');
  });

  it('starts the solve once even when a solve is already in flight (bridge race)', async () => {
    capture('demo');
    act(() => useCubeStore.getState().beginSolve());
    render(<ReconstructionScreen />);
    await flush();
    expect(useCubeStore.getState().status).toBe('solving'); // screen did not start a second solve
    expect(summary('Demo Solution')).toBe('Computing…');
  });

  it('Rescan in demo starts a fresh demo scan', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Rescan' }));
    expect(useSessionStore.getState().screen).toBe('scanning');
    expect(useSessionStore.getState().mode).toBe('demo');
    expect(useScanStore.getState().captured).toEqual({});
  });
});

describe('ReconstructionScreen - incomplete scan', () => {
  it('5 of 6 faces: reports incomplete, never fills, offers Back to scan', async () => {
    capture('demo', demoFaces(0), ['B']);
    render(<ReconstructionScreen />);
    await flush();
    expect(screen.getByText('Scan incomplete — 5 of 6 faces captured')).toBeTruthy();
    expect(screen.getByTestId('net-face-B').getAttribute('data-state')).toBe('missing');
    expect(screen.queryByRole('button', { name: /Prepare to Solve/ })).toBeNull();
    expect(screen.getByTestId('checks-count').textContent).toBe('5/6 faces');
    expect(statusText()).toBe('Scan incomplete');
    expect(useCubeStore.getState().status).toBe('idle'); // no solve started
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(5);
    await advance(STEP * 8);
    expect(stage('faces')).toBe('failed');
    expect(stageStates().slice(1)).toEqual(['pending', 'pending', 'pending', 'pending', 'pending']);
    fireEvent.click(screen.getByRole('button', { name: 'Back to scan' }));
    expect(useSessionStore.getState().screen).toBe('scanning');
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(5);
  });

  it('zero faces captured is reported as 0 of 6', async () => {
    capture('demo', demoFaces(0), [...SCAN_FACE_ORDER]);
    render(<ReconstructionScreen />);
    await flush();
    expect(screen.getByText('Scan incomplete — 0 of 6 faces captured')).toBeTruthy();
  });
});

describe('ReconstructionScreen - stagger is presentation only', () => {
  it('with the solve already ready, stage k is not passed before its tick', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    expect(stageStates().filter((s) => s === 'passed')).toHaveLength(0);
    for (let k = 1; k <= 6; k++) {
      await advance(STEP - 1);
      expect(stageStates().filter((s) => s === 'passed')).toHaveLength(k - 1);
      await advance(1);
      expect(stageStates().filter((s) => s === 'passed')).toHaveLength(k);
    }
  });

  it('with the solve not ready, no stage beyond the real state is ever passed', async () => {
    capture('live');
    const d = deferred<SolveResult>();
    backend.solve.mockReturnValue(d.promise);
    render(<ReconstructionScreen />);
    await flush();
    expect(useCubeStore.getState().status).toBe('solving');
    await advance(STEP * 10);
    expect(stageStates()).toEqual(['passed', 'passed', 'passed', 'active', 'pending', 'pending']);
    expect(prepare().disabled).toBe(true);
    expect(summary('Cube State')).toBe('Validating…');
    expect(summary('Solution')).toBe('Computing…');
  });

  it('a result that arrives late is revealed immediately once the stagger has finished', async () => {
    capture('live');
    const d = deferred<SolveResult>();
    backend.solve.mockReturnValue(d.promise);
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 10);
    const request = backend.solve.mock.calls[0][0] as SolveRequest;
    d.resolve(await goodBackend(request));
    await flush();
    expect(stageStates()).toEqual(['passed', 'passed', 'passed', 'passed', 'passed', 'passed']);
    expect(prepare().disabled).toBe(false);
  });

  it('clears its timers on unmount', async () => {
    capture('demo');
    const { unmount } = render(<ReconstructionScreen />);
    await flush();
    await advance(STEP);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('ReconstructionScreen - demo invalid state test', () => {
  it('shows the real error message, fails stage 4, offers Restart Full Scan and Restore', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    fireEvent.click(screen.getByRole('button', { name: 'Test Invalid Cube State' }));
    await flush();
    await advance(STEP * 6);
    expect(useCubeStore.getState().status).toBe('error');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('The captured cube could not be validated. Check face orientation or scan again.');
    expect(stageStates()).toEqual(['passed', 'passed', 'passed', 'failed', 'pending', 'pending']);
    expect(within(alert).getByRole('button', { name: 'Restart Full Scan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rescan .*Face/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Parity check failed/);
    expect(document.body.textContent).not.toMatch(/10 red stickers/);
    expect(screen.queryByRole('button', { name: /Prepare to Solve/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Restore Valid State' }));
    await flush();
    await advance(STEP * 6);
    expect(useCubeStore.getState().status).toBe('ready');
    expect(stageStates()).toEqual(['passed', 'passed', 'passed', 'passed', 'passed', 'passed']);
    expect(prepare().disabled).toBe(false);
  });

  it('Test Invalid during a REAL in-flight solve is not overwritten by the late result', async () => {
    let release!: () => void;
    gate.hold = new Promise<void>((r) => { release = r; });
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    expect(useCubeStore.getState().status).toBe('solving'); // started by the screen through runSolve
    fireEvent.click(screen.getByRole('button', { name: 'Test Invalid Cube State' }));
    expect(useCubeStore.getState().status).toBe('error');
    release();
    await flush();
    await flush();
    expect(useCubeStore.getState().status).toBe('error');
    expect(useCubeStore.getState().error).toMatchObject({ kind: 'api', code: 'INVALID_CUBE_STATE' });
    expect(useCubeStore.getState().solution).toBeNull();
  });

  it('Restart Full Scan starts a fresh demo scan', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Test Invalid Cube State' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart Full Scan' }));
    expect(useSessionStore.getState().screen).toBe('scanning');
    expect(useScanStore.getState().captured).toEqual({});
  });
});

describe('ReconstructionScreen - live mode', () => {
  it('has no Test Invalid button and Rescan starts a live scan', async () => {
    capture('live');
    backend.solve.mockImplementation(goodBackend);
    render(<ReconstructionScreen />);
    await flush();
    expect(screen.queryByRole('button', { name: /Test Invalid Cube State/ })).toBeNull();
    expect(summary('Solution')).toBeDefined();
    expect(document.body.textContent).not.toMatch(/demo/i);
    useSessionStore.setState({ demoSeed: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Rescan' }));
    expect(useSessionStore.getState().mode).toBe('live');
    expect(useSessionStore.getState().demoSeed).toBe(1);
    expect(useScanStore.getState().captured).toEqual({});
    expect(useSessionStore.getState().screen).toBe('scanning');
  });

  it('backend unavailable: message, retryable Try again, no demo fallback', async () => {
    capture('live');
    backend.solve.mockResolvedValue({ ok: false, error: unavailable });
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    expect(useCubeStore.getState().status).toBe('error');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Solver service is not running');
    expect(stageStates()).toEqual(['passed', 'passed', 'passed', 'failed', 'pending', 'pending']);
    expect(prepare).toThrow(); // Prepare to Solve is not offered at all
    expect(statusText()).toBe('Not validated');
    expect(useCubeStore.getState().solution).toBeNull();

    backend.solve.mockImplementation(goodBackend);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await flush();
    expect(backend.solve).toHaveBeenCalledTimes(2);
    expect(useCubeStore.getState().status).toBe('ready');
    expect(useCubeStore.getState().solution?.source).toBe('backend');
  });

  it('retry sends a new request and a late response from the first is ignored', async () => {
    capture('live');
    const first = deferred<SolveResult>();
    backend.solve.mockReturnValueOnce(first.promise);
    render(<ReconstructionScreen />);
    await flush();
    const firstRequest = backend.solve.mock.calls[0][0] as SolveRequest;
    // First attempt is still pending; an error becomes visible (e.g. the user hits retry after a failure).
    act(() => useCubeStore.getState().setError(unavailable));
    backend.solve.mockResolvedValueOnce({ ok: false, error: unavailable });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await flush();
    expect(backend.solve).toHaveBeenCalledTimes(2);
    expect(backend.solve.mock.calls[1][0]).not.toBe(firstRequest);
    expect(useCubeStore.getState().status).toBe('error');
    first.resolve(await goodBackend(firstRequest)); // late success from the superseded attempt
    await flush();
    expect(useCubeStore.getState().status).toBe('error');
    expect(useCubeStore.getState().solution).toBeNull();
  });

  it('a valid-looking but wrong backend response is a mismatch and never enables Prepare', async () => {
    capture('live');
    const parsed = parseSolveResponse(loadFixture('solve/solved.response.json'));
    if (!parsed.ok) throw new Error('fixture');
    backend.solve.mockResolvedValue({ ok: true, outcome: { response: parsed.value, source: 'backend' } });
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    expect(screen.getByRole('alert').textContent).toContain('The solver answered for a different cube');
    expect(stageStates()).toEqual(['passed', 'passed', 'passed', 'failed', 'pending', 'pending']);
    expect(screen.queryByRole('button', { name: /Prepare to Solve/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull(); // not retryable
  });

  it('error strings render as plain text', async () => {
    capture('live');
    backend.solve.mockResolvedValue({
      ok: false,
      error: { kind: 'api', code: 'INVALID_CUBE_STATE', message: '<img src=x onerror=alert(1)>', retryable: false },
    });
    render(<ReconstructionScreen />);
    await flush();
    expect(screen.getByRole('alert').textContent).toContain('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});

describe('ReconstructionScreen - already solved', () => {
  it('ready with zero moves shows Already solved and Prepare goes to alignment', async () => {
    capture('demo', facesFromState(SOLVED, DEMO_CENTER_COLORS));
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    expect(useCubeStore.getState().solution?.moves).toEqual([]);
    expect(screen.getByTestId('already-solved-note').textContent).toMatch(/Already solved/);
    expect(prepare().disabled).toBe(false);
    fireEvent.click(prepare());
    expect(useSessionStore.getState().screen).toBe('alignment');
  });
});

describe('ReconstructionScreen - accessibility', () => {
  it('announces check progress in a status region and errors in an alert', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 2);
    expect(screen.getByTestId('checks-count').textContent).toBe('2/6 checks');
    expect(statusText()).toBe(''); // per-tick progress is not announced
    await advance(STEP * 4);
    expect(statusText()).toMatch(/complete/i);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Test Invalid Cube State' }));
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('ReconstructionScreen - net styling', () => {
  it('net faces turn green only once stage 4 is revealed as passed', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 3);
    expect(netValidated()).toEqual(Array(6).fill('false'));
    await advance(STEP);
    expect(netValidated()).toEqual(Array(6).fill('true'));
  });

  it('after the demo invalid test no face is green', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    fireEvent.click(screen.getByRole('button', { name: 'Test Invalid Cube State' }));
    expect(netValidated()).toEqual(Array(6).fill('false'));
    await advance(STEP * 6);
    expect(stage('validated')).toBe('failed');
    expect(netValidated()).toEqual(Array(6).fill('false'));
  });
});

describe('ReconstructionScreen - twin only when complete', () => {
  it('no Digital Twin Ready heading or 3D tab until the stagger finished', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 5);
    expect(screen.queryByRole('button', { name: '3D Twin' })).toBeNull();
    expect(screen.queryByText('Digital Twin Ready')).toBeNull();
    expect(cube.props).toBeNull();
    await advance(STEP);
    expect(screen.getByText('Digital Twin Ready')).toBeTruthy();
    expect(screen.getByRole('button', { name: '3D Twin' })).toBeTruthy();
  });
});

describe('ReconstructionScreen - malformed six-face scans never dead-end', () => {
  type Faces = Record<FaceId, readonly string[]>;
  const base = (): Faces => ({ ...demoFaces(0) });
  const load = (faces: Faces) => {
    act(() => {
      useSessionStore.getState().startSession('demo', 'reconstructing');
      const captured: Record<string, { grid: FaceGrid; source: 'demo' }> = {};
      for (const f of SCAN_FACE_ORDER) captured[f] = { grid: faces[f] as unknown as FaceGrid, source: 'demo' };
      useScanStore.setState({ captured });
    });
  };
  const edit = (f: Faces, face: FaceId, i: number, c: string): Faces => {
    const g = [...f[face]];
    g[i] = c;
    return { ...f, [face]: g };
  };
  const cases: [string, () => Faces, RegExp][] = [
    ['colour counts 10 and 8', () => edit(base(), 'U', 0, 'red'), /red appears 10 times/],
    [
      'duplicate centres',
      () => {
        const b = base();
        const green = b.F[4];
        const face = SCAN_FACE_ORDER.find((x) => x !== 'U' && b[x].some((c, i) => i !== 4 && c === green))!;
        const idx = b[face].findIndex((c, i) => i !== 4 && c === green);
        return edit(edit(b, 'U', 4, green), face, idx, b.U[4]);
      },
      /share a center color/,
    ],
    ['an unknown colour', () => edit(base(), 'U', 0, 'purple'), /Unknown color: purple/],
  ];

  it.each(cases)('%s: alert with detail, recovery buttons, no waiting, no solve', async (_n, make, detail) => {
    load(make());
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 8);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(detail);
    expect(within(alert).getByRole('button', { name: 'Back to scan' })).toBeTruthy();
    expect(within(alert).getByRole('button', { name: 'Restart Full Scan' })).toBeTruthy();
    expect(alert.textContent).toContain('Not validated');
    expect(screen.getByText('Validation Failed')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Validating…|Computing…|Assembling/);
    expect(screen.queryByRole('button', { name: /Prepare to Solve/ })).toBeNull();
    expect(useCubeStore.getState().status).toBe('idle');
    expect(backend.solve).not.toHaveBeenCalled();
    expect(netValidated()).toEqual(Array(6).fill('false'));
    fireEvent.click(within(alert).getByRole('button', { name: 'Back to scan' }));
    expect(useSessionStore.getState().screen).toBe('scanning');
  });
});

describe('ReconstructionScreen - malformed scans are never re-sent (R30)', () => {
  type Faces = Record<FaceId, readonly string[]>;
  const malformed = (): Faces => {
    const f: Faces = { ...demoFaces(0) };
    const g = [...f.U];
    g[0] = 'red';
    return { ...f, U: g };
  };
  const setCaptured = (faces: Faces) =>
    act(() => {
      const captured: Record<string, { grid: FaceGrid; source: 'demo' }> = {};
      for (const f of SCAN_FACE_ORDER) captured[f] = { grid: faces[f] as unknown as FaceGrid, source: 'demo' };
      useScanStore.setState({ captured });
    });
  const reactProps = (el: Element) => {
    const key = Object.keys(el).find((k) => k.startsWith('__reactProps'))!;
    return (el as unknown as Record<string, { onClick: () => void }>)[key];
  };

  it('Test Invalid is disabled (with a reason) for a malformed scan and nothing reaches a solver', async () => {
    act(() => useSessionStore.getState().startSession('demo', 'reconstructing'));
    setCaptured(malformed());
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 8);
    const btn = screen.getByRole('button', { name: 'Test Invalid Cube State' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toMatch(/valid/i);
    expect(gate.calls).toBe(0);
    expect(backend.solve).not.toHaveBeenCalled();
  });

  it('the restore/retry handler is a no-op when the scan became malformed', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    fireEvent.click(screen.getByRole('button', { name: 'Test Invalid Cube State' }));
    expect(gate.calls).toBe(1); // only the initial, valid solve
    setCaptured(malformed());
    const restore = screen.getByRole('button', { name: 'Restore Valid State' }) as HTMLButtonElement;
    expect(restore.disabled).toBe(true);
    act(() => reactProps(restore).onClick()); // bypass the disabled attribute: the handler itself must refuse
    await flush();
    expect(gate.calls).toBe(1);
    expect(backend.solve).not.toHaveBeenCalled();
    expect(useCubeStore.getState().status).toBe('error');
  });

  it('frontend failure takes precedence over a solve error: no Try again', async () => {
    act(() => useSessionStore.getState().startSession('demo', 'reconstructing'));
    setCaptured(malformed());
    act(() => useCubeStore.getState().setError(demoInvalidStateError()));
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 8);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/red appears 10 times/);
    expect(alert.textContent).not.toContain('The captured cube could not be validated');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(within(alert).getByRole('button', { name: 'Back to scan' })).toBeTruthy();
    expect(screen.getByText('Validation Failed')).toBeTruthy();
    expect(gate.calls).toBe(0);
  });

  it('a REQUEST_CANCELLED error left in the store is terminal with Try again that recovers', async () => {
    capture('demo');
    render(<ReconstructionScreen />);
    await flush();
    await advance(STEP * 6);
    act(() =>
      useCubeStore.getState().setError({ kind: 'client', code: 'REQUEST_CANCELLED', message: 'x', retryable: false }),
    );
    await advance(STEP * 6);
    expect(document.body.textContent).not.toMatch(/Validating…|Computing…/);
    expect(stage('validated')).toBe('failed');
    expect(stage('validated')).toBe('failed');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Validation was interrupted');
    expect(within(alert).getByRole('button', { name: 'Restart Full Scan' })).toBeTruthy();
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await flush();
    await advance(STEP * 6);
    expect(useCubeStore.getState().status).toBe('ready');
  });
});
