// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renders = vi.hoisted(() => ({ cube: 0, faceGrid: 0 }));
vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return {
    RubiksCube3D: () => {
      renders.cube++; // rendered once per ScanGuidePanel render
      return React.createElement('div', { 'data-testid': 'cube-stub' });
    },
  };
});
vi.mock('@/components/FaceGrid2D', async () => {
  const React = await import('react');
  return {
    FaceGrid2D: () => {
      renders.faceGrid++; // rendered 6x per CapturedFacesPanel render
      return React.createElement('div', { 'data-testid': 'face-grid-stub' });
    },
  };
});
// Delegating spy: the real capture still runs, the test can count scripted captures.
vi.mock('@/stores/demo-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/demo-session')>();
  return { ...actual, captureDemoFace: vi.fn(() => actual.captureDemoFace()) };
});
vi.mock('@/lib/audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/audio')>()),
  playCaptureSound: vi.fn(),
}));

import { playCaptureSound } from '@/lib/audio';
import { ScanningScreen } from '@/features/scanner/ScanningScreen';
import { DEMO_START_MS, FLASH_MS, TICK_MS, TICK_STEP } from '@/features/scanner/useDemoScanScript';
import { useCubeStore } from '@/stores/cube-store';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { captureDemoFace, startDemoScan } from '@/stores/demo-session';
import type { FaceGrid } from '@/types/cube';
import { loadFixture } from '../services/fixtures';

// ---- timing derived from the script's own constants ------------------------------
const TICKS_TO_CAPTURE = Math.ceil(100 / TICK_STEP) + 1; // fill the bar, then one tick to capture
const FACE_MS = TICKS_TO_CAPTURE * TICK_MS + FLASH_MS; // one full face incl. flash
const FIRST_CAPTURE_MS = DEMO_START_MS + TICKS_TO_CAPTURE * TICK_MS;
const ALL_FACES_MS = DEMO_START_MS + 6 * FACE_MS + 500;

// ---- fake camera: no real device is ever touched ---------------------------------
interface FakeTrack { stopped: boolean; stop: () => void }
const fakeStream = () => {
  const t: FakeTrack = { stopped: false, stop() { t.stopped = true; } };
  return { track: t, stream: { getTracks: () => [t] } as unknown as MediaStream };
};
const getUserMedia = vi.fn();
function installMediaDevices() {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
}

const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const flushReal = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const spyCapture = () => vi.mocked(captureDemoFace);

beforeEach(() => {
  getUserMedia.mockReset();
  installMediaDevices();
  vi.mocked(playCaptureSound).mockClear();
  vi.mocked(captureDemoFace).mockClear();
  renders.cube = 0;
  renders.faceGrid = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useScanStore.getState().reset();
  useCubeStore.getState().reset();
  useSessionStore.setState({ mode: null, screen: 'landing' });
});

