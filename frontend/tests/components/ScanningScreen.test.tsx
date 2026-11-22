// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return { RubiksCube3D: () => React.createElement('div', { 'data-testid': 'cube-stub' }) };
});

import { ScanningScreen } from '@/features/scanner/ScanningScreen';
import { useCubeStore } from '@/stores/cube-store';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { useRubikStore } from '@/store/useRubikStore';
import type { FaceGrid } from '@/types/cube';
import { loadFixture } from '../services/fixtures';

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

beforeEach(() => {
  getUserMedia.mockReset();
  installMediaDevices();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ===================================================================================
describe('ScanningScreen - DEMO', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRubikStore.getState().startFreshScan(false); // demo session, condition 'loading_model'
  });

  it('labels the viewport "Simulated feed" and starts with an honest "Starting demo feed" overlay', () => {
    render(<ScanningScreen />);
    expect(screen.getByText('Simulated feed')).toBeTruthy();
    expect(screen.getByText(/Starting demo feed/)).toBeTruthy();
    expect(screen.queryByText(/Loading Vision Model/i)).toBeNull();
    expect(screen.queryByText(/YOLO/)).toBeNull();
  });

  it('shows colour codes only: no numeric confidence anywhere', async () => {
    const { container } = render(<ScanningScreen />);
    await advance(1500);
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
    await advance(1500);
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
    await advance(1500);
    expect(screen.queryByText(/Starting demo feed/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /open scanner settings/i }));
    fireEvent.click(screen.getByText('Simulated: Loading AI Model'));
    expect(screen.getByText(/Starting demo feed/)).toBeTruthy();
    await advance(500);
    expect(screen.getByText(/Starting demo feed/)).toBeTruthy();
    await advance(900);
    expect(screen.queryByText(/Starting demo feed/)).toBeNull();
  });

  it('every simulated condition renders without numbers; permission-denied offers no webcam retry', async () => {
    const { container } = render(<ScanningScreen />);
    await advance(1500);
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
    await advance(40_000);
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(6);
    expect(useSessionStore.getState().screen).toBe('reconstructing');
    expect(useCubeStore.getState().status).toBe('ready');
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('Restart Scan mid-script leaves no stale capture', async () => {
    render(<ScanningScreen />);
    await advance(3300); // mid-face-1, stability ~96 (capture would land at ~3.6 s)
    expect(useScanStore.getState().stability).toBeGreaterThan(60);
    fireEvent.click(screen.getByRole('button', { name: /restart scan/i }));
    expect(useScanStore.getState().stability).toBe(0);
    await advance(900); // still inside the fresh 1 s demo start-up
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(0);
    expect(useScanStore.getState().stageIndex).toBe(0);
  });

  it('unmounting clears the script: no capture after unmount', async () => {
    const { unmount } = render(<ScanningScreen />);
    await advance(3000);
    unmount();
    await advance(60_000);
    expect(Object.keys(useScanStore.getState().captured)).toHaveLength(0);
  });

  it('keeps Preview Scan States and Flag Right Face for Rescan (demo only)', async () => {
    render(<ScanningScreen />);
    await advance(1500);
    fireEvent.click(screen.getByRole('button', { name: /preview scan states/i }));
    fireEvent.click(screen.getByRole('button', { name: /flag right face for rescan/i }));
    expect(useScanStore.getState().faceStatuses.R).toBe('rescan');
  });

  it('selecting a captured card re-scans that face and shows the rescan note', async () => {
    render(<ScanningScreen />);
    await advance(5000);
    expect(useScanStore.getState().captured.F).toBeTruthy();
    expect(screen.queryByText(/Hold the cube as for this face's stage/)).toBeNull();
    await advance(1000); // flash over
    fireEvent.click(screen.getByText('Front').closest('button')!);
    expect(useScanStore.getState().captured.F).toBeUndefined();
    expect(useScanStore.getState().stageIndex).toBe(0);
    expect(
      screen.getByText("Hold the cube as for this face's stage — if unsure, use Restart Scan."),
    ).toBeTruthy();
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

  it('no backend: unavailable panel, capture disabled, no overlay, no picker, no fake loading', async () => {
    stubHealth(() => Promise.reject(new Error('down')));
    render(<ScanningScreen />);
    expect(await screen.findByText('Vision service is not running')).toBeTruthy();
    const capture = screen.queryByRole('button', { name: /capture face/i });
    if (capture) expect((capture as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryAllByTestId('detection-label')).toHaveLength(0);
    expect(screen.queryByText(/Simulate Computer Vision State/)).toBeNull();
    expect(screen.queryByRole('button', { name: /preview scan states/i })).toBeNull();
    expect(screen.queryByText(/Loading Vision Model/i)).toBeNull();
    expect(screen.queryByText(/Starting demo feed/i)).toBeNull();
    expect(screen.queryByText('Simulated feed')).toBeNull();
    expect(screen.queryByText(/confidence/i)).toBeNull();
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

  it('vision model missing: says so and that the solver is still usable', async () => {
    stubHealth(() => jsonResponse(loadFixture('health/model-unavailable.json')));
    render(<ScanningScreen />);
    expect(
      await screen.findByText('Vision model is not available — the solver is still usable'),
    ).toBeTruthy();
  });

  it('fixture detector: labelled banner, capture still disabled', async () => {
    stubHealth(() => jsonResponse(loadFixture('health/fixture-mode.json')));
    render(<ScanningScreen />);
    expect(await screen.findByText('Fixture detector — not real inference')).toBeTruthy();
    const capture = screen.getByRole('button', { name: /capture face/i }) as HTMLButtonElement;
    expect(capture.disabled).toBe(true);
    expect(screen.queryAllByTestId('detection-label')).toHaveLength(0);
  });

  it('a ready vision service still cannot capture in Phase 1', async () => {
    stubHealth(() => jsonResponse(loadFixture('health/ok.json')));
    render(<ScanningScreen />);
    await flushReal();
    const capture = screen.getByRole('button', { name: /capture face/i }) as HTMLButtonElement;
    expect(capture.disabled).toBe(true);
    expect(useScanStore.getState().stability).toBe(0);
  });

  it('guide names only the centres it knows (F green, U white, plus captured faces)', async () => {
    stubHealth(() => Promise.reject(new Error('down')));
    render(<ScanningScreen />);
    await flushReal();
    const panel = () => screen.getByTestId('scan-guide-panel');
    expect(panel().textContent).toMatch(/green center/);
    expect(panel().textContent).toMatch(/white center/);
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

    it('video is unmirrored and letterboxed (object-contain)', async () => {
      const { container } = render(<ScanningScreen />);
      const { stream } = fakeStream();
      getUserMedia.mockResolvedValue(stream);
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      const video = container.querySelector('video')!;
      expect(video).toBeTruthy();
      expect(video.className).toContain('object-contain');
      expect(video.className).not.toMatch(/scale-x|-scale|mirror|rotate-y/);
      expect(video.style.transform).toBe('');
      expect(video.srcObject).toBe(stream);
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

    it('permission denied: specific message, nothing left running', async () => {
      render(<ScanningScreen />);
      getUserMedia.mockRejectedValue({ name: 'NotAllowedError' });
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(screen.getByText('Camera permission was denied')).toBeTruthy();
    });

    it('no camera found shows its own message', async () => {
      render(<ScanningScreen />);
      getUserMedia.mockRejectedValue({ name: 'NotFoundError' });
      fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));
      await settle();
      expect(screen.getByText('No suitable camera was found')).toBeTruthy();
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
  });
});

describe('ScanningScreen - structure', () => {
  it('scan guide panel is its own component root', () => {
    vi.useFakeTimers();
    useRubikStore.getState().startFreshScan(false);
    render(<ScanningScreen />);
    const panel = screen.getByTestId('scan-guide-panel');
    expect(within(panel).getByText(/Face 1 of 6/)).toBeTruthy();
  });
});
