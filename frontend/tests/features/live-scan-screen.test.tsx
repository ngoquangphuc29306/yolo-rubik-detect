// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UseLiveScanResult } from '@/hooks/useLiveScan';
import { initialLiveScanState, type LiveScanState } from '@/lib/live-scan-machine';
import type { FrameResult } from '@/types/api';
import type { FaceGrid } from '@/types/cube';

vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return {
    RubiksCube3D: (p: { referenceRotation?: number[] }) =>
      React.createElement('div', { 'data-testid': 'cube-stub', 'data-rot': JSON.stringify(p.referenceRotation ?? null) }),
  };
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

import { netMirror } from '../helpers/mirror';
import { guideOverlay } from '@/lib/scan-roi';
import { scanGuide } from '@/features/scanner/scan-guide';
import { ScanningScreen } from '@/features/scanner/ScanningScreen';
import { startDemoScan } from '@/stores/demo-session';
import { useCubeStore } from '@/stores/cube-store';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';

const OK = { color: 'green', confidence: 0.9, status: 'ok' } as const;
const frame = (): FrameResult => ({
  type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 518, height: 518,
  detections: [], cells: Array.from({ length: 9 }, () => ({ ...OK })), grid: null, face: { x0: 100, y0: 100, x1: 400, y1: 400 },
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
  it('shows the guide zone, the raw boxes and no Capture Face button', () => {
    const withBox = { ...frame(), detections: [{ classId: 0, color: 'green' as const, confidence: 0.9, xyxy: [0, 0, 10, 10] as [number, number, number, number] }] };
    setLive({ lastResult: withBox });
    render(<ScanningScreen />);
    expect(screen.getByTestId('guide-square')).toBeTruthy();
    expect(screen.getAllByTestId('yolo-box').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /capture face/i })).toBeNull();
    expect(screen.queryByText(/Capture unavailable/)).toBeNull();
  });

  it('mirrors only the display: video and overlay layer share a parent and flip; text does not', () => {
    setLive({}, { hint: 'Hold the face steady inside the square.' });
    render(<ScanningScreen />);
    const video = screen.getByLabelText('Live camera preview');
    const layer = screen.getByTestId('mirror-layer');
    expect(video.style.transform).toBe('scaleX(-1)');
    expect(layer.style.transform).toBe('scaleX(-1)');
    expect(layer.parentElement).toBe(video.parentElement);
    expect(netMirror(screen.getByTestId('guide-square'))).toBe(-1);
    expect(netMirror(screen.getByText('Place the Front face inside the square.'))).toBe(1);
    expect(netMirror(screen.getByText('Hold the face steady inside the square.'))).toBe(1);
  });

  it('shows no 3x3 lattice, only the placement zone', () => {
    render(<ScanningScreen />);
    expect(screen.queryByTestId('face-lattice')).toBeNull();
    expect(screen.getByTestId('guide-square')).toBeTruthy();
  });

  it('rotating shows the cue and the next stage panel', () => {
    useScanStore.getState().captureFace('F', grid('green'), 'live');
    setLive({}, { stage: 'R', phase: 'rotating', step: 1 });
    render(<ScanningScreen />);
    const cue = document.querySelector('[data-next-face="R"]');
    expect(cue).toBeTruthy();
    expect(within(cue as HTMLElement).getByText('Saved. Rotate the whole cube along the arrow.')).toBeTruthy();
    expect(within(cue as HTMLElement).getByText('Next: red centre')).toBeTruthy();
    expect(within(cue as HTMLElement).getByText('Right face')).toBeTruthy();
    // the arrow for step 1 (mirrored screen: right) is drawn on the preview, centred on the cube
    expect(screen.getByTestId('rotation-arrow').getAttribute('data-direction')).toBe('right');
    expect(screen.getByTestId('scan-guide-panel').textContent).toMatch(/Right face/);
  });

  it('the cue is a block after the frame container, never inside it', () => {
    setLive({}, { stage: 'R', phase: 'rotating', step: 1 });
    render(<ScanningScreen />);
    const frameEl = screen.getByLabelText('Live camera preview').parentElement!;
    const cue = document.querySelector('[data-next-face="R"]')!;
    expect(frameEl.contains(cue)).toBe(false);
    expect(frameEl.compareDocumentPosition(cue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cue.className).not.toMatch(/absolute/);
  });

  it('the reference cube shows the next stage pose while rotating', () => {
    useScanStore.getState().captureFace('F', grid('green'), 'live');
    setLive({}, { stage: 'R', phase: 'rotating', step: 1 });
    render(<ScanningScreen />);
    const rot = JSON.parse(screen.getByTestId('cube-stub').getAttribute('data-rot')!);
    expect(rot).toEqual(scanGuide('R', { F: 'green', U: 'white' }).referenceRotation);
  });

  it('progress bar and hint are hidden once captured/rotating', () => {
    setLive({}, { stage: 'R', phase: 'rotating', step: 1, hint: 'old hint' });
    render(<ScanningScreen />);
    expect(screen.queryByRole('progressbar', { name: 'Hold steady' })).toBeNull();
    expect(screen.queryByText('old hint')).toBeNull();
  });

  it('stale detection boxes are shown only while aligning/stabilizing', () => {
    const withBox = { ...frame(), detections: [{ classId: 0, color: 'green' as const, confidence: 0.9, xyxy: [0, 0, 10, 10] as [number, number, number, number] }] };
    setLive({ lastResult: withBox });
    const { unmount } = render(<ScanningScreen />);
    expect(screen.getByTitle('green 90%')).toBeTruthy();
    unmount();
    setLive({ lastResult: withBox }, { stage: 'R', phase: 'rotating', step: 1 });
    render(<ScanningScreen />);
    expect(screen.queryByTitle('green 90%')).toBeNull();
  });

  it.each([360, 600, 900, 1280])('the guide square lies inside the 16:10 frame at %i px wide', (w) => {
    const h = (w * 10) / 16;
    const { square } = guideOverlay({ w: 1280, h: 720 }, { w, h }, null);
    expect(square!.x).toBeGreaterThanOrEqual(0);
    expect(square!.y).toBeGreaterThanOrEqual(0);
    expect(square!.x + square!.w).toBeLessThanOrEqual(w);
    expect(square!.y + square!.h).toBeLessThanOrEqual(h);
  });

  it('the cue replaces the status strip while rotating and is the only Saved status', () => {
    setLive({}, { stage: 'R', phase: 'rotating', step: 1 });
    render(<ScanningScreen />);
    const saved = screen.getAllByText(/Saved\. Rotate the whole cube along the arrow\./);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.closest('[role="status"]')).toBe(document.querySelector('[data-next-face="R"]'));
    expect(screen.queryByText(/Place the .* face inside the square/)).toBeNull();
  });

  it.each([['aligning'], ['stabilizing'], ['captured'], ['done']] as const)('the strip is present in %s', (phase) => {
    setLive({}, { phase });
    render(<ScanningScreen />);
    expect(document.querySelector('[data-next-face]')).toBeNull();
    const txt = { aligning: /Place the Front face/, stabilizing: /Place the Front face/, captured: /Saved\. Rotate/, done: /All six faces captured/ }[phase];
    expect(screen.getByText(txt).closest('[role="status"]')).toBeTruthy();
  });

  it('the cue and arrow need a pending step; none at the start pose', () => {
    render(<ScanningScreen />);
    expect(document.querySelector('[data-next-face]')).toBeNull();
    expect(screen.queryByTestId('rotation-arrow')).toBeNull();
  });

  it('the arrow and cue stay while aligning (no "Saved") and give way when the target centre is stable', () => {
    setLive({}, { stage: 'R', phase: 'aligning', step: 1 });
    const { unmount } = render(<ScanningScreen />);
    expect(screen.getByTestId('rotation-arrow')).toBeTruthy();
    expect(document.querySelector('[data-next-face="R"]')!.textContent).not.toContain('Saved.');
    unmount();
    const red = Array(9).fill('red') as never;
    setLive({}, { stage: 'R', phase: 'stabilizing', step: 1, streak: { grid: red, count: 2, since: 0 } });
    render(<ScanningScreen />);
    expect(screen.queryByTestId('rotation-arrow')).toBeNull();
    expect(document.querySelector('[data-next-face]')).toBeNull();
  });

  it('return step: the cue says nothing is scanned and the arrow points the table direction', () => {
    setLive({}, { stage: 'U', phase: 'aligning', step: 4 });
    render(<ScanningScreen />);
    expect(screen.getByText('No scan on this step.')).toBeTruthy();
    expect(screen.getAllByText('Next: green centre')).toHaveLength(2); // the cue and the reference-cube caption
    expect(screen.getByTestId('rotation-arrow').getAttribute('data-direction')).toBe('right');
  });

  it('the arrow is centred on the fitted face, which is mirrored together with the video', () => {
    setLive({}, { stage: 'R', phase: 'aligning', step: 1 });
    render(<ScanningScreen />);
    const arrow = screen.getByTestId('rotation-arrow');
    const zone = screen.getByTestId('guide-square');
    const cx = parseFloat(arrow.style.left) + parseFloat(arrow.style.width) / 2;
    expect(cx).toBeGreaterThan(parseFloat(zone.style.left));
    expect(cx).toBeLessThan(parseFloat(zone.style.left) + parseFloat(zone.style.width));
    expect(netMirror(arrow)).toBe(1);
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
    expect(screen.getByTestId('cube-stub').parentElement!.parentElement!.className).toContain('aspect-square');
  });

  describe('status strip', () => {
    const strip = (text: string) => screen.getByText(text).closest('[role="status"]');
    it('camera off', () => {
      h.cameraStatus = 'idle';
      setLive({ connection: 'idle' }); // the real hook is idle while the camera is off
      render(<ScanningScreen />);
      expect(strip('Enable the camera to start scanning')).toBeTruthy();
      expect(screen.queryByTestId('guide-square')).toBeNull();
      // idle is not a fault: the header must not claim the vision service is being waited for
      expect(screen.queryByText('Waiting for the vision service')).toBeNull();
      expect(screen.getByText('Auto-capture starts with the camera')).toBeTruthy();
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
    it('selecting the current uncaptured stage does not break and needs no rescan call', () => {
      const live = setLive();
      render(<ScanningScreen />);
      fireEvent.click(screen.getByTestId('face-card-F'));
      expect(live.rescan).not.toHaveBeenCalled();
      expect(useScanStore.getState().stageIndex).toBe(0);
      expect(useScanStore.getState().faceStatuses.F).toBe('scanning');
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

    it('coming back to a complete scan does not stop the camera or bounce to reconstruction', () => {
      vi.useFakeTimers();
      const live = setLive();
      for (const [f, c] of [['F', 'green'], ['R', 'red'], ['B', 'blue'], ['L', 'orange'], ['U', 'white'], ['D', 'yellow']] as const) {
        useScanStore.getState().captureFace(f, grid(c), 'live');
      }
      render(<ScanningScreen />);
      act(() => void vi.advanceTimersByTime(5000));
      expect(h.stop).not.toHaveBeenCalled();
      expect(useSessionStore.getState().screen).toBe('scanning');
      fireEvent.click(screen.getByTestId('face-card-R'));
      expect(live.rescan).toHaveBeenCalledWith('R', 'red');
      expect(useScanStore.getState().captured.R).toBeUndefined();
      act(() => void vi.advanceTimersByTime(5000));
      expect(useSessionStore.getState().screen).toBe('scanning');
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

describe('Live capture feedback wiring', () => {
  it('shows the confirmation when a live face is stored, not on mount', () => {
    useScanStore.getState().captureFace('F', grid('green'), 'live');
    setLive({}, { stage: 'R', phase: 'rotating', step: 1 });
    const { rerender } = render(<ScanningScreen />);
    expect(screen.queryByTestId('capture-check')).toBeNull();
    act(() => void useScanStore.getState().captureFace('R', grid('red'), 'live'));
    rerender(<ScanningScreen />);
    expect(screen.getByTestId('capture-check')).toBeTruthy();
  });
});
