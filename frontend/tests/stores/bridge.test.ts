// Characterises the TEMPORARY legacy-store bridge (removed in T1.17).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRubikStore } from '@/store/useRubikStore';
import { useSessionStore } from '@/stores/session-store';
import { useScanStore } from '@/stores/scan-store';
import { useCubeStore } from '@/stores/cube-store';
import { DEMO_CENTER_COLORS, DEMO_SCRAMBLES, demoFaces, demoInitialState } from '@/demo/demo-fixtures';
import { toCubies } from '@/engine/cubie-adapter';
import { colorNameToCode } from '@/lib/colors';
import { extractAllFaces, generateScrambleSession } from '@/lib/cubeEngine';
import { SCAN_FACE_ORDER, type MoveToken } from '@/types/cube';

const invert = (m: MoveToken): MoveToken => (m.endsWith("'") ? (m[0] as MoveToken) : m.endsWith('2') ? m : (`${m}'` as MoveToken));
const inverseOf = (i: number) => [...DEMO_SCRAMBLES[i]].reverse().map(invert);
const codes = (i: number) =>
  Object.fromEntries(SCAN_FACE_ORDER.map((f) => [f, demoFaces(i)[f].map(colorNameToCode)]));
const ready = () => vi.waitFor(() => expect(useCubeStore.getState().status).toBe('ready'));

beforeEach(() => {
  useSessionStore.getState().startSession('demo', 'landing');
  useSessionStore.setState({ mode: null, screen: 'landing' });
  useSessionStore.getState().setDelayMs(5000);
  if (!useSessionStore.getState().settings.soundEnabled) useSessionStore.getState().toggleSound();
  useRubikStore.setState({ sessionSeed: 0 });
});

