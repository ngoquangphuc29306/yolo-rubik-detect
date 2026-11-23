// @vitest-environment jsdom
// Flow-level check of Phase 3: a COMPLETE live scan of a real solvable cube (shared fixture) through the real screen,
// real useLiveScan, machine and stores, then the real Reconstruction -> runSolve -> binding path. Only the edges are
// faked: camera, backend health, the WebSocket transport class, the frame grabber and the solver client.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrameResult, LiveReadiness, SolveRequest } from '@/types/api';
import { SCAN_FACE_ORDER, type ColorName, type FaceId } from '@/types/cube';
import { parseSolveResponse } from '@/services/parsers';
import { loadFixture } from '../services/fixtures';

vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return { RubiksCube3D: () => React.createElement('div', { 'data-testid': 'cube-stub' }) };
});

const h = vi.hoisted(() => ({
  stop: vi.fn(),
  start: vi.fn(),
  videoRef: vi.fn(),
  refresh: vi.fn(),
  urls: [] as string[],
  script: null as unknown as () => unknown,
  solve: vi.fn(),
}));

vi.mock('@/hooks/useCamera', () => ({
  useCamera: () => ({ state: { status: 'active' }, videoRef: h.videoRef, start: h.start, stop: h.stop }),
}));
vi.mock('@/hooks/useBackendHealth', () => ({
  useBackendHealth: () => ({ readiness: { kind: 'ready' } as LiveReadiness, refresh: h.refresh }),
}));
vi.mock('@/lib/frame-grabber', () => ({ grabFrame: async () => new Blob(['x'], { type: 'image/jpeg' }) }));
vi.mock('@/services/solver-client', () => ({ solve: h.solve }));
vi.mock('@/services/scan-transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/scan-transport')>();
  class FakeWS {
    readonly available = true;
    constructor(url: string) {
      h.urls.push(url);
    }
    async connect() {
      return {
        ok: true,
        ready: { type: 'ready', schemaVersion: 1, scanId: 's', modelVersion: 'm', imgsz: 640, maxFrameBytes: 1048576, maxFrameEdge: 1280 },
      };
    }
    async send() {
      return h.script();
    }
    close() {}
  }
  return { ...actual, WebSocketScanTransport: FakeWS };
});

import { ReconstructionScreen } from '@/features/review/ReconstructionScreen';
import { ScanningScreen } from '@/features/scanner/ScanningScreen';
import { startDemoScan, startDemoShortcut } from '@/stores/demo-session';
import { useCubeStore } from '@/stores/cube-store';
import { buildSolveRequest, useScanStore, type CapturedFaces } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';

const REQUEST = loadFixture<SolveRequest>('solve/scramble-a.request.json');
const RESPONSE = loadFixture<unknown>('solve/scramble-a.response.json');
const GRIDS = REQUEST.faces;

const frame = (grid: ColorName[]): { ok: true; result: FrameResult } => ({
  ok: true,
  result: {
    type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 518, height: 518,
    detections: [],
    cells: grid.map((color) => ({ color, confidence: 0.9, status: 'ok' as const })),
    grid, face: null, quality: { valid: true }, inferenceMs: 5,
  },
});
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const stageGrid = () => frame(GRIDS[SCAN_FACE_ORDER[useScanStore.getState().stageIndex]!]);
const capturedCount = () => Object.keys(useScanStore.getState().captured).length;

beforeEach(() => {
  vi.useFakeTimers();
  h.stop.mockClear();
  h.urls = [];
  h.script = stageGrid;
  h.solve.mockReset();
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1280, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 720, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { value: 4, configurable: true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 500 } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  useScanStore.getState().reset();
  useCubeStore.getState().reset();
  useSessionStore.setState({ mode: null, screen: 'landing' });
});

