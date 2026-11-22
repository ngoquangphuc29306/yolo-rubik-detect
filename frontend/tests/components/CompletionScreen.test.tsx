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
vi.mock('canvas-confetti', () => ({ default: Object.assign(vi.fn(), { reset: vi.fn() }) }));
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
import { useScanStore } from '@/stores/scan-store';
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

  it('fires exactly 1 confetti call on confirm and 3 after the 220 ms follow-up; chime respects soundEnabled', () => {
    vi.useFakeTimers();
    load(['R', 'U'], 12400);
    render(<CompletionScreen />);
    confirm();
    expect(confetti).toHaveBeenCalledTimes(1);
    expect(playSuccessChime).toHaveBeenCalledTimes(1);
    expect(playSuccessChime).toHaveBeenCalledWith(true);
    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(confetti).toHaveBeenCalledTimes(3);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(confetti).toHaveBeenCalledTimes(3);
    expect(playSuccessChime).toHaveBeenCalledTimes(1);
  });

  it('a second confirm attempt in the same batch (stale button) fires nothing more', () => {
    vi.useFakeTimers();
    load(['R'], 5000);
    render(<CompletionScreen />);
    const btn = screen.getByRole('button', { name: /My Cube Is Solved/ });
    act(() => {
      btn.click();
      btn.click();
    });
    expect(confetti).toHaveBeenCalledTimes(1);
    expect(playSuccessChime).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(confetti).toHaveBeenCalledTimes(3);
    expect(playSuccessChime).toHaveBeenCalledTimes(1);
  });

  it('unmounting before 220 ms cancels the follow-up bursts and resets confetti', () => {
    vi.useFakeTimers();
    load(['R'], 5000);
    const { unmount } = render(<CompletionScreen />);
    confirm();
    expect(confetti).toHaveBeenCalledTimes(1);
    unmount();
    expect(confetti.reset).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(confetti).toHaveBeenCalledTimes(1);
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
    load(['R'], null);
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

  it('0 moves: already-solved copy, no claim that guidance ran', () => {
    load([], null);
    render(<CompletionScreen />);
    expect(screen.getByText('Already solved')).toBeTruthy();
    expect(screen.getByText('Your cube was already solved — no moves needed')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/completed the guidance|Guidance Complete|100%/i);
    expect(screen.getByText('Total Moves').nextSibling?.textContent).toBe('0');
    expect(screen.getByText('Guidance Time').parentElement?.textContent).toMatch(/—$/);
  });

  it('confirmation message is a status region and focus moves to the heading', () => {
    load(['R', 'U'], 5000);
    render(<CompletionScreen />);
    confirm();
    expect(screen.getByRole('status').textContent).toMatch(/You confirmed all 54 stickers/);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(h1);
  });

  it('Guidance Time has a screen-reader disclaimer beside it', () => {
    load(['R'], 5000);
    render(<CompletionScreen />);
    const sr = screen.getByText(/Time the on-screen guidance ran, not the time to solve a physical cube/);
    expect(sr.className).toMatch(/sr-only/);
  });

  it('rounds playbackMs to whole seconds (59.5 s shows 1:00)', () => {
    load(['R'], 59500);
    render(<CompletionScreen />);
    expect(screen.getByText('1:00')).toBeTruthy();
  });
});

describe('CompletionScreen restart buttons are mode-aware', () => {
  const pre = [/^Scan Again$/, /Solve Another Cube/];
  const clickPre = (i: number) => fireEvent.click(screen.getAllByRole('button', { name: pre[i] })[0]);
  const clickPost = (name: RegExp) => {
    confirm();
    fireEvent.click(screen.getAllByRole('button', { name })[0]);
  };
  const sites: [string, boolean, () => void][] = [
    ['Scan Again (before confirm)', true, () => clickPre(0)],
    ['Solve Another Cube link (before confirm)', true, () => clickPre(1)],
    ['Solve Another Cube (after confirm)', true, () => clickPost(/Solve Another Cube/)],
    ['Scan Again (after confirm)', false, () => clickPost(/^Scan Again$/)],
  ];

  it.each(sites)('LIVE: %s restarts a live scan, seed unchanged, no demo capture', (_n, _adv, click) => {
    load(['R', 'U'], 12400, 'live');
    useSessionStore.setState({ demoSeed: 1 });
    render(<CompletionScreen />);
    click();
    expect(useSessionStore.getState()).toMatchObject({ mode: 'live', screen: 'scanning', demoSeed: 1 });
    expect(useScanStore.getState().captured).toEqual({});
  });

  it.each(sites)('DEMO: %s starts a demo scan; seed advances only where it did before', (_n, advances, click) => {
    load(['R', 'U'], 12400, 'demo');
    useSessionStore.setState({ demoSeed: 1 });
    render(<CompletionScreen />);
    click();
    expect(useSessionStore.getState()).toMatchObject({ mode: 'demo', screen: 'scanning', demoSeed: advances ? 2 : 1 });
  });
});
