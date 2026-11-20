import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/stores/session-store';
import { useScanStore, buildSolveRequest } from '@/stores/scan-store';
import { useCubeStore } from '@/stores/cube-store';
import { demoFaces } from '@/demo/demo-fixtures';
import { SCAN_FACE_ORDER, type ColorName, type FaceGrid, type FaceId } from '@/types/cube';

const faces = demoFaces(0);
const grid = (f: FaceId) => faces[f];
const reset = () => {
  useSessionStore.setState({ mode: null, screen: 'landing', sessionId: 0 });
  useScanStore.getState().reset();
  useCubeStore.getState().reset();
};
beforeEach(reset);

describe('session-store', () => {
  it('startSession increments sessionId, sets mode/screen and resets scan + cube stores', () => {
    const s = useSessionStore.getState();
    s.startSession('demo', 'scanning');
    expect(useSessionStore.getState()).toMatchObject({ mode: 'demo', screen: 'scanning', sessionId: 1 });
    useScanStore.getState().captureFace('F', grid('F'), 'demo');
    useCubeStore.getState().beginSolve();
    useSessionStore.getState().startSession('live', 'scanning');
    expect(useSessionStore.getState()).toMatchObject({ mode: 'live', sessionId: 2 });
    expect(useScanStore.getState().captured).toEqual({});
    expect(useScanStore.getState().stageIndex).toBe(0);
    expect(useCubeStore.getState().status).toBe('idle');
  });
  it('setScreen does not touch sessionId', () => {
    useSessionStore.getState().setScreen('alignment');
    expect(useSessionStore.getState()).toMatchObject({ screen: 'alignment', sessionId: 0 });
  });
  it('settings defaults and delay clamp to whole seconds in 2000..15000', () => {
    const st = () => useSessionStore.getState().settings;
    expect(st()).toEqual({ delayMs: 5000, soundEnabled: true, autoCaptureEnabled: true });
    const set = useSessionStore.getState().setDelayMs;
    set(100); expect(st().delayMs).toBe(2000);
    set(99999); expect(st().delayMs).toBe(15000);
    set(3400); expect(st().delayMs).toBe(3000);
    set(3600); expect(st().delayMs).toBe(4000);
    set(Number.NaN); expect(st().delayMs).toBe(4000);
    useSessionStore.getState().toggleSound(); expect(st().soundEnabled).toBe(false);
    useSessionStore.getState().setAutoCapture(false); expect(st().autoCaptureEnabled).toBe(false);
  });
});

describe('scan-store', () => {
  it('initial state', () => {
    const s = useScanStore.getState();
    expect(s.stageIndex).toBe(0);
    expect(s.faceStatuses).toEqual({ F: 'scanning', R: 'pending', B: 'pending', L: 'pending', U: 'pending', D: 'pending' });
    expect(s.captured).toEqual({});
  });
  it('stores the given grid exactly and advances F R B L U D', () => {
    SCAN_FACE_ORDER.forEach((f, i) => {
      expect(useScanStore.getState().stageIndex).toBe(i);
      expect(useScanStore.getState().captureFace(f, grid(f), 'live')).toBe(true);
      expect(useScanStore.getState().captured[f]).toEqual({ grid: grid(f), source: 'live' });
    });
    const s = useScanStore.getState();
    expect(Object.values(s.faceStatuses).every((x) => x === 'captured')).toBe(true);
    expect(s.condition).toBe('captured_flash');
    expect(s.stageIndex).toBe(5);
  });
  it('marks the next face scanning', () => {
    useScanStore.getState().captureFace('F', grid('F'), 'demo');
    expect(useScanStore.getState().faceStatuses).toMatchObject({ F: 'captured', R: 'scanning', B: 'pending' });
    expect(useScanStore.getState().stageIndex).toBe(1);
  });
  it('rejects a bad grid without changing state', () => {
    const before = useScanStore.getState();
    const short = grid('F').slice(0, 8) as unknown as FaceGrid;
    const unknown = [...grid('F')];
    unknown[4] = 'purple' as ColorName;
    expect(useScanStore.getState().captureFace('F', short, 'demo')).toBe(false);
    expect(useScanStore.getState().captureFace('F', unknown as unknown as FaceGrid, 'demo')).toBe(false);
    expect(useScanStore.getState().captureFace('X' as FaceId, grid('F'), 'demo')).toBe(false);
    const after = useScanStore.getState();
    expect(after.captured).toBe(before.captured);
    expect(after.faceStatuses).toBe(before.faceStatuses);
    expect(after.stageIndex).toBe(0);
  });
  it('rescan discards that face and re-targets it, then returns to the next pending face', () => {
    for (const f of ['F', 'R', 'B'] as FaceId[]) useScanStore.getState().captureFace(f, grid(f), 'demo');
    useScanStore.getState().selectFaceForRescan('R');
    let s = useScanStore.getState();
    expect(s.captured.R).toBeUndefined();
    expect(s.captured.F).toBeDefined();
    expect(s.faceStatuses).toMatchObject({ F: 'captured', R: 'scanning', B: 'captured', L: 'pending' });
    expect(s.stageIndex).toBe(1);
    expect(s.condition).toBe('ready');
    s.captureFace('R', grid('R'), 'demo');
    s = useScanStore.getState();
    expect(s.faceStatuses.L).toBe('scanning');
    expect(s.stageIndex).toBe(3);
  });
  it('setCondition / setStability', () => {
    useScanStore.getState().setStability(55);
    expect(useScanStore.getState().stability).toBe(55);
    useScanStore.getState().setCondition('unstable');
    expect(useScanStore.getState()).toMatchObject({ condition: 'unstable', stability: 0 });
    useScanStore.getState().setStability(500);
    expect(useScanStore.getState().stability).toBe(100);
  });
  it('buildSolveRequest is null until all six faces are captured, then exact', () => {
    for (const f of SCAN_FACE_ORDER.slice(0, 5)) {
      useScanStore.getState().captureFace(f, grid(f), 'demo');
      expect(buildSolveRequest(useScanStore.getState().captured)).toBeNull();
    }
    useScanStore.getState().captureFace('D', grid('D'), 'demo');
    const req = buildSolveRequest(useScanStore.getState().captured);
    expect(req).toEqual({ schemaVersion: 1, faces: faces });
  });
});

describe('cube-store', () => {
  it('transitions', () => {
    const c = useCubeStore.getState();
    expect(c.status).toBe('idle');
    c.beginSolve();
    expect(useCubeStore.getState()).toMatchObject({ status: 'solving', solution: null, error: null });
    useCubeStore.getState().setError({ kind: 'client', code: 'NETWORK', message: 'x', retryable: true });
    expect(useCubeStore.getState()).toMatchObject({ status: 'error', solution: null });
    useCubeStore.getState().reset();
    expect(useCubeStore.getState()).toMatchObject({ status: 'idle', error: null, solution: null });
  });
});
