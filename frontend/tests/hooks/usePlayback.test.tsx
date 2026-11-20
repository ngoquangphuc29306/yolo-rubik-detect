// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoveToken } from '@/types/cube';

vi.mock('@/lib/audio', () => ({
  playMoveSound: vi.fn(),
  playCaptureSound: vi.fn(),
  playCountdownTick: vi.fn(),
  playSuccessChime: vi.fn(),
}));

import { playCountdownTick, playMoveSound, playSuccessChime } from '@/lib/audio';
import { usePlayback } from '@/hooks/usePlayback';

// ---- fake clock / rAF / visibility -------------------------------------------------
let now = 0;
let nextId = 1;
let queue = new Map<number, FrameRequestCallback>();
let rafCalls = 0;
let visibility: 'visible' | 'hidden' = 'visible';

function frame(dtMs = 16) {
  now += dtMs;
  const cbs = [...queue.values()];
  queue.clear();
  act(() => {
    for (const cb of cbs) cb(now);
  });
}
function setVisibility(v: 'visible' | 'hidden') {
  visibility = v;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  now = 1000;
  nextId = 1;
  queue = new Map();
  rafCalls = 0;
  visibility = 'visible';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCalls++;
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const M2: readonly MoveToken[] = ['R', 'U2'];
const SUM2 = 780 + 975 + 2 * 2000;

function setup(moves: readonly MoveToken[] = M2, delayMs = 2000, soundEnabled = true) {
  return renderHook((p: { moves: readonly MoveToken[]; delayMs: number; soundEnabled: boolean }) =>
    usePlayback({ ...p, enabled: true }), { initialProps: { moves, delayMs, soundEnabled } });
}

describe('usePlayback clock', () => {
  it('constant 16 ms frames reach complete at sum(anim) + total*delay within one frame', () => {
    const { result } = setup();
    act(() => result.current.controls.start());
    let frames = 0;
    while (result.current.state.status !== 'complete' && frames < 1000) {
      frame(16);
      frames++;
    }
    expect(result.current.state.status).toBe('complete');
    expect(result.current.state.playbackMs).toBe(SUM2);
    expect(frames * 16).toBeGreaterThanOrEqual(SUM2);
    expect(frames * 16).toBeLessThan(SUM2 + 16);
    expect(queue.size).toBe(0); // loop stops at complete
  });

  it('truncates a visible 5 s stall to 250 ms without skipping steps', () => {
    const { result } = setup();
    act(() => result.current.controls.start());
    frame(5000);
    expect(result.current.state.playbackMs).toBe(250);
    expect(result.current.state.index).toBe(0);
    expect(result.current.state.status).toBe('animating');
  });

  it('hidden pauses with reason hidden and nothing advances even after 60 s', () => {
    const { result } = setup();
    act(() => result.current.controls.start());
    frame(16);
    setVisibility('hidden');
    const before = result.current.state.playbackMs; // pause publishes immediately (exact)
    expect(before).toBe(16);
    expect(result.current.state.status).toBe('paused');
    expect(result.current.state.pauseReason).toBe('hidden');
    expect(queue.size).toBe(0);
    now += 60000;
    frame(0);
    expect(result.current.state.playbackMs).toBe(before);
  });

  it('visible again stays paused until resume(); first dt after resume is one frame', () => {
    const { result } = setup();
    act(() => result.current.controls.start());
    frame(16);
    setVisibility('hidden');
    now += 60000;
    setVisibility('visible');
    expect(result.current.state.status).toBe('paused');
    expect(queue.size).toBe(0);
    const before = result.current.state.playbackMs;
    act(() => result.current.controls.resume());
    frame(40); // >= publish interval so the throttled state shows it
    expect(result.current.state.playbackMs).toBe(before + 40);
    expect(result.current.state.status).toBe('animating');
  });

  it('user pause stops the loop and freezes progress', () => {
    const { result } = setup();
    act(() => result.current.controls.start());
    frame(200);
    act(() => result.current.controls.pause());
    expect(queue.size).toBe(0);
    const p = result.current.progressRef.current;
    expect(p).toBeCloseTo(200 / 780, 5);
    now += 5000;
    expect(result.current.progressRef.current).toBe(p);
  });

  it('unmount cancels the loop and removes the listener', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = setup();
    act(() => result.current.controls.start());
    const stale = [...queue.values()];
    unmount();
    expect(queue.size).toBe(0);
    const calls = rafCalls;
    for (const cb of stale) cb(now + 16);
    expect(rafCalls).toBe(calls);
    const adds = add.mock.calls.filter((c) => c[0] === 'visibilitychange').length;
    const removes = remove.mock.calls.filter((c) => c[0] === 'visibilitychange').length;
    expect(adds).toBe(removes);
  });

  it('restart() bumps generation, returns to idle at index 0, and ignores late frames', () => {
    const { result } = setup();
    act(() => result.current.controls.start());
    frame(100);
    const gen = result.current.state.generation;
    const stale = [...queue.values()];
    act(() => result.current.controls.restart());
    expect(result.current.state.generation).toBe(gen + 1);
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.index).toBe(0);
    expect(result.current.displayedIndex).toBe(0);
    expect(result.current.progressRef.current).toBe(0);
    expect(queue.size).toBe(0);
    const calls = rafCalls;
    now += 16;
    act(() => {
      for (const cb of stale) cb(now);
    });
    expect(rafCalls).toBe(calls);
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.playbackMs).toBe(0);
    // the new run is fully playable
    act(() => result.current.controls.start());
    frame(40);
    expect(result.current.state.playbackMs).toBe(40);
  });

  it('StrictMode double mount leaves exactly one active loop', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { result } = renderHook(
      () => usePlayback({ moves: M2, delayMs: 2000, soundEnabled: false, enabled: true }),
      { wrapper: StrictMode },
    );
    act(() => result.current.controls.start());
    expect(queue.size).toBe(1);
    frame(16);
    expect(queue.size).toBe(1);
    expect(rafCalls).toBe(2); // one registration per frame
    const vis = (m: typeof add) => m.mock.calls.filter((c) => c[0] === 'visibilitychange').length;
    expect(vis(add) - vis(remove)).toBe(1);
  });

  it('progressRef and displayedIndex agree; progress is 0 while waiting', () => {
    const { result } = setup(['R']);
    act(() => result.current.controls.start());
    frame(195);
    frame(195);
    expect(result.current.progressRef.current).toBeCloseTo(0.5, 5);
    expect(result.current.displayedIndex).toBe(0);
    frame(195);
    frame(195); // 780 exactly -> animation landed
    frame(20);
    expect(result.current.state.status).toBe('waiting');
    expect(result.current.progressRef.current).toBe(0);
    expect(result.current.displayedIndex).toBe(1);
  });

  it('publishes React state at most ~30 Hz between status changes', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return usePlayback({ moves: M2, delayMs: 2000, soundEnabled: false, enabled: true });
    });
    act(() => result.current.controls.start());
    const base = renders;
    for (let i = 0; i < 100; i++) frame(4); // 400 ms, crosses no phase boundary
    expect(result.current.state.status).toBe('animating');
    expect(renders - base).toBeLessThanOrEqual(15);
    expect(renders - base).toBeGreaterThan(0);
  });

  it('a moves identity change resets the run', () => {
    const { result, rerender } = setup();
    act(() => result.current.controls.start());
    frame(100);
    const gen = result.current.state.generation;
    rerender({ moves: ['F', 'B', "L'"], delayMs: 2000, soundEnabled: true });
    expect(result.current.state.generation).toBe(gen + 1);
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.total).toBe(3);
    expect(queue.size).toBe(0);
  });

  it('delay changes apply through SET_DELAY', () => {
    const { result, rerender } = setup();
    rerender({ moves: M2, delayMs: 5000, soundEnabled: true });
    expect(result.current.state.delayMs).toBe(5000);
    expect(result.current.state.generation).toBe(1);
  });

  it('empty moves are complete with no loop', () => {
    const { result } = setup([]);
    expect(result.current.state.status).toBe('complete');
    expect(result.current.displayedIndex).toBe(0);
    act(() => result.current.controls.start());
    expect(rafCalls).toBe(0);
    expect(queue.size).toBe(0);
    expect(playSuccessChime).not.toHaveBeenCalled();
  });
});

