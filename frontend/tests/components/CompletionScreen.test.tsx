// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CenterColors, FaceletState, MoveToken } from '@/types/cube';

const cube = vi.hoisted(() => ({ props: null as null | Record<string, any> }));
vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return {
    RubiksCube3D: (props: Record<string, any>) => {
      cube.props = props;
      return React.createElement('div', { 'data-testid': 'cube-stub', 'data-mode': props.mode });
    },
  };
});
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('@/lib/audio', () => ({
  playMoveSound: vi.fn(),
  playCaptureSound: vi.fn(),
  playCountdownTick: vi.fn(),
  playSuccessChime: vi.fn(),
}));

import confetti from 'canvas-confetti';
import { playSuccessChime } from '@/lib/audio';
import { CompletionScreen } from '@/features/solver/CompletionScreen';
import { applyMove, buildSnapshots } from '@/engine/move-engine';
import { SOLVED } from '@/engine/cube-state';
import { toCubies } from '@/engine/cubie-adapter';
import { useCubeStore } from '@/stores/cube-store';
import { useSessionStore } from '@/stores/session-store';

const CENTERS: CenterColors = { U: 'red', R: 'blue', F: 'white', D: 'orange', L: 'green', B: 'yellow' };
const invert = (m: MoveToken): MoveToken =>
  (m.endsWith("'") ? m[0] : m.endsWith('2') ? m : `${m}'`) as MoveToken;

function load(moves: readonly MoveToken[], playbackMs: number | null, mode: 'demo' | 'live' = 'live') {
  let state = SOLVED as FaceletState;
  for (const m of [...moves].reverse()) state = applyMove(state, invert(m));
  const solution = { state, centers: CENTERS, moves, snapshots: buildSnapshots(state, moves), source: 'demo-fixture' as const };
  act(() => {
    useCubeStore.getState().setReady(solution);
    useSessionStore.setState({ screen: 'completion', mode });
    if (playbackMs !== null) useSessionStore.getState().setGuidance(playbackMs);
  });
  return solution;
}
const mockReduced = (reduced: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduced && q.includes('reduce'), media: q }));
const confirm = () => fireEvent.click(screen.getByRole('button', { name: /My Cube Is Solved/ }));

beforeEach(() => {
  cube.props = null;
  useSessionStore.getState().startSession('demo', 'completion');
  mockReduced(false);
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CompletionScreen', () => {
  it('fires no confetti and no chime on mount', () => {
    vi.useFakeTimers();
    load(['R', 'U'], 12400);
    render(<CompletionScreen />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(confetti).not.toHaveBeenCalled();
    expect(playSuccessChime).not.toHaveBeenCalled();
  });

  it('fires confetti after confirm, not again on a repeat click; chime respects soundEnabled', () => {
    vi.useFakeTimers();
    load(['R', 'U'], 12400);
    render(<CompletionScreen />);
    confirm();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const n = vi.mocked(confetti).mock.calls.length;
    expect(n).toBeGreaterThan(0);
    expect(playSuccessChime).toHaveBeenCalledTimes(1);
    expect(playSuccessChime).toHaveBeenCalledWith(true);
    // the confirm button is gone, so a repeat click is impossible
    expect(screen.queryByRole('button', { name: /My Cube Is Solved/ })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(vi.mocked(confetti).mock.calls.length).toBe(n);
    expect(playSuccessChime).toHaveBeenCalledTimes(1);
  });

  it('a repeat confirm click cannot fire a second burst', () => {
    vi.useFakeTimers();
    load(['R'], 5000);
    render(<CompletionScreen />);
    const btn = screen.getByRole('button', { name: /My Cube Is Solved/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(playSuccessChime).toHaveBeenCalledTimes(1);
  });

  it('respects soundEnabled=false', () => {
    load(['R'], 5000);
    act(() => useSessionStore.getState().toggleSound());
    render(<CompletionScreen />);
    confirm();
    expect(playSuccessChime).toHaveBeenCalledWith(false);
  });

  it('fires no confetti under reduced motion', () => {
    vi.useFakeTimers();
    mockReduced(true);
    load(['R'], 5000);
    render(<CompletionScreen />);
    confirm();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(confetti).not.toHaveBeenCalled();
  });

  it('pre-confirm copy makes no confirmed or verified claim; post-confirm has the confirmation sentence', () => {
    load(['R', 'U'], 5000);
    render(<CompletionScreen />);
    expect(screen.getByText('Guidance Complete')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/confirmed|verified|54 stickers/i);
    confirm();
    expect(screen.getByText(/You confirmed your cube is solved/)).toBeTruthy();
    expect(screen.getByText(/You confirmed all 54 stickers are solved after 2 moves/)).toBeTruthy();
  });

  it.each([
    [12400, '0:12'],
    [72000, '1:12'],
    [10000, '0:10'],
  ])('Guidance Time equals playbackMs (%i ms -> %s), unpadded', (ms, text) => {
    load(['R', 'U', 'F', 'B', 'L', 'D'], ms);
    render(<CompletionScreen />);
    expect(screen.getByText('Guidance Time')).toBeTruthy();
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText('Guidance Time').getAttribute('title')).toMatch(/not the time to solve a physical cube/);
  });

  it('shows an em dash when guidance is null', () => {
    load([], null);
    render(<CompletionScreen />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders the final snapshot with the session centres in solved mode', () => {
    const s = load(['R', 'U'], 5000);
    render(<CompletionScreen />);
    expect(cube.props?.mode).toBe('solved');
    expect(cube.props?.cubies).toEqual(toCubies(s.snapshots[s.snapshots.length - 1], s.centers));
  });

  it('demo mode copy and badges', () => {
    load(['R'], 5000, 'demo');
    render(<CompletionScreen />);
    expect(screen.getByText('Demo guidance complete')).toBeTruthy();
    expect(screen.getByText(/demo cube with a pre-computed solution/i)).toBeTruthy();
    expect(screen.getByText('Digital twin')).toBeTruthy();
    expect(screen.getByText('Digital twin: solved')).toBeTruthy();
  });

  it('Replay Solution goes to alignment', () => {
    load(['R'], 5000);
    render(<CompletionScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Replay Solution/ }));
    expect(useSessionStore.getState().screen).toBe('alignment');
  });

  it('shows a neutral empty state with no solution', () => {
    render(<CompletionScreen />);
    expect(screen.getByText(/No solution available/)).toBeTruthy();
    expect(cube.props).toBeNull();
  });
});
