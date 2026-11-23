// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseLiveScanResult } from '@/hooks/useLiveScan';
import { initialLiveScanState, type LiveScanState } from '@/lib/live-scan-machine';
import type { FrameResult } from '@/types/api';
import type { FaceGrid } from '@/types/cube';

vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return { RubiksCube3D: () => React.createElement('div', { 'data-testid': 'cube-stub' }) };
});

const h = vi.hoisted(() => ({
  cameraStatus: 'active' as string,
  stop: vi.fn(),
  start: vi.fn(),
  videoRef: vi.fn(),
  refresh: vi.fn(),
  live: null as unknown,
  useReal: false,
  hookOptions: [] as { enabled: boolean; createTransport: () => unknown }[],
  ctor: vi.fn(),
}));

vi.mock('@/hooks/useCamera', () => ({
  useCamera: () => ({ state: { status: h.cameraStatus }, videoRef: h.videoRef, start: h.start, stop: h.stop }),
}));
vi.mock('@/hooks/useBackendHealth', () => ({
  useBackendHealth: () => ({ readiness: { kind: 'ready' }, refresh: h.refresh }),
}));
vi.mock('@/services/scan-transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/scan-transport')>();
  return { ...actual, WebSocketScanTransport: h.ctor };
});
vi.mock('@/hooks/useLiveScan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useLiveScan')>();
  return {
    useLiveScan: (o: { enabled: boolean; createTransport: () => unknown }) => {
      h.hookOptions.push(o);
      return h.useReal ? actual.useLiveScan(o as never) : (h.live as UseLiveScanResult);
    },
  };
});

import { ScanningScreen } from '@/features/scanner/ScanningScreen';
import { startDemoScan } from '@/stores/demo-session';
import { useCubeStore } from '@/stores/cube-store';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';

const OK = { color: 'green', confidence: 0.9, status: 'ok' } as const;
const frame = (): FrameResult => ({
  type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 518, height: 518,
  detections: [], cells: Array.from({ length: 9 }, () => ({ ...OK })), grid: null,
  quality: { valid: false }, inferenceMs: 1,
});
const grid = (c: string) => Array(9).fill(c) as unknown as FaceGrid;

function setLive(over: Partial<UseLiveScanResult> = {}, state: Partial<LiveScanState> = {}) {
  const live: UseLiveScanResult = {
    connection: 'live',
    state: { ...initialLiveScanState(), ...state },
    lastResult: frame(),
    errorMessage: null,
    rescan: vi.fn(),
    reset: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
  h.live = live;
  return live;
}

beforeEach(() => {
  h.cameraStatus = 'active';
  h.useReal = false;
  h.hookOptions = [];
  for (const f of [h.stop, h.start, h.videoRef, h.refresh, h.ctor]) f.mockClear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 500 } as DOMRect);
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1280, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 720, configurable: true });
  useSessionStore.getState().startSession('live', 'scanning');
  setLive();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  useScanStore.getState().reset();
  useCubeStore.getState().reset();
  useSessionStore.setState({ mode: null, screen: 'landing' });
});