describe('usePlayback audio cues', () => {
  it('2-move run emits 2 move sounds, 4 countdown ticks (2 final) and one chime', () => {
    const { result } = setup();
    act(() => result.current.controls.start());
    for (let i = 0; i < 1000 && result.current.state.status !== 'complete'; i++) frame(16);
    expect(playMoveSound).toHaveBeenCalledTimes(2);
    expect(playMoveSound).toHaveBeenCalledWith(true);
    expect(playCountdownTick).toHaveBeenCalledTimes(4);
    const finals = vi.mocked(playCountdownTick).mock.calls.filter((c) => c[1] === true);
    expect(finals).toHaveLength(2);
    expect(playSuccessChime).toHaveBeenCalledTimes(1);
  });

  it('replay emits a move sound; pause/resume does not', () => {
    const { result } = setup();
    act(() => result.current.controls.start());
    frame(100);
    expect(playMoveSound).toHaveBeenCalledTimes(1);
    act(() => result.current.controls.pause());
    act(() => result.current.controls.resume());
    expect(playMoveSound).toHaveBeenCalledTimes(1);
    act(() => result.current.controls.replay());
    expect(playMoveSound).toHaveBeenCalledTimes(2);
  });

  it('pause/resume inside a countdown does not repeat the tick', () => {
    const { result } = setup(['R'], 3000);
    act(() => result.current.controls.start());
    for (let i = 0; i < 1000 && result.current.state.status !== 'waiting'; i++) frame(16);
    const n = vi.mocked(playCountdownTick).mock.calls.length;
    expect(n).toBe(1); // "3" on entering the wait
    act(() => result.current.controls.pause());
    act(() => result.current.controls.resume());
    expect(playCountdownTick).toHaveBeenCalledTimes(n);
  });

  it('soundEnabled=false passes false to every cue', () => {
    const { result } = setup(M2, 2000, false);
    act(() => result.current.controls.start());
    for (let i = 0; i < 1000 && result.current.state.status !== 'complete'; i++) frame(16);
    for (const m of [playMoveSound, playCountdownTick, playSuccessChime]) {
      for (const c of vi.mocked(m).mock.calls) expect(c[0]).toBe(false);
    }
  });
});