describe('legacy bridge', () => {
  it('startInteractiveDemo drives the new stores and mirrors the solved result', async () => {
    useRubikStore.getState().startInteractiveDemo();
    await ready();
    const legacy = useRubikStore.getState();
    expect(legacy.screen).toBe('reconstructing');
    expect(legacy.solution).toEqual(inverseOf(0));
    expect(legacy.initialCube).toEqual(toCubies(demoInitialState(0), DEMO_CENTER_COLORS));
    expect(useCubeStore.getState().solution?.source).toBe('demo-fixture');
    expect(legacy.capturedFaces).toEqual(codes(0));
    expect(Object.values(legacy.faceStatuses).every((s) => s === 'captured')).toBe(true);
  });

  it('startFreshScan starts a demo scanning session; six captures mirror demo faces and solve', async () => {
    useRubikStore.getState().startFreshScan();
    expect(useSessionStore.getState()).toMatchObject({ mode: 'demo', screen: 'scanning' });
    expect(useRubikStore.getState().screen).toBe('scanning');
    expect(useRubikStore.getState().scanCondition).toBe('loading_model');
    for (let i = 0; i < 6; i++) useRubikStore.getState().captureCurrentFace();
    expect(useRubikStore.getState().capturedFaces).toEqual(codes(0));
    await ready();
    expect(useRubikStore.getState().solution).toEqual(inverseOf(0));
  });

  it('demo faces in codes equal the legacy extractAllFaces of the same scramble', () => {
    useRubikStore.getState().startFreshScan();
    expect(useRubikStore.getState().targetFaces).toEqual(extractAllFaces(generateScrambleSession(0).initialCube));
  });

  it('screen, delay, sound and auto-capture mirror both ways', () => {
    useSessionStore.getState().setScreen('alignment');
    expect(useRubikStore.getState().screen).toBe('alignment');
    useRubikStore.getState().setScreen('solving');
    expect(useSessionStore.getState().screen).toBe('solving');
    useRubikStore.getState().setMoveDelaySeconds(9);
    expect(useSessionStore.getState().settings.delayMs).toBe(9000);
    expect(useRubikStore.getState().moveDelaySeconds).toBe(9);
    useRubikStore.getState().setMoveDelaySeconds(99);
    expect(useRubikStore.getState().moveDelaySeconds).toBe(15);
    useRubikStore.getState().toggleSound();
    expect(useSessionStore.getState().settings.soundEnabled).toBe(false);
    expect(useRubikStore.getState().soundEnabled).toBe(false);
    useRubikStore.getState().setAutoCaptureEnabled(false);
    expect(useSessionStore.getState().settings.autoCaptureEnabled).toBe(false);
    expect(useRubikStore.getState().autoCaptureEnabled).toBe(false);
    useRubikStore.getState().setAutoCaptureEnabled(true);
  });

  it('scan condition, stability, rescan selection and rescan flag go through the scan store', () => {
    useRubikStore.getState().startFreshScan();
    useRubikStore.getState().setScanCondition('ready');
    useRubikStore.getState().setStabilityProgress(42);
    expect(useScanStore.getState()).toMatchObject({ condition: 'ready', stability: 42 });
    expect(useRubikStore.getState().stabilityProgress).toBe(42);
    useRubikStore.getState().captureCurrentFace();
    useRubikStore.getState().selectFaceForRescan('F');
    expect(useSessionStore.getState().screen).toBe('scanning');
    expect(useRubikStore.getState().capturedFaces.F).toBeUndefined();
    expect(useRubikStore.getState().faceStatuses.F).toBe('scanning');
    useRubikStore.getState().markFaceNeedsRescan('R');
    expect(useScanStore.getState().faceStatuses.R).toBe('rescan');
    expect(useRubikStore.getState().faceStatuses.R).toBe('rescan');
  });

  it('startFreshScan(true) advances the seed, changes the demo cube, and ignores a solve in flight', async () => {
    useRubikStore.getState().startInteractiveDemo(); // solve now in flight
    const before = useRubikStore.getState().initialCube;
    useRubikStore.getState().startFreshScan(true);
    expect(useRubikStore.getState().sessionSeed).toBe(1);
    expect(useRubikStore.getState().initialCube).toEqual(toCubies(demoInitialState(1), DEMO_CENTER_COLORS));
    expect(useRubikStore.getState().initialCube).not.toEqual(before);
    await new Promise((r) => setTimeout(r, 20));
    expect(useCubeStore.getState().status).toBe('idle');
    expect(useRubikStore.getState().solution).toEqual([]);
    for (let i = 0; i < 6; i++) useRubikStore.getState().captureCurrentFace();
    await ready();
    expect(useRubikStore.getState().solution).toEqual(inverseOf(1));
  });

  it('mirrored fields follow the new stores when those are written directly', () => {
    useSessionStore.setState({ screen: 'completion' });
    useScanStore.getState().setStability(77);
    useScanStore.getState().captureFace('F', demoFaces(0).F, 'demo');
    const l = useRubikStore.getState();
    expect(l.screen).toBe('completion');
    expect(l.stabilityProgress).toBe(0); // capture resets stability (77 was mirrored then replaced)
    expect(l.capturedFaces.F).toEqual(codes(0).F);
    expect(l.activeFaceIndex).toBe(1);
  });

  it('captureCurrentFace is a no-op outside a demo session', () => {
    useSessionStore.getState().startSession('live', 'scanning');
    useRubikStore.getState().captureCurrentFace();
    expect(useScanStore.getState().captured).toEqual({});
  });

  it('before any solve initialCube is the demo cube of the current seed and solution is empty', () => {
    const l = useRubikStore.getState();
    expect(l.initialCube).toEqual(toCubies(demoInitialState(0), DEMO_CENTER_COLORS));
    expect(l.solution).toEqual([]);
  });

  it('legacy solution keeps its reference across unrelated upstream updates', async () => {
    useRubikStore.getState().startInteractiveDemo();
    await ready();
    const sol = useRubikStore.getState().solution;
    const cubie = useRubikStore.getState().initialCube;
    useScanStore.getState().setStability(10);
    useSessionStore.getState().toggleSound();
    expect(useRubikStore.getState().solution).toBe(sol);
    expect(useRubikStore.getState().initialCube).toBe(cubie);
  });

  it('legacy listeners are not notified when nothing mirrored changed', async () => {
    useRubikStore.getState().startInteractiveDemo();
    await ready();
    const listener = vi.fn();
    const unsub = useRubikStore.subscribe(listener);
    useSessionStore.setState({ mode: 'demo' }); // unmirrored field
    useSessionStore.setState({ sessionId: useSessionStore.getState().sessionId }); // no-op
    expect(listener).not.toHaveBeenCalled();
    useScanStore.getState().setStability(33); // mirrored
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('a 7th captureCurrentFace after completion does not restart the solve', async () => {
    useRubikStore.getState().startFreshScan();
    const begin = vi.spyOn(useCubeStore.getState(), 'beginSolve');
    for (let i = 0; i < 6; i++) useRubikStore.getState().captureCurrentFace();
    await ready();
    expect(begin).toHaveBeenCalledTimes(1);
    const sol = useCubeStore.getState().solution;
    useRubikStore.getState().captureCurrentFace();
    expect(useCubeStore.getState().status).toBe('ready');
    expect(useCubeStore.getState().solution).toBe(sol);
    expect(begin).toHaveBeenCalledTimes(1);
    begin.mockRestore();
  });
});
