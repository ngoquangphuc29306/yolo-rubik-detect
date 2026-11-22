// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CenterColors, FaceletState, MoveToken } from '@/types/cube';

const cube = vi.hoisted(() => ({
  props: null as null | Record<string, any>,
  mounts: 0,
  unmounts: 0,
}));

vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return {
    RubiksCube3D: (props: Record<string, any>) => {
      cube.props = props;
      React.useEffect(() => {
        cube.mounts++;
        return () => {
          cube.unmounts++;
        };
      }, []);
      return React.createElement('div', { 'data-testid': 'cube-stub', 'data-mode': props.mode });
    },
  };
});
vi.mock('@/lib/audio', () => ({
  playMoveSound: vi.fn(),
  playCaptureSound: vi.fn(),
  playCountdownTick: vi.fn(),
  playSuccessChime: vi.fn(),
}));

import { SolvingScreen } from '@/features/solver/SolvingScreen';
import { applyMove, buildSnapshots } from '@/engine/move-engine';
import { SOLVED } from '@/engine/cube-state';
import { useCubeStore } from '@/stores/cube-store';
import { useSessionStore } from '@/stores/session-store';
import { startDemoScan } from '@/stores/demo-session';

// ---- fake clock / rAF / visibility (same approach as tests/hooks/usePlayback.test.tsx) ----
let now = 0;
let nextId = 1;
let queue = new Map<number, FrameRequestCallback>();
let visibility: 'visible' | 'hidden' = 'visible';

function frame(dtMs = 16) {
  now += dtMs;
  const cbs = [...queue.values()];
  queue.clear();
  act(() => {
    for (const cb of cbs) cb(now);
  });
}
/** Advance by total ms in 16 ms frames (last one shorter). */
function run(totalMs: number) {
  let left = totalMs;
  while (left > 0) {
    const dt = Math.min(16, left);
    frame(dt);
    left -= dt;
  }
}
function setVisibility(v: 'visible' | 'hidden') {
  visibility = v;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

// Non-demo centres (demo is green front / white top / red right).
const CENTERS: CenterColors = { U: 'red', R: 'blue', F: 'white', D: 'orange', L: 'green', B: 'yellow' };
const invert = (m: MoveToken): MoveToken =>
  (m.endsWith("'") ? m[0] : m.endsWith('2') ? m : `${m}'`) as MoveToken;

function loadSolution(moves: readonly MoveToken[], centers: CenterColors = CENTERS) {
  let state = SOLVED as FaceletState;
  for (const m of [...moves].reverse()) state = applyMove(state, invert(m));
  const solution = {
    state,
    centers,
    moves,
    snapshots: buildSnapshots(state, moves),
    source: 'demo-fixture' as const,
  };
  act(() => {
    useSessionStore.setState({ screen: 'solving', mode: 'demo' });
    useCubeStore.getState().setReady(solution);
  });
  return solution;
}
const setDelay = (ms: number) =>
  useSessionStore.setState((s) => ({ settings: { ...s.settings, delayMs: ms } }));

const ring = () => Number(screen.getByTestId('ring-progress').getAttribute('stroke-dashoffset'));
const ringLabel = () => screen.getByTestId('ring-label').textContent;
const ringText = () => screen.getByTestId('ring-center').textContent ?? '';
const dockButton = (name: RegExp | string) => screen.getByRole('button', { name });

beforeEach(() => {
  now = 1000;
  nextId = 1;
  queue = new Map();
  visibility = 'visible';
  cube.props = null;
  cube.mounts = 0;
  cube.unmounts = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  useSessionStore.getState().startSession('demo', 'solving');
  setDelay(2000);
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const M2: readonly MoveToken[] = ['R', 'U2'];

describe('SolvingScreen: controls', () => {
  it('has no Previous/Next controls (D3-B)', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    expect(screen.queryByRole('button', { name: /previous|next/i })).toBeNull();
    expect(screen.queryByLabelText(/previous move|next move/i)).toBeNull();
  });

  it('shows Pause, Replay, Pace, Angle Lock, Sound and Scan again', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    expect(dockButton(/^pause$/i)).toBeTruthy();
    expect(dockButton(/replay/i)).toBeTruthy();
    expect(screen.getByLabelText('Solving delay in seconds')).toBeTruthy();
    expect(dockButton(/angle locked/i)).toBeTruthy();
    expect(dockButton(/mute sound effects/i)).toBeTruthy();
    expect(dockButton(/lost track\? scan again\./i)).toBeTruthy();
  });

  it('the sound button writes the session setting', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    fireEvent.click(dockButton(/mute sound effects/i));
    expect(useSessionStore.getState().settings.soundEnabled).toBe(false);
    expect(dockButton(/enable sound effects/i)).toBeTruthy();
  });

  it('the angle lock toggles to free orbit and back', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    expect(cube.props!.lockCameraAngle).toBe(true);
    fireEvent.click(dockButton(/angle locked/i));
    expect(cube.props!.lockCameraAngle).toBe(false);
    expect(dockButton(/free orbit/i)).toBeTruthy();
  });
});

