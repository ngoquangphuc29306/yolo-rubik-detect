// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ created: null as null | (() => void) }));
vi.mock('@react-three/fiber', async () => {
  const React = await import('react');
  return {
    Canvas: ({ onCreated }: { onCreated?: (s: unknown) => void }) => {
      React.useEffect(() => {
        h.created = () => onCreated?.({ gl: { domElement: document.createElement('canvas') } });
      });
      return React.createElement('div', { 'data-testid': 'canvas' });
    },
    useFrame: () => {},
    useThree: () => ({}),
  };
});
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null, RoundedBox: () => null }));
vi.mock('three/examples/jsm/environments/RoomEnvironment.js', () => ({ RoomEnvironment: class {} }));

import { RubiksCube3D, READY_FALLBACK_MS } from '@/components/three/RubiksCube3D';

const r = (p: Partial<React.ComponentProps<typeof RubiksCube3D>> = {}) =>
  render(<RubiksCube3D cubies={[]} className="w-full h-[340px]" {...p} />);

beforeEach(() => {
  vi.useFakeTimers();
  h.created = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RubiksCube3D loading skeleton', () => {
  it('shows an accessible skeleton before the canvas has rendered', () => {
    r();
    const sk = screen.getByTestId('cube-skeleton');
    expect(sk.getAttribute('role')).toBe('status');
    expect(sk.textContent).toContain('Preparing 3D view…');
  });

  it('removes the skeleton after the first rendered frames and keeps the wrapper class', () => {
    const { container } = r();
    const before = (container.firstElementChild as HTMLElement).className;
    act(() => h.created?.());
    expect(screen.getByTestId('cube-skeleton')).toBeTruthy(); // created is not yet a rendered frame
    act(() => void vi.advanceTimersByTime(100));
    expect(screen.queryByTestId('cube-skeleton')).toBeNull();
    expect((container.firstElementChild as HTMLElement).className).toBe(before);
  });

  it('positions the wrapper unless the caller already did', () => {
    const a = r({ className: 'w-full h-full' });
    expect((a.container.firstElementChild as HTMLElement).className).toMatch(/\brelative\b/);
    cleanup();
    const b = r({ className: 'absolute inset-0' });
    expect((b.container.firstElementChild as HTMLElement).className).not.toMatch(/relative/);
  });

  it('gives up waiting after a fallback delay so it can never stick', () => {
    r();
    act(() => void vi.advanceTimersByTime(READY_FALLBACK_MS));
    expect(screen.queryByTestId('cube-skeleton')).toBeNull();
  });

  it('pulses through a CSS class that reduced motion disables; no timers left after unmount', () => {
    const { unmount } = r();
    expect(screen.getByTestId('cube-skeleton').innerHTML).toMatch(/animate-skeleton-pulse/);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