describe('complete live scan of a real solvable cube', () => {
  it('captures F,R,B,L,U,D with exact grids and hands off to reconstruction', async () => {
    useSessionStore.getState().startSession('live', 'scanning');
    const order: Array<{ face: FaceId; source: string; grid: ColorName[] }> = [];
    const unsubCapture = useScanStore.subscribe((s, p) => {
      for (const f of SCAN_FACE_ORDER) {
        const now = s.captured[f];
        if (now && now !== p.captured[f]) order.push({ face: f, source: now.source, grid: [...now.grid] });
      }
    });
    const screens: string[] = [];
    const unsubScreen = useSessionStore.subscribe((s, p) => {
      if (s.screen !== p.screen) screens.push(s.screen);
    });

    const scan = render(<ScanningScreen />);
    for (let i = 0; i < 400 && capturedCount() < 6; i++) await advance(250);

    // (a) scan order, live source, exact grids
    expect(order.map((o) => o.face)).toEqual(['F', 'R', 'B', 'L', 'U', 'D']);
    for (const o of order) {
      expect(o.source).toBe('live');
      expect(o.grid).toEqual(GRIDS[o.face]);
    }
    // (b) the solve request equals the fixture request
    const captured: CapturedFaces = useScanStore.getState().captured;
    expect(buildSolveRequest(captured)).toEqual(REQUEST);

    // (c) camera stopped; reconstruction only after the hand-off delay
    expect(h.stop).toHaveBeenCalled();
    expect(useSessionStore.getState().screen).toBe('scanning');
    await advance(1300);
    expect(useSessionStore.getState().screen).toBe('reconstructing');
    expect(screens).toEqual(['reconstructing']);
    expect(h.urls.length).toBeGreaterThan(0); // positive control: live mode does open a transport
    scan.unmount();

    // (d) the REAL Reconstruction -> runSolve -> bindSolveResponse path accepts the live-captured grids
    const parsed = parseSolveResponse(RESPONSE);
    if (!parsed.ok) throw new Error('fixture response must parse');
    h.solve.mockResolvedValue({ ok: true, outcome: { response: parsed.value, source: 'backend' } });
    render(<ReconstructionScreen />);
    await advance(0);
    await advance(3000);
    expect(h.solve).toHaveBeenCalledTimes(1);
    expect(h.solve.mock.calls[0]![0]).toEqual(REQUEST);
    const cube = useCubeStore.getState();
    expect(cube.status).toBe('ready');
    expect(cube.solution?.source).toBe('backend');
    expect(cube.solution?.moves.length).toBe((RESPONSE as { moves: string[] }).moves.length);
    const prepare = screen.getByRole('button', { name: /Prepare to Solve/ }) as HTMLButtonElement;
    expect(prepare.disabled).toBe(false);
    fireEvent.click(prepare);
    expect(useSessionStore.getState().screen).toBe('alignment');
    cleanup();

    unsubCapture();
    unsubScreen();
  });
});

describe('rescan of one captured face', () => {
  it('accepts only the previous centre, rejects a wrong one with a hint, and never re-captures other faces', async () => {
    useSessionStore.getState().startSession('live', 'scanning');
    const order: FaceId[] = [];
    const unsub = useScanStore.subscribe((s, p) => {
      for (const f of SCAN_FACE_ORDER) if (s.captured[f] && s.captured[f] !== p.captured[f]) order.push(f);
    });
    render(<ScanningScreen />);
    for (let i = 0; i < 400 && capturedCount() < 3; i++) await advance(250);
    expect(order).toEqual(['F', 'R', 'B']);
    const before = { ...useScanStore.getState().captured };
    order.length = 0;

    fireEvent.click(screen.getByTestId('face-card-R'));
    expect(useScanStore.getState().captured.R).toBeUndefined();
    expect(useScanStore.getState().stageIndex).toBe(1);
    h.script = () => frame(GRIDS.L); // orange centre: not yet captured, not R's red
    await advance(2500);
    expect(screen.getByText(/not the same face as before\. Show the red-centred face again\./)).toBeTruthy();
    expect(useScanStore.getState().captured.R).toBeUndefined();
    expect(order).toEqual([]);

    h.script = stageGrid;
    for (let i = 0; i < 40 && !useScanStore.getState().captured.R; i++) await advance(250);
    expect(order).toEqual(['R']);
    expect(useScanStore.getState().captured.R).toEqual({ grid: GRIDS.R, source: 'live' });
    expect(useScanStore.getState().captured.F).toBe(before.F);
    expect(useScanStore.getState().captured.B).toBe(before.B);

    for (let i = 0; i < 400 && capturedCount() < 6; i++) await advance(250);
    expect(order).toEqual(['R', 'L', 'U', 'D']); // F and B are never captured again
    expect(buildSolveRequest(useScanStore.getState().captured)).toEqual(REQUEST);
    await advance(1300);
    expect(useSessionStore.getState().screen).toBe('reconstructing');
    unsub();
  });
});

describe('Demo isolation at flow level', () => {
  it('a full demo session never constructs a WebSocketScanTransport', async () => {
    startDemoScan();
    const scan = render(<ScanningScreen />);
    await advance(3000);
    scan.unmount();
    startDemoShortcut();
    expect(useSessionStore.getState().screen).toBe('reconstructing');
    render(<ReconstructionScreen />);
    await advance(3000);
    expect(useCubeStore.getState().status).toBe('ready');
    expect(useCubeStore.getState().solution?.source).toBe('demo-fixture');
    expect(h.urls).toEqual([]);
    expect(h.solve).not.toHaveBeenCalled();
  });
});