describe('SolvingScreen: renderer wiring', () => {
  it('passes snapshots, activeMoves and frameRef; no legacy animation props; cube keyed on the solution', () => {
    const sol = loadSolution(M2);
    render(<SolvingScreen />);
    const p = cube.props!;
    expect(p.snapshots).toHaveLength(sol.snapshots.length);
    expect(p.activeMoves.map((m: { notation: string }) => m.notation)).toEqual(M2);
    expect(p.frameRef.current.status).toBe('animating');
    expect(p.animateMoveTrigger).toBeUndefined();
    expect(p.onMoveAnimationComplete).toBeUndefined();
    expect(p.activeMove).toBeUndefined();
    expect(p.cameraPosition).toEqual([5.2, 4.3, 7.6]);
    expect(cube.mounts).toBe(1);
    loadSolution(['F']); // new solution identity
    expect(cube.mounts).toBe(2);
    expect(cube.unmounts).toBe(1);
  });

  it('starts playback exactly once and runs exactly one rAF loop, also under StrictMode', () => {
    loadSolution(M2);
    render(
      <StrictMode>
        <SolvingScreen />
      </StrictMode>,
    );
    expect(queue.size).toBe(1);
    for (let i = 0; i < 20; i++) {
      frame(16);
      expect(queue.size).toBe(1);
    }
    expect(cube.props!.frameRef.current.status).toBe('animating');
    expect(cube.props!.frameRef.current.progress).toBeCloseTo(320 / 780, 5);
  });
});

