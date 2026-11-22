// Port of the retired bridge.test.ts (acceptance spec) to the demo-session API and the new stores.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@/stores/session-store';
import { useScanStore } from '@/stores/scan-store';
import { useCubeStore } from '@/stores/cube-store';
import {
  captureDemoFace,
  demoFacesForSeed,
  demoIndexForSeed,
  restartScan,
  startDemoScan,
  startDemoShortcut,
} from '@/stores/demo-session';
import { DEMO_SCRAMBLES, demoFaces } from '@/demo/demo-fixtures';
import { demoSolve } from '@/demo/demo-solver';
import { colorNameToCode } from '@/lib/colors';
import { SCAN_FACE_ORDER, type MoveToken } from '@/types/cube';

// Delegating counter: the real demo solver still runs; tests can count how many solves were started.
vi.mock('@/demo/demo-solver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/demo/demo-solver')>();
  return { ...actual, demoSolve: vi.fn(actual.demoSolve) };
});

const invert = (m: MoveToken): MoveToken => (m.endsWith("'") ? (m[0] as MoveToken) : m.endsWith('2') ? m : (`${m}'` as MoveToken));
const inverseOf = (i: number) => [...DEMO_SCRAMBLES[i]].reverse().map(invert);
const codes = (i: number) =>
  Object.fromEntries(SCAN_FACE_ORDER.map((f) => [f, demoFaces(i)[f].map(colorNameToCode)]));
const capturedCodes = () =>
  Object.fromEntries(
    SCAN_FACE_ORDER.map((f) => [f, useScanStore.getState().captured[f]?.grid.map(colorNameToCode)]),
  );
const ready = () => vi.waitFor(() => expect(useCubeStore.getState().status).toBe('ready'));
const moves = () => useCubeStore.getState().solution?.moves;

beforeEach(() => {
  useSessionStore.getState().startSession('demo', 'landing');
  useSessionStore.setState({ mode: null, screen: 'landing', demoSeed: 0 });
  useSessionStore.getState().setDelayMs(5000);
  if (!useSessionStore.getState().settings.soundEnabled) useSessionStore.getState().toggleSound();
});

describe('demo seed', () => {
  it('starts at 0, survives startSession, and only advanceDemoSeed changes it', () => {
    expect(useSessionStore.getState().demoSeed).toBe(0);
    useSessionStore.getState().advanceDemoSeed();
    expect(useSessionStore.getState().demoSeed).toBe(1);
    useSessionStore.getState().startSession('live', 'scanning');
    expect(useSessionStore.getState().demoSeed).toBe(1);
    useSessionStore.getState().startSession('demo', 'scanning');
    expect(useSessionStore.getState().demoSeed).toBe(1);
  });

  it('index wraps modulo the preset count (3) and demo faces follow it', () => {
    expect(DEMO_SCRAMBLES).toHaveLength(3);
    expect([0, 1, 2, 3, 4, -1].map(demoIndexForSeed)).toEqual([0, 1, 2, 0, 1, 1]);
    expect(demoFacesForSeed(3)).toEqual(demoFacesForSeed(0));
    expect(demoFacesForSeed(1)).toEqual(demoFaces(1));
    expect(demoFacesForSeed(1)).not.toEqual(demoFacesForSeed(0));
  });
});

describe('startDemoShortcut', () => {
  it('captures all six demo faces, goes to reconstruction and solves with demo provenance', async () => {
    startDemoShortcut();
    await ready();
    expect(useSessionStore.getState()).toMatchObject({ mode: 'demo', screen: 'reconstructing' });
    expect(moves()).toEqual(inverseOf(0));
    expect(useCubeStore.getState().solution?.source).toBe('demo-fixture');
    expect(capturedCodes()).toEqual(codes(0));
    expect(Object.values(useScanStore.getState().faceStatuses).every((s) => s === 'captured')).toBe(true);
  });

  it('discards stale state: a pre-existing ready solution is cleared and re-solved fresh', async () => {
    const stale = useSessionStore.getState().sessionId;
    useCubeStore.setState({ status: 'ready' });
    startDemoShortcut();
    expect(useSessionStore.getState().sessionId).toBe(stale + 1);
    expect(useCubeStore.getState().status).toBe('solving');
    await ready();
    expect(moves()).toEqual(inverseOf(0));
  });
});

