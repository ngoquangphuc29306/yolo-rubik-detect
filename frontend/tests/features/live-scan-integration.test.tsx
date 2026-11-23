// @vitest-environment jsdom
// Integration: the REAL screen, useLiveScan, machine and stores. Only the edges are faked:
// camera, backend health, the WebSocket transport class and the frame grabber.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROTATION_MS } from '@/lib/live-scan-machine';
import type { FrameResult, LiveReadiness } from '@/types/api';
import { SCAN_FACE_ORDER, type ColorName, type FaceId } from '@/types/cube';

vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return { RubiksCube3D: () => React.createElement('div', { 'data-testid': 'cube-stub' }) };
});

const h = vi.hoisted(() => ({
  stop: vi.fn(),
  start: vi.fn(),
  videoRef: vi.fn(),
  refresh: vi.fn(),
  readiness: { kind: 'ready' } as unknown,
  urls: [] as string[],
  sends: 0,
  script: null as unknown as () => unknown,
}));

vi.mock('@/hooks/useCamera', () => ({
  useCamera: () => ({ state: { status: 'active' }, videoRef: h.videoRef, start: h.start, stop: h.stop }),
}));
vi.mock('@/hooks/useBackendHealth', () => ({
  useBackendHealth: () => ({ readiness: h.readiness, refresh: h.refresh }),
}));
vi.mock('@/lib/frame-grabber', () => ({ grabFrame: async () => new Blob(['x'], { type: 'image/jpeg' }) }));
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
      h.sends += 1;
      return h.script();
    }
    close() {}
  }
  return { ...actual, WebSocketScanTransport: FakeWS };
});

import { ScanningScreen } from '@/features/scanner/ScanningScreen';
import { useCubeStore } from '@/stores/cube-store';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';

const GRIDS: Record<FaceId, ColorName[]> = {
  F: ['white', 'red', 'blue', 'orange', 'green', 'yellow', 'red', 'white', 'blue'],
  R: ['green', 'green', 'white', 'yellow', 'red', 'orange', 'blue', 'blue', 'yellow'],
  B: ['red', 'yellow', 'orange', 'orange', 'blue', 'green', 'white', 'yellow', 'green'],
  L: ['blue', 'white', 'red', 'green', 'orange', 'blue', 'yellow', 'red', 'yellow'],
  U: ['orange', 'blue', 'yellow', 'red', 'white', 'green', 'orange', 'green', 'red'],
  D: ['yellow', 'orange', 'green', 'blue', 'yellow', 'red', 'green', 'orange', 'white'],
};
const result = (grid: ColorName[]): { ok: true; result: FrameResult } => ({
  ok: true,
  result: {
    type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 518, height: 518,
    detections: [],
    cells: grid.map((color) => ({ color, confidence: 0.9, status: 'ok' as const })),
    grid, face: null, quality: { valid: true }, inferenceMs: 5,
  },
});
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const stageGrid = () => result(GRIDS[SCAN_FACE_ORDER[useScanStore.getState().stageIndex]!]);
const capturedCount = () => Object.keys(useScanStore.getState().captured).length;

async function captureAllSix() {
  for (let i = 0; i < 400 && capturedCount() < 6; i++) await advance(250);
  expect(capturedCount()).toBe(6);
}

beforeEach(() => {
  vi.useFakeTimers();
  h.stop.mockClear();
  h.urls = [];
  h.sends = 0;
  h.readiness = { kind: 'ready' } satisfies LiveReadiness;
  h.script = stageGrid;
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1280, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 720, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { value: 4, configurable: true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 500 } as DOMRect);
  useSessionStore.getState().startSession('live', 'scanning');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  useScanStore.getState().reset();
  useCubeStore.getState().reset();
  useSessionStore.setState({ mode: null, screen: 'landing' });
});

describe('live scan, real hook and stores', () => {
  it('connects to ws://<host>/ws/scan', async () => {
    render(<ScanningScreen />);
    await advance(300);
    expect(h.urls).toEqual([`ws://${window.location.host}/ws/scan`]);
  });

  it('a stable F face is stored as live, advances the stage, shows the cue below the frame and pauses sends', async () => {
    render(<ScanningScreen />);
    for (let i = 0; i < 40 && !useScanStore.getState().captured.F; i++) await advance(100);
    const f = useScanStore.getState().captured.F;
    expect(f?.source).toBe('live');
    expect(f?.grid).toEqual(GRIDS.F);
    expect(useScanStore.getState().stageIndex).toBe(1);

    const cue = document.querySelector('[data-next-face="R"]')!;
    expect(cue).toBeTruthy();
    const frameEl = screen.getByLabelText('Live camera preview').parentElement!;
    expect(frameEl.contains(cue)).toBe(false);

    const before = h.sends;
    await advance(ROTATION_MS - 400);
    expect(h.sends).toBe(before); // nothing is sent during the rotation
    await advance(1000);
    expect(h.sends).toBeGreaterThan(before);
    expect(document.querySelector('[data-next-face]')).toBeNull();
  });

  it('a wrong centre shows a hint and captures nothing', async () => {
    h.script = () => result(GRIDS.R); // red centre while the F stage wants green
    render(<ScanningScreen />);
    await advance(2000);
    expect(screen.getByText('Hold the face with the green centre toward the camera and white on top.')).toBeTruthy();
    expect(capturedCount()).toBe(0);
  });

  describe('six faces', () => {
    it('stops the camera, then goes to reconstruction exactly once after the delay', async () => {
      const seen: string[] = [];
      const unsub = useSessionStore.subscribe((s, p) => {
        if (s.screen !== p.screen) seen.push(s.screen);
      });
      render(<ScanningScreen />);
      await captureAllSix();
      expect(h.stop).toHaveBeenCalled();
      expect(useSessionStore.getState().screen).toBe('scanning');
      await advance(1300);
      expect(useSessionStore.getState().screen).toBe('reconstructing');
      await advance(5000);
      expect(seen).toEqual(['reconstructing']);
      unsub();
    });

    it('unmounting mid hand-off never navigates', async () => {
      const { unmount } = render(<ScanningScreen />);
      await captureAllSix();
      unmount();
      await advance(5000);
      expect(useSessionStore.getState().screen).toBe('scanning');
    });

    it('restarting during the pending hand-off never navigates', async () => {
      render(<ScanningScreen />);
      await captureAllSix();
      fireEvent.click(screen.getByRole('button', { name: /restart scan/i }));
      expect(capturedCount()).toBe(0);
      await advance(1500); // the fresh scan restarts from F; the old timer must not fire
      expect(useSessionStore.getState().screen).toBe('scanning');
    });
  });

  it.each([
    ['blocked', { kind: 'blocked', reason: 'BACKEND_UNAVAILABLE', solverReady: false }],
    ['fixture-only', { kind: 'fixture-only', solverReady: true }],
  ])('%s readiness never constructs a transport', async (_n, readiness) => {
    h.readiness = readiness;
    render(<ScanningScreen />);
    await advance(3000);
    expect(h.urls).toEqual([]);
    expect(h.sends).toBe(0);
    expect(screen.queryByTestId('guide-square')).toBeNull();
  });
});