describe('SolvingScreen: pause, resume, replay, pace', () => {
  it('pause freezes the progress bar, the ring and the renderer frame; resume continues', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    run(320);
    const before = cube.props!.frameRef.current.progress;
    expect(before).toBeGreaterThan(0.3);
    fireEvent.click(dockButton(/^pause$/i));
    expect(screen.getByText('Session paused')).toBeTruthy();
    const bar = screen.getByTestId('progress-fill').getAttribute('style');
    run(3000);
    expect(cube.props!.frameRef.current.progress).toBe(before);
    expect(cube.props!.frameRef.current.status).toBe('paused');
    expect(screen.getByTestId('progress-fill').getAttribute('style')).toBe(bar);
    fireEvent.click(dockButton(/^resume$/i));
    run(160);
    expect(cube.props!.frameRef.current.progress).toBeGreaterThan(before);
  });

  it('pause freezes the countdown ring mid-wait and resume continues it', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    run(780 + 1100); // 900 ms of the 2 s wait left -> "1s"
    expect(ringText()).toContain('1s');
    const off = ring();
    fireEvent.click(dockButton(/^pause$/i));
    run(5000);
    expect(ring()).toBe(off);
    expect(ringText()).toContain('1s');
    expect(ringLabel()).toBe('Paused');
    fireEvent.click(dockButton(/^resume$/i));
    run(400);
    expect(ring()).toBeGreaterThan(off);
  });

  it('replay keeps "Step N of M" and restarts the same move', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    run(780 + 2000 + 200); // into step 2
    expect(screen.getByTestId('step-counter').textContent).toBe('Step 2 of 2');
    fireEvent.click(dockButton(/replay/i));
    expect(screen.getByTestId('step-counter').textContent).toBe('Step 2 of 2');
    expect(cube.props!.frameRef.current).toMatchObject({ status: 'animating', activeIndex: 1, progress: 0 });
    expect(ringLabel()).toBe('Replay');
  });

  it('a pace change mid-countdown leaves the current ring unchanged; label updates now; applies next wait', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    run(780 + 500);
    const off = ring();
    fireEvent.change(screen.getByLabelText('Solving delay in seconds'), { target: { value: '10' } });
    expect(useSessionStore.getState().settings.delayMs).toBe(10000);
    expect(screen.getByTestId('pace-label').textContent).toBe('10s');
    // 500 ms of a 2 s wait elapsed: the ring ratio is 1500/2000, not 1500/10000. (The change publishes
    // fresh state, so allow the sub-frame throttle difference; a rescale to 10 s would be ~140 away.)
    const C = 2 * Math.PI * 36;
    expect(Math.abs(ring() - off)).toBeLessThan(3);
    expect(Math.abs(ring() - C * (1 - 1500 / 2000))).toBeLessThan(3);
    run(400);
    expect(Math.abs(ring() - C * (1 - 1100 / 2000))).toBeLessThan(3); // published at <= 30 Hz
    // The NEXT wait uses 10 s: 1100 left + 975 anim + 100 into the new wait.
    run(1100 + 975 + 100);
    expect(Math.abs(ring() - C * (1 - 9900 / 10000))).toBeLessThan(3);
  });

  it('a hidden tab pauses; visible again stays paused until Resume', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    run(200);
    setVisibility('hidden');
    expect(screen.getByText('Session paused')).toBeTruthy();
    expect(cube.props!.frameRef.current.status).toBe('paused');
    setVisibility('visible');
    expect(screen.getByText('Session paused')).toBeTruthy();
    fireEvent.click(dockButton(/^resume$/i));
    expect(cube.props!.frameRef.current.status).toBe('animating');
  });
});

describe('SolvingScreen: orientation cue', () => {
  it('shows Top / Front / Right from non-demo centres, the move panel colour and live lock tooltip', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    const cue = screen.getByTestId('orientation-cue');
    expect(within(cue).getByText('Top:').nextSibling!.textContent).toBe('Red');
    expect(within(cue).getByText('Front:').nextSibling!.textContent).toBe('White');
    expect(within(cue).getByText('Right:').nextSibling!.textContent).toBe('Blue');
    // First move R: right-face centre is blue here (demo would say red).
    expect(screen.getByTestId('move-center-line').textContent).toBe('Blue center · Right face');
    const lock = dockButton(/angle locked/i);
    expect(lock.getAttribute('title')).toContain('Fixed view locked (White Front · Red Top · Blue Right)');
    // Second move is U2: top centre is red.
    run(780 + 2000 + 50);
    expect(screen.getByTestId('move-center-line').textContent).toBe('Red center · Top face');
  });

  it('stays present while the lost-track dialog is open', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    fireEvent.click(dockButton(/lost track/i));
    expect(screen.getByTestId('orientation-cue')).toBeTruthy();
  });
});

