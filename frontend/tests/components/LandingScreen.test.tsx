// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return { RubiksCube3D: () => React.createElement('div', { 'data-testid': 'cube-stub' }) };
});

import { LandingScreen } from '@/features/landing/LandingScreen';
import { useCubeStore } from '@/stores/cube-store';
import { useScanStore } from '@/stores/scan-store';
import { useSessionStore } from '@/stores/session-store';
import { solveRequestGuard } from '@/stores/solve-guard';
import { demoFaces } from '@/demo/demo-fixtures';

/** Stale state from a previous session that every entry CTA must discard. */
function seedStale() {
  useScanStore.getState().captureFace('F', demoFaces(0).F, 'demo');
  useCubeStore.setState({ status: 'ready' });
  useSessionStore.setState({ mode: 'demo', screen: 'landing' });
  useSessionStore.getState().setGuidance(1234);
  return solveRequestGuard.begin();
}
function expectCleared(handle: { isCurrent(): boolean }) {
  expect(Object.keys(useScanStore.getState().captured)).toEqual([]);
  expect(useCubeStore.getState().status).not.toBe('ready');
  expect(useSessionStore.getState().guidance).toBeNull();
  expect(handle.isCurrent()).toBe(false);
}

beforeEach(() => {
  useSessionStore.setState({ mode: null, screen: 'landing' });
  useCubeStore.getState().reset();
});
afterEach(cleanup);

describe('LandingScreen entry points', () => {
  it('every "Scan My Cube" / "Start Solving" button starts a live scanning session', () => {
    render(<LandingScreen />);
    const buttons = screen.getAllByRole('button', { name: /scan my cube|start solving/i });
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const b of buttons) {
      const handle = seedStale();
      fireEvent.click(b);
      expect(useSessionStore.getState().mode).toBe('live');
      expect(useSessionStore.getState().screen).toBe('scanning');
      expectCleared(handle);
    }
  });

  it('"Try Interactive Demo" starts a demo session at Reconstruction and solves', async () => {
    render(<LandingScreen />);
    const buttons = screen.getAllByRole('button', { name: /try interactive demo/i });
    expect(buttons.length).toBe(2);
    for (const b of buttons) {
      const handle = seedStale();
      expect(useCubeStore.getState().status).toBe('ready');
      expect(Object.keys(useScanStore.getState().captured)).toContain('F');
      useScanStore.getState().setCondition('no_cube'); // stale scan condition must not survive either
      fireEvent.click(b);
      expect(useSessionStore.getState().mode).toBe('demo');
      expect(useSessionStore.getState().screen).toBe('reconstructing');
      expect(useSessionStore.getState().guidance).toBeNull();
      expect(handle.isCurrent()).toBe(false);
      // The stale 'ready' was cleared and a fresh solve is running; the scan store was reset, then refilled with all six.
      expect(useCubeStore.getState().status).toBe('solving');
      expect(Object.keys(useScanStore.getState().captured).sort()).toEqual(['B', 'D', 'F', 'L', 'R', 'U']);
      expect(useScanStore.getState().condition).toBe('captured_flash');
      await waitFor(() => expect(useCubeStore.getState().status).toBe('ready'));
      expect(useCubeStore.getState().solution).not.toBeNull();
      expect(useCubeStore.getState().solution?.source).toBe('demo-fixture');
    }
  });

  it('"Walk through the simulated scan" starts a demo session at Scanning', () => {
    render(<LandingScreen />);
    const handle = seedStale();
    fireEvent.click(screen.getByRole('button', { name: /walk through the simulated scan/i }));
    expect(useSessionStore.getState().mode).toBe('demo');
    expect(useSessionStore.getState().screen).toBe('scanning');
    expectCleared(handle);
  });

  it('makes no unmeasured performance claims (ms, fps, frame consensus, move averages)', () => {
    const { container } = render(<LandingScreen />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\d\s*ms/i);
    expect(text).not.toMatch(/\d\s*fps/i);
    expect(text).not.toMatch(/consensus/i);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+\s*frame/i);
    expect(text).not.toMatch(/≤\s*\d+\s*moves/i);
    expect(text).not.toMatch(/moves average/i);
    for (const metric of ['54 tiles · per-face detection', 'Frame-by-frame agreement check', 'Short, near-optimal solutions', 'Real-time PBR studio scene']) {
      expect(text).toContain(metric);
    }
  });

  it('shows no fabricated confidences and labels the hero as a simulation', () => {
    const { container } = render(<LandingScreen />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b0\.\d{2}\b/);
    expect(text).not.toContain('98.4');
    expect(text).toMatch(/Illustration — simulated detection/);
    expect(text).toMatch(/pre-computed/);
  });

  describe('hero illustration labelling', () => {
    const FABRICATED = /54\s*\/\s*54|\bvalid\b/i;
    const stage = () => screen.getByRole('tablist', { name: /hero visualization mode/i }).parentElement!.parentElement!;

    it.each(['Scanned Cube', 'Digital Twin'])('"%s" view is labelled an illustration with no validation claim', (tab) => {
      render(<LandingScreen />);
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      const text = stage().textContent ?? '';
      expect(text).toMatch(/Illustration/);
      expect(text).not.toMatch(FABRICATED);
    });

    it('the auto-cycle into the twin view is also labelled', () => {
      vi.useFakeTimers();
      try {
        render(<LandingScreen />);
        act(() => {
          vi.advanceTimersByTime(6500);
        });
        expect(screen.getByRole('tab', { name: 'Digital Twin' }).getAttribute('aria-selected')).toBe('true');
        const text = stage().textContent ?? '';
        expect(text).toMatch(/Illustration — simulated digital twin/);
        expect(text).not.toMatch(FABRICATED);
      } finally {
        vi.useRealTimers();
      }
    });

    it('caption is truncated so it cannot run under the tab switcher', () => {
      render(<LandingScreen />);
      const cap = screen.getByText(/^Illustration — simulated/);
      expect(cap.className).toMatch(/truncate/);
    });
  });
});