describe('startDemoScan + captureDemoFace', () => {
  it('starts a demo scanning session in loading_model; six captures reproduce the demo faces and solve', async () => {
    startDemoScan();
    expect(useSessionStore.getState()).toMatchObject({ mode: 'demo', screen: 'scanning' });
    expect(useScanStore.getState().condition).toBe('loading_model');
    for (let i = 0; i < 6; i++) captureDemoFace();
    expect(capturedCodes()).toEqual(codes(0));
    await ready();
    expect(moves()).toEqual(inverseOf(0));
  });

  it('startDemoScan(true) advances the seed, changes the demo cube, and ignores a solve in flight', async () => {
    startDemoShortcut(); // solve now in flight
    startDemoScan(true);
    expect(useSessionStore.getState().demoSeed).toBe(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(useCubeStore.getState().status).toBe('idle');
    expect(moves()).toBeUndefined();
    for (let i = 0; i < 6; i++) captureDemoFace();
    expect(capturedCodes()).toEqual(codes(1));
    await ready();
    expect(moves()).toEqual(inverseOf(1));
  });

  it('startDemoScan(false) keeps the seed', () => {
    useSessionStore.setState({ demoSeed: 2 });
    startDemoScan();
    expect(useSessionStore.getState().demoSeed).toBe(2);
  });

  it('captureDemoFace is a no-op outside a demo session', () => {
    useSessionStore.getState().startSession('live', 'scanning');
    captureDemoFace();
    expect(useScanStore.getState().captured).toEqual({});
  });

  it('a 7th capture after completion does not start another solve (counts solver calls)', async () => {
    vi.mocked(demoSolve).mockClear();
    startDemoScan();
    for (let i = 0; i < 6; i++) captureDemoFace();
    await ready();
    expect(demoSolve).toHaveBeenCalledTimes(1);
    const sol = useCubeStore.getState().solution;
    captureDemoFace();
    captureDemoFace();
    await new Promise((r) => setTimeout(r, 20));
    expect(useCubeStore.getState().status).toBe('ready');
    expect(useCubeStore.getState().solution).toBe(sol);
    expect(demoSolve).toHaveBeenCalledTimes(1);
  });

  it('session-store settings (delay clamp, sound, auto-capture) work directly on the store', () => {
    const s = useSessionStore.getState();
    s.setDelayMs(9000);
    expect(useSessionStore.getState().settings.delayMs).toBe(9000);
    s.setDelayMs(99000);
    expect(useSessionStore.getState().settings.delayMs).toBe(15000);
    s.toggleSound();
    expect(useSessionStore.getState().settings.soundEnabled).toBe(false);
    s.setAutoCapture(false);
    expect(useSessionStore.getState().settings.autoCaptureEnabled).toBe(false);
    s.setAutoCapture(true);
  });
});

describe('restartScan (mode-aware)', () => {
  it('live: restarts a LIVE scanning session, never advances the seed, leaves no demo capture', () => {
    useSessionStore.getState().startSession('live', 'completion');
    useSessionStore.setState({ demoSeed: 2 });
    const id = useSessionStore.getState().sessionId;
    for (const newSeed of [true, false]) {
      restartScan(newSeed);
      expect(useSessionStore.getState()).toMatchObject({ mode: 'live', screen: 'scanning', demoSeed: 2 });
      expect(useScanStore.getState().captured).toEqual({});
      expect(useScanStore.getState().condition).not.toBe('loading_model');
    }
    expect(useSessionStore.getState().sessionId).toBe(id + 2);
  });

  it('demo: starts a demo scan; the seed advances only when asked', () => {
    useSessionStore.getState().startSession('demo', 'completion');
    restartScan(false);
    expect(useSessionStore.getState()).toMatchObject({ mode: 'demo', screen: 'scanning', demoSeed: 0 });
    restartScan(true);
    expect(useSessionStore.getState()).toMatchObject({ mode: 'demo', screen: 'scanning', demoSeed: 1 });
    expect(useScanStore.getState().condition).toBe('loading_model');
  });

  it('mode null behaves as demo', () => {
    expect(useSessionStore.getState().mode).toBeNull();
    restartScan(true);
    expect(useSessionStore.getState()).toMatchObject({ mode: 'demo', screen: 'scanning', demoSeed: 1 });
  });
});