describe('Live scanning screen', () => {
  it('shows the guide with nine cells and no Capture Face button', () => {
    render(<ScanningScreen />);
    expect(screen.getByTestId('guide-square')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /Row \d, column \d: green/ })).toHaveLength(9);
    expect(screen.queryByRole('button', { name: /capture face/i })).toBeNull();
    expect(screen.queryByText(/Capture unavailable/)).toBeNull();
  });

  it('rotating shows the cue and the next stage panel', () => {
    useScanStore.getState().captureFace('F', grid('green'), 'live');
    setLive({}, { stage: 'R', phase: 'rotating' });
    render(<ScanningScreen />);
    const cue = document.querySelector('[data-next-face="R"]');
    expect(cue).toBeTruthy();
    expect(within(cue as HTMLElement).getByText('Rotate the whole cube')).toBeTruthy();
    expect(screen.getByTestId('scan-guide-panel').textContent).toMatch(/Right face/);
    expect(screen.getByText('Saved. Rotate the whole cube to the next face.')).toBeTruthy();
  });

  it('the cue never appears outside the rotating phase', () => {
    render(<ScanningScreen />);
    expect(document.querySelector('[data-next-face]')).toBeNull();
  });

  it('keeps the guide square inside the frame (layout numbers)', () => {
    render(<ScanningScreen />);
    const sq = screen.getByTestId('guide-square');
    const top = parseFloat(sq.style.top);
    const height = parseFloat(sq.style.height);
    expect(top).toBeGreaterThan(0);
    expect(top + height).toBeLessThan(500);
  });

  it('start pose emphasis before any capture', () => {
    render(<ScanningScreen />);
    expect(screen.getByText('Start pose: green centre toward the camera, white centre on top.')).toBeTruthy();
    expect(screen.getByTestId('cube-stub').parentElement!.className).toContain('w-40');
  });

  describe('status strip', () => {
    const strip = (text: string) => screen.getByText(text).closest('[role="status"]');
    it('camera off', () => {
      h.cameraStatus = 'idle';
      render(<ScanningScreen />);
      expect(strip('Enable the camera to start scanning')).toBeTruthy();
      expect(screen.queryByTestId('guide-square')).toBeNull();
    });
    it('connecting', () => {
      setLive({ connection: 'connecting' });
      render(<ScanningScreen />);
      expect(strip('Connecting to the vision service…')).toBeTruthy();
      expect(screen.getByText('Waiting for the vision service')).toBeTruthy();
    });
    it('aligning names the face and the top line says Auto-capture on', () => {
      render(<ScanningScreen />);
      expect(strip('Place the Front face inside the square.')).toBeTruthy();
      expect(screen.getByText('Auto-capture on')).toBeTruthy();
    });
    it('does not duplicate the hint the guide already shows', () => {
      setLive({}, { hint: 'Hold the face steady inside the square.' });
      render(<ScanningScreen />);
      expect(screen.getAllByText('Hold the face steady inside the square.')).toHaveLength(1);
    });
    it('done', () => {
      setLive({}, { phase: 'done' });
      render(<ScanningScreen />);
      expect(strip('All six faces captured.')).toBeTruthy();
    });
    it('error shows the message and Retry calls onRetry', () => {
      const live = setLive({ connection: 'error', errorMessage: 'The vision connection failed.' });
      render(<ScanningScreen />);
      expect(strip('The vision connection failed.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^retry$/i }));
      expect(live.retry).toHaveBeenCalledTimes(1);
    });
  });

  describe('rescan and restart', () => {
    it('selecting a pending face does nothing', () => {
      const live = setLive();
      render(<ScanningScreen />);
      fireEvent.click(screen.getByTestId('face-card-U'));
      expect(live.rescan).not.toHaveBeenCalled();
      expect(useScanStore.getState().stageIndex).toBe(0);
    });
    it('selecting a captured face rescans it with its previous centre', () => {
      const live = setLive();
      render(<ScanningScreen />);
      act(() => void useScanStore.getState().captureFace('F', grid('green'), 'live'));
      fireEvent.click(screen.getByTestId('face-card-F'));
      expect(live.rescan).toHaveBeenCalledWith('F', 'green');
      expect(useScanStore.getState().captured.F).toBeUndefined();
    });
    it('Restart Scan resets the live scan', () => {
      const live = setLive();
      render(<ScanningScreen />);
      expect(live.reset).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /restart scan/i }));
      expect(live.reset).toHaveBeenCalled();
      expect(useSessionStore.getState().mode).toBe('live');
    });
  });

  describe('hand-off after the sixth face', () => {
    const captureAll = () =>
      act(() => {
        for (const [f, c] of [['F', 'green'], ['R', 'red'], ['B', 'blue'], ['L', 'orange'], ['U', 'white'], ['D', 'yellow']] as const) {
          useScanStore.getState().captureFace(f, grid(c), 'live');
        }
      });

    it('stops the camera now and goes to reconstruction after the delay', () => {
      vi.useFakeTimers();
      render(<ScanningScreen />);
      h.stop.mockClear();
      captureAll();
      expect(h.stop).toHaveBeenCalled();
      expect(useSessionStore.getState().screen).toBe('scanning');
      act(() => void vi.advanceTimersByTime(1199));
      expect(useSessionStore.getState().screen).toBe('scanning');
      act(() => void vi.advanceTimersByTime(2));
      expect(useSessionStore.getState().screen).toBe('reconstructing');
    });

    it('clears the timer on unmount', () => {
      vi.useFakeTimers();
      const { unmount } = render(<ScanningScreen />);
      captureAll();
      unmount();
      act(() => void vi.advanceTimersByTime(5000));
      expect(useSessionStore.getState().screen).toBe('scanning');
    });
  });
});

describe('Demo isolation', () => {
  it('never constructs a transport or calls createTransport', () => {
    vi.useFakeTimers();
    h.useReal = true;
    startDemoScan(false);
    render(<ScanningScreen />);
    act(() => void vi.advanceTimersByTime(5000));
    expect(h.hookOptions.length).toBeGreaterThan(0);
    expect(h.hookOptions.every((o) => o.enabled === false)).toBe(true);
    expect(h.ctor).not.toHaveBeenCalled();
  });
});