describe('SolvingScreen: lost track dialog', () => {
  it('opens paused; closing leaves playback paused', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    run(200);
    fireEvent.click(dockButton(/lost track\? scan again\./i));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(cube.props!.frameRef.current.status).toBe('paused');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cube.props!.frameRef.current.status).toBe('paused');
    expect(screen.getByText('Session paused')).toBeTruthy();
  });

  it('"Replay current move" replays the same step and closes the dialog', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    run(780 + 2000 + 300);
    fireEvent.click(dockButton(/lost track\? scan again\./i));
    fireEvent.click(screen.getByRole('button', { name: /replay current move/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(cube.props!.frameRef.current).toMatchObject({ status: 'animating', activeIndex: 1, progress: 0 });
    expect(screen.getByTestId('step-counter').textContent).toBe('Step 2 of 2');
  });

  it('"Scan My Cube Again" starts a fresh scanning session', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    const id = useSessionStore.getState().sessionId;
    fireEvent.click(dockButton(/lost track\? scan again\./i));
    fireEvent.click(screen.getByRole('button', { name: /scan my cube again/i }));
    expect(useSessionStore.getState().screen).toBe('scanning');
    expect(useSessionStore.getState().sessionId).toBe(id + 1);
    expect(useCubeStore.getState().solution).toBeNull();
  });
});

describe('SolvingScreen: empty solution', () => {
  it('shows "Already solved" with no NaN, no countdown, and Finish goes to completion', () => {
    loadSolution([]);
    act(() => useSessionStore.getState().setGuidance(999));
    render(<SolvingScreen />);
    expect(screen.getByText('Already solved')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
    expect(screen.queryByTestId('step-counter')).toBeNull();
    expect(screen.queryByTestId('ring-progress')).toBeNull();
    const fill = screen.queryByTestId('progress-fill');
    if (fill) expect(fill.getAttribute('style')).not.toMatch(/NaN/);
    expect(queue.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /^finish$/i }));
    expect(useSessionStore.getState().screen).toBe('completion');
    expect(useSessionStore.getState().guidance).toBeNull();
  });
});

describe('SolvingScreen: completion', () => {
  const TOTAL = 780 + 975 + 2 * 2000;

  it('completes only after the final animation PLUS its full delay, then 900 ms, then Completion', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    loadSolution(M2);
    render(<SolvingScreen />);
    run(TOTAL - 100);
    expect(useSessionStore.getState().screen).toBe('solving');
    expect(ringText()).not.toContain('Done');
    expect(ringText()).toContain('1s'); // the final countdown is never skipped
    run(100 + 16);
    expect(ringText()).toContain('Done');
    expect(ringLabel()).toBe('Solved');
    expect(screen.getByTestId('cube-stub').getAttribute('data-mode')).toBe('solved');
    expect(useSessionStore.getState().screen).toBe('solving');
    act(() => {
      vi.advanceTimersByTime(899);
    });
    expect(useSessionStore.getState().screen).toBe('solving');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useSessionStore.getState().screen).toBe('completion');
    expect(useSessionStore.getState().guidance).toEqual({ playbackMs: TOTAL });
  });

  it('Scan again before the beat ends cancels the transition', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    loadSolution(M2);
    render(<SolvingScreen />);
    run(TOTAL + 16);
    expect(ringText()).toContain('Done');
    act(() => {
      startDemoScan(true);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useSessionStore.getState().screen).toBe('scanning');
    expect(useSessionStore.getState().guidance).toBeNull();
  });

  it('unmount cancels the transition', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    loadSolution(M2);
    const { unmount } = render(<SolvingScreen />);
    run(TOTAL + 16);
    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useSessionStore.getState().screen).toBe('solving');
  });
});

describe('SolvingScreen: mode banner', () => {
  const TEXT = 'DEMO — simulated scan data. Not a camera reading.';
  it('shows the demo banner in its header in demo mode', () => {
    loadSolution(M2);
    render(<SolvingScreen />);
    expect(screen.queryByText(TEXT)).not.toBeNull();
  });
  it('shows no banner in live mode', () => {
    loadSolution(M2);
    act(() => useSessionStore.setState({ mode: 'live' }));
    render(<SolvingScreen />);
    expect(screen.queryByText(TEXT)).toBeNull();
  });
});