// ===================================================================================
describe('ScanningScreen - DEMO', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startDemoScan(false); // demo session, condition 'loading_model'
  });

  it('labels the viewport "Simulated feed" and starts with an honest "Starting demo feed" overlay', () => {
    render(<ScanningScreen />);
    expect(screen.getByText('Simulated feed')).toBeTruthy();
    expect(screen.getByText(/Starting demo feed/)).toBeTruthy();
    expect(screen.queryByText(/Loading Vision Model/i)).toBeNull();
    expect(screen.queryByText(/YOLO/)).toBeNull();
    expect(screen.getByRole('img').getAttribute('alt')).toMatch(/^Simulated/);
  });

  it('shows colour codes only: no numeric confidence anywhere', async () => {
    const { container } = render(<ScanningScreen />);
    await advance(DEMO_START_MS + 1);
    const labels = screen.getAllByTestId('detection-label');
    expect(labels).toHaveLength(9);
    for (const l of labels) expect(l.textContent).toMatch(/^[WYGBRO]$/);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b\d\.\d{2}\b/);
    expect(text).not.toContain('98.2');
    expect(text).not.toMatch(/confidence[^a-z]*\d/i);
    expect(screen.getByText('Detection Confidence').nextElementSibling?.textContent).toBe('Simulated');
    expect(screen.getByText(/Demo: scripted stability/)).toBeTruthy();
  });

  it('has no real-webcam path: no toggle, no video, no camera request', async () => {
    const { container } = render(<ScanningScreen />);
    await advance(DEMO_START_MS + 1);
    fireEvent.click(screen.getByRole('button', { name: /open scanner settings/i }));
    expect(screen.queryByText(/Live Browser Webcam/)).toBeNull();
    expect(screen.queryByText(/Switch to Real Webcam/)).toBeNull();
    expect(screen.queryByText(/Use Simulated Feed/)).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByText('Simulate Computer Vision State')).toBeTruthy();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('the "Loading AI Model" picker option visibly shows the overlay, then recovers (N4)', async () => {
    render(<ScanningScreen />);
    await advance(DEMO_START_MS + 1);
    expect(screen.queryByText(/Starting demo feed/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /open scanner settings/i }));
    fireEvent.click(screen.getByText('Simulated: Loading AI Model'));
    expect(screen.getByText(/Starting demo feed/)).toBeTruthy();
    await advance(DEMO_START_MS / 2);
    expect(screen.getByText(/Starting demo feed/)).toBeTruthy();
    await advance(DEMO_START_MS / 2 + 1);
    expect(screen.queryByText(/Starting demo feed/)).toBeNull();
  });

  it('every simulated condition renders without numbers; permission-denied offers no webcam retry', async () => {
    const { container } = render(<ScanningScreen />);
    await advance(DEMO_START_MS + 1);
    for (const c of ['no_cube', 'missing_stickers', 'wrong_face', 'unstable', 'permission_denied'] as const) {
      act(() => useScanStore.getState().setCondition(c));
      expect(container.textContent).not.toMatch(/\b\d\.\d{2}\b/);
    }
    expect(screen.getByText('Camera Access Needed')).toBeTruthy();
    expect(screen.queryByText(/Retry Webcam Permission/)).toBeNull();
    expect(screen.getByText('Use Simulated Camera Feed')).toBeTruthy();
  });

  it('scripted auto-capture reaches six faces, then Reconstruction with a ready solution', async () => {
    render(<ScanningScreen />);
    await advance(ALL_FACES_MS);
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(6);
    expect(useSessionStore.getState().screen).toBe('reconstructing');
    expect(useCubeStore.getState().status).toBe('ready');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('Restart Scan mid-script leaves no stale capture', async () => {
    render(<ScanningScreen />);
    await advance(FIRST_CAPTURE_MS - 2 * TICK_MS); // bar nearly full, capture imminent
    expect(useScanStore.getState().stability).toBeGreaterThan(60);
    fireEvent.click(screen.getByRole('button', { name: /restart scan/i }));
    expect(useScanStore.getState().stability).toBe(0);
    await advance(DEMO_START_MS - 100); // still inside the fresh demo start-up
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(0);
    expect(useScanStore.getState().stageIndex).toBe(0);
  });

  it('unmounting clears the script: no capture after unmount', async () => {
    const { unmount } = render(<ScanningScreen />);
    await advance(FIRST_CAPTURE_MS - 2 * TICK_MS);
    unmount();
    await advance(60_000);
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(0);
  });

  it('StrictMode double-mount runs exactly one capture sequence', async () => {
    const spy = spyCapture();
    render(<StrictMode><ScanningScreen /></StrictMode>);
    await advance(ALL_FACES_MS);
    expect(spy).toHaveBeenCalledTimes(6);
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(6);
  });

  it('plays the capture sound once per capture, even if sound is toggled mid-flash', async () => {
    render(<ScanningScreen />);
    await advance(FIRST_CAPTURE_MS + 10);
    expect(useScanStore.getState().condition).toBe('captured_flash');
    expect(playCaptureSound).toHaveBeenCalledTimes(1);
    act(() => useSessionStore.getState().toggleSound());
    act(() => useSessionStore.getState().toggleSound());
    await advance(FLASH_MS / 2);
    expect(playCaptureSound).toHaveBeenCalledTimes(1);
    await advance(FACE_MS); // next face captured
    expect(playCaptureSound).toHaveBeenCalledTimes(2);
  });

  it('plays the capture sound once per capture under StrictMode', async () => {
    render(<StrictMode><ScanningScreen /></StrictMode>);
    await advance(FIRST_CAPTURE_MS + 10);
    expect(playCaptureSound).toHaveBeenCalledTimes(1);
  });

  it('keeps Preview Scan States and Flag Right Face for Rescan (demo only)', async () => {
    render(<ScanningScreen />);
    await advance(DEMO_START_MS + 1);
    fireEvent.click(screen.getByRole('button', { name: /preview scan states/i }));
    fireEvent.click(screen.getByRole('button', { name: /flag right face for rescan/i }));
    expect(useScanStore.getState().faceStatuses.R).toBe('rescan');
  });

  it('selecting a captured card re-scans that face and shows the rescan note', async () => {
    render(<ScanningScreen />);
    await advance(FACE_MS + DEMO_START_MS);
    expect(useScanStore.getState().captured.F).toBeTruthy();
    expect(screen.queryByText(/Hold the cube as for this face's stage/)).toBeNull();
    fireEvent.click(screen.getByTestId('face-card-F'));
    expect(useScanStore.getState().captured.F).toBeUndefined();
    expect(useScanStore.getState().stageIndex).toBe(0);
    expect(
      screen.getByText("Hold the cube as for this face's stage — if unsure, use Restart Scan."),
    ).toBeTruthy();
  });

  describe('accessibility', () => {
    it('stability bar is a labelled progressbar that tracks the value', async () => {
      render(<ScanningScreen />);
      await advance(DEMO_START_MS + 3 * TICK_MS + 10);
      const bar = screen.getByRole('progressbar', { name: /stability/i });
      expect(bar.getAttribute('aria-valuemin')).toBe('0');
      expect(bar.getAttribute('aria-valuemax')).toBe('100');
      expect(bar.getAttribute('aria-valuenow')).toBe(String(useScanStore.getState().stability));
      expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    });

    it('demo toasts are live regions', async () => {
      render(<ScanningScreen />);
      await advance(DEMO_START_MS + 1);
      for (const [c, text] of [
        ['no_cube', /No cube detected/],
        ['wrong_face', /Expected/],
        ['captured_flash', /Face captured cleanly/],
      ] as const) {
        act(() => useScanStore.getState().setCondition(c));
        expect(screen.getByText(text).closest('[role="status"]')).toBeTruthy();
      }
    });
  });

  describe('render isolation', () => {
    it('a stability tick does not re-render the guide or captured-faces panels', async () => {
      render(<ScanningScreen />);
      await advance(DEMO_START_MS + 2 * TICK_MS + 10);
      const before = useScanStore.getState().stability;
      const cube = renders.cube;
      const grids = renders.faceGrid;
      expect(cube).toBeGreaterThan(0);
      await advance(3 * TICK_MS);
      expect(useScanStore.getState().stability).toBeGreaterThan(before);
      expect(renders.cube).toBe(cube);
      expect(renders.faceGrid).toBe(grids);
    });
  });
});

// ===================================================================================
describe('ScanningScreen - no session', () => {
  it('mode null shows a neutral state, never the live panel, and can start a demo', () => {
    useSessionStore.setState({ mode: null, screen: 'scanning' });
    render(<ScanningScreen />);
    expect(screen.getByText('No scan session')).toBeTruthy();
    expect(screen.queryByText(/Checking vision service/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /start demo scan/i }));
    expect(useSessionStore.getState().mode).toBe('demo');
  });
});

// ===================================================================================
describe('ScanningScreen - LIVE', () => {
  const stubHealth = (impl: () => Promise<unknown>) => {
    const f = vi.fn(impl);
    vi.stubGlobal('fetch', f);
    return f;
  };
  const jsonResponse = (body: unknown) =>
    Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify(body)) });

  beforeEach(() => {
    useSessionStore.getState().startSession('live', 'scanning');
  });

  it('no backend: unavailable panel, no capture button, no overlay, no picker, no fake loading', async () => {
    stubHealth(() => Promise.reject(new Error('down')));
    render(<ScanningScreen />);
    expect(await screen.findByText('Vision service is not running')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /capture face/i })).toBeNull();
    expect(screen.queryAllByTestId('detection-label')).toHaveLength(0);
    expect(screen.queryByText(/Simulate Computer Vision State/)).toBeNull();
    expect(screen.queryByRole('button', { name: /preview scan states/i })).toBeNull();
    expect(screen.queryByText(/Loading Vision Model/i)).toBeNull();
    expect(screen.queryByText(/Starting demo feed/i)).toBeNull();
    expect(screen.queryByText('Simulated feed')).toBeNull();
    expect(screen.queryByText(/confidence/i)).toBeNull();
  });

  it('the footer is a status strip, with no Capture button and no "Capture unavailable" text', async () => {
    stubHealth(() => Promise.reject(new Error('down')));
    render(<ScanningScreen />);
    await flushReal();
    expect(screen.queryByRole('button', { name: /capture face/i })).toBeNull();
    expect(screen.queryByText(/Capture unavailable/)).toBeNull();
    expect(screen.getByText('Enable the camera to start scanning').closest('[role="status"]')).toBeTruthy();
  });

  it('Retry re-checks the backend', async () => {
    const f = stubHealth(() => Promise.reject(new Error('down')));
    render(<ScanningScreen />);
    await screen.findByText('Vision service is not running');
    expect(f).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await flushReal();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('Restart Scan also re-checks the backend', async () => {
    const f = stubHealth(() => Promise.reject(new Error('down')));
    render(<ScanningScreen />);
    await screen.findByText('Vision service is not running');
    fireEvent.click(screen.getByRole('button', { name: /restart scan/i }));
    await flushReal();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('vision model missing: says so and that the solver is still usable', async () => {
    stubHealth(() => jsonResponse(loadFixture('health/model-unavailable.json')));
    render(<ScanningScreen />);
    expect(
      await screen.findByText('Vision model is not available — the solver is still usable'),
    ).toBeTruthy();
  });

  it('fixture detector: labelled banner and no capture control', async () => {
    stubHealth(() => jsonResponse(loadFixture('health/fixture-mode.json')));
    render(<ScanningScreen />);
    expect(await screen.findByText('Fixture detector — not real inference')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /capture face/i })).toBeNull();
    expect(screen.queryAllByTestId('detection-label')).toHaveLength(0);
  });

  it('a ready vision service shows no unavailable panel and nothing is captured before the camera is on', async () => {
    stubHealth(() => jsonResponse(loadFixture('health/ok.json')));
    render(<ScanningScreen />);
    await flushReal();
    expect(screen.queryByText(/Vision service is connected/)).toBeNull();
    expect(screen.queryByText(/not available in this version/)).toBeNull();
    expect(screen.queryByText(/Checking vision service/)).toBeNull();
    expect(screen.queryByRole('button', { name: /capture face/i })).toBeNull();
    expect(useScanStore.getState().stability).toBe(0);
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(0);
  });

  it('guide names only the centres it knows (F green, U white, plus captured faces)', async () => {
    stubHealth(() => Promise.reject(new Error('down')));
    render(<ScanningScreen />);
    await flushReal();
    const panel = () => screen.getByTestId('scan-guide-panel');
    expect(panel().textContent).toMatch(/green cent(er|re)/);
    expect(panel().textContent).toMatch(/white cent(er|re)/);
    expect(panel().textContent).not.toMatch(/\b(red|blue|orange|yellow)\b/i);
    const greenFace = Array(9).fill('green') as unknown as FaceGrid;
    act(() => { useScanStore.getState().captureFace('F', greenFace, 'live'); });
    expect(panel().textContent).not.toMatch(/\b(red|blue|orange|yellow)\b/i);
  });

  describe('camera', () => {
    beforeEach(() => {
      stubHealth(() => Promise.reject(new Error('down')));
    });

    it('is never requested on mount; "Enable camera" requests exactly once', async () => {
      render(<ScanningScreen />);
      await flushReal();
      expect(getUserMedia).not.toHaveBeenCalled();
      const { stream } = fakeStream();
      getUserMedia.mockResolvedValue(stream);
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(getUserMedia).toHaveBeenCalledTimes(1);
    });

    it('video is mirrored for display only, letterboxed (object-contain) and labelled', async () => {
      const { container } = render(<ScanningScreen />);
      const { stream } = fakeStream();
      getUserMedia.mockResolvedValue(stream);
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      const video = container.querySelector('video')!;
      expect(video).toBeTruthy();
      expect(video.className).toContain('object-contain');
      expect(video.style.transform).toBe('scaleX(-1)'); // display only; the crop sent to the backend is unmirrored
      expect(video.srcObject).toBe(stream);
      expect(video.getAttribute('aria-label')).toMatch(/camera/i);
    });

    it('while requesting: polite status, and the SAME button stays mounted, disabled, focusable', async () => {
      render(<ScanningScreen />);
      getUserMedia.mockReturnValue(new Promise(() => {})); // never settles
      const btn = screen.getByRole('button', { name: /enable camera/i });
      btn.focus();
      fireEvent.click(btn);
      await settle();
      const same = screen.getByRole('button', { name: /requesting camera/i });
      expect(same).toBe(btn);
      expect(same.getAttribute('aria-disabled')).toBe('true');
      expect(document.activeElement).toBe(btn);
      fireEvent.click(same); // inert while requesting
      expect(getUserMedia).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Waiting for camera permission/).closest('[role="status"]')).toBeTruthy();
    });

    it('unmount stops every track', async () => {
      const { unmount } = render(<ScanningScreen />);
      const f = fakeStream();
      getUserMedia.mockResolvedValue(f.stream);
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(f.track.stopped).toBe(false);
      unmount();
      expect(f.track.stopped).toBe(true);
    });

    it('permission denied: specific message announced as an alert', async () => {
      render(<ScanningScreen />);
      getUserMedia.mockRejectedValue({ name: 'NotAllowedError' });
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(screen.getByRole('alert').textContent).toContain('Camera permission was denied');
    });

    it('no camera found: its own message, announced as an alert', async () => {
      render(<ScanningScreen />);
      getUserMedia.mockRejectedValue({ name: 'NotFoundError' });
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(screen.getByRole('alert').textContent).toContain('No suitable camera was found');
    });

    it('generic camera error is announced as an alert', async () => {
      render(<ScanningScreen />);
      getUserMedia.mockRejectedValue({ name: 'AbortError', message: 'boom' });
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(screen.getByRole('alert').textContent).toContain('Could not start the camera');
    });

    it('header camera status is a polite live region', async () => {
      render(<ScanningScreen />);
      const status = screen.getByText('Camera Off');
      expect(status.closest('[role="status"]')).toBeTruthy();
    });

    it('leaving the screen stops the tracks', async () => {
      render(<ScanningScreen />);
      const f = fakeStream();
      getUserMedia.mockResolvedValue(f.stream);
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(f.track.stopped).toBe(false);
      act(() => useSessionStore.getState().setScreen('reconstructing'));
      expect(f.track.stopped).toBe(true);
    });

    it('Restart Scan stops the camera and stays in a live session', async () => {
      render(<ScanningScreen />);
      const f = fakeStream();
      getUserMedia.mockResolvedValue(f.stream);
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /restart scan/i }));
      expect(f.track.stopped).toBe(true);
      expect(useSessionStore.getState().mode).toBe('live');
      expect(useSessionStore.getState().screen).toBe('scanning');
    });

    it('restart while requesting: the late superseded stream is stopped, exactly one stays live', async () => {
      render(<ScanningScreen />);
      const a = fakeStream();
      const b = fakeStream();
      let resolveA!: (s: MediaStream) => void;
      let resolveB!: (s: MediaStream) => void;
      getUserMedia
        .mockReturnValueOnce(new Promise<MediaStream>((r) => { resolveA = r; }))
        .mockReturnValueOnce(new Promise<MediaStream>((r) => { resolveB = r; }));
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /restart scan/i })); // supersedes request A
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(getUserMedia).toHaveBeenCalledTimes(2);
      await act(async () => { resolveA(a.stream); await Promise.resolve(); });
      expect(a.track.stopped).toBe(true);
      await act(async () => { resolveB(b.stream); await Promise.resolve(); });
      expect(b.track.stopped).toBe(false);
      expect([a, b].filter((x) => !x.track.stopped)).toHaveLength(1);
    });
  });
});

// ===================================================================================
describe('ScanningScreen - mode transition', () => {
  it('demo -> live in one mounted screen: no scripted labels, no capture, no demo timers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    startDemoScan(false);
    const spy = spyCapture();
    render(<ScanningScreen />);
    await advance(FIRST_CAPTURE_MS - 2 * TICK_MS); // demo script mid-stability
    expect(screen.getAllByTestId('detection-label').length).toBeGreaterThan(0);

    act(() => useSessionStore.getState().startSession('live', 'scanning'));
    expect(screen.queryAllByTestId('detection-label')).toHaveLength(0);
    expect(screen.queryByText('Simulated feed')).toBeNull();
    await advance(60_000);
    expect(spy).not.toHaveBeenCalled();
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(0);
    expect(useScanStore.getState().stability).toBe(0);
    expect(screen.queryAllByTestId('detection-label')).toHaveLength(0);
  });
});

describe('ScanningScreen - structure', () => {
  it('scan guide panel is its own component root', () => {
    vi.useFakeTimers();
    startDemoScan(false);
    render(<ScanningScreen />);
    const panel = screen.getByTestId('scan-guide-panel');
    expect(within(panel).getByText(/Face 1 of 6/)).toBeTruthy();
  });
});
