// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return { RubiksCube3D: () => React.createElement('div', { 'data-testid': 'cube-stub' }) };
});

import { LandingScreen } from '@/features/landing/LandingScreen';
import { useCubeStore } from '@/stores/cube-store';
import { useSessionStore } from '@/stores/session-store';

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
      useSessionStore.setState({ mode: null, screen: 'landing' });
      fireEvent.click(b);
      expect(useSessionStore.getState().mode).toBe('live');
      expect(useSessionStore.getState().screen).toBe('scanning');
    }
  });

  it('"Try Interactive Demo" starts a demo session at Reconstruction and solves', async () => {
    render(<LandingScreen />);
    const buttons = screen.getAllByRole('button', { name: /try interactive demo/i });
    expect(buttons.length).toBe(2);
    for (const b of buttons) {
      useSessionStore.setState({ mode: null, screen: 'landing' });
      fireEvent.click(b);
      expect(useSessionStore.getState().mode).toBe('demo');
      expect(useSessionStore.getState().screen).toBe('reconstructing');
      await waitFor(() => expect(useCubeStore.getState().status).toBe('ready'));
    }
  });

  it('"Walk through the simulated scan" starts a demo session at Scanning', () => {
    render(<LandingScreen />);
    fireEvent.click(screen.getByRole('button', { name: /walk through the simulated scan/i }));
    expect(useSessionStore.getState().mode).toBe('demo');
    expect(useSessionStore.getState().screen).toBe('scanning');
  });

  it('shows no fabricated confidences and labels the hero as a simulation', () => {
    const { container } = render(<LandingScreen />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b0\.\d{2}\b/);
    expect(text).not.toContain('98.4');
    expect(text).toMatch(/Illustration — simulated detection/);
    expect(text).toMatch(/pre-computed/);
  });
});
