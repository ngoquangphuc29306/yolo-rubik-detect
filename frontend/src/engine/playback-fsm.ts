// Pure playback state machine: no timers, no DOM, no React.
// The hook (T1.10) owns the single clock and feeds TICK events with dt.
import type { MoveToken } from '@/types/cube';

export const QUARTER_TURN_MS = 780; // existing renderer duration (0.78 s)
export const HALF_TURN_MS = 975; // 780 x 1.25, existing behaviour for '2' moves
export const MIN_DELAY_MS = 2000;
export const MAX_DELAY_MS = 15000;

export function animDurationMs(move: MoveToken): number {
  return move.endsWith('2') ? HALF_TURN_MS : QUARTER_TURN_MS;
}

export type PlaybackStatus = 'idle' | 'animating' | 'waiting' | 'paused' | 'complete';

export interface PlaybackState {
  /** Playback-run generation (not the session id); 0 = never reset. */
  readonly generation: number;
  readonly status: PlaybackStatus;
  readonly pausedFrom: 'animating' | 'waiting' | null;
  readonly pauseReason: 'user' | 'hidden' | null;
  /** Per-move animation durations, fixed at RESET, length === total. */
  readonly animMs: readonly number[];
  readonly total: number;
  /** Move being demonstrated; 0 when total === 0. */
  readonly index: number;
  readonly animElapsedMs: number;
  readonly waitElapsedMs: number;
  /** Fixed when the wait phase begins (= delayMs at that moment). */
  readonly waitTotalMs: number;
  /** Setting; applies from the NEXT wait phase. */
  readonly delayMs: number;
  readonly isReplay: boolean;
  /** dt applied while animating|waiting ("Guidance time", not wall-clock). */
  readonly playbackMs: number;
}

export type PlaybackEvent =
  | { type: 'RESET'; generation: number; moves: readonly MoveToken[]; delayMs: number }
  | { type: 'START'; generation: number }
  | { type: 'TICK'; generation: number; dtMs: number }
  | { type: 'PAUSE'; generation: number; reason: 'user' | 'hidden' }
  | { type: 'RESUME'; generation: number }
  | { type: 'REPLAY'; generation: number }
  | { type: 'SET_DELAY'; generation: number; delayMs: number };

const NO_MOVES: readonly number[] = Object.freeze([]);

export function createPlaybackState(): PlaybackState {
  return {
    generation: 0,
    status: 'idle',
    pausedFrom: null,
    pauseReason: null,
    animMs: NO_MOVES,
    total: 0,
    index: 0,
    animElapsedMs: 0,
    waitElapsedMs: 0,
    waitTotalMs: 0,
    delayMs: MIN_DELAY_MS,
    isReplay: false,
    playbackMs: 0,
  };
}

function clampDelay(ms: number): number {
  if (Number.isNaN(ms)) return MIN_DELAY_MS;
  return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, ms));
}

function tickState(s: PlaybackState, dtMs: number): PlaybackState {
  let { status, index, animElapsedMs, waitElapsedMs, waitTotalMs, isReplay, playbackMs } = s;
  let rest = dtMs;
  // Each iteration either exhausts `rest` or completes a phase of positive length,
  // so the loop is bounded by 2 * total + 1 iterations.
  while (rest > 0 && (status === 'animating' || status === 'waiting')) {
    if (status === 'animating') {
      const applied = Math.min(rest, s.animMs[index]! - animElapsedMs);
      animElapsedMs += applied;
      playbackMs += applied;
      rest -= applied;
      if (animElapsedMs >= s.animMs[index]!) {
        status = 'waiting';
        waitElapsedMs = 0;
        waitTotalMs = s.delayMs;
        isReplay = false;
      }
    } else {
      const applied = Math.min(rest, waitTotalMs - waitElapsedMs);
      waitElapsedMs += applied;
      playbackMs += applied;
      rest -= applied;
      if (waitElapsedMs >= waitTotalMs) {
        if (index === s.total - 1) {
          status = 'complete';
          rest = 0; // leftover after the final wait is discarded
        } else {
          status = 'animating';
          index += 1;
          animElapsedMs = 0;
          waitElapsedMs = 0;
        }
      }
    }
  }
  return { ...s, status, index, animElapsedMs, waitElapsedMs, waitTotalMs, isReplay, playbackMs };
}

export function playbackReducer(s: PlaybackState, e: PlaybackEvent): PlaybackState {
  if (e.type === 'RESET') {
    if (e.generation <= s.generation) return s;
    const animMs = Object.freeze(e.moves.map(animDurationMs));
    const total = animMs.length;
    return {
      generation: e.generation,
      status: total > 0 ? 'idle' : 'complete',
      pausedFrom: null,
      pauseReason: null,
      animMs,
      total,
      index: 0,
      animElapsedMs: 0,
      waitElapsedMs: 0,
      waitTotalMs: 0,
      delayMs: clampDelay(e.delayMs),
      isReplay: false,
      playbackMs: 0,
    };
  }
  if (e.generation !== s.generation) return s;

  switch (e.type) {
    case 'START':
      if (s.status !== 'idle' || s.total === 0) return s;
      return { ...s, status: 'animating', index: 0, animElapsedMs: 0 };
    case 'TICK':
      if (typeof e.dtMs !== 'number' || !Number.isFinite(e.dtMs) || e.dtMs <= 0) return s;
      if (s.status !== 'animating' && s.status !== 'waiting') return s;
      return tickState(s, e.dtMs);
    case 'PAUSE':
      if (s.status !== 'animating' && s.status !== 'waiting') return s;
      return { ...s, status: 'paused', pausedFrom: s.status, pauseReason: e.reason };
    case 'RESUME':
      if (s.status !== 'paused' || s.pausedFrom === null) return s;
      return { ...s, status: s.pausedFrom, pausedFrom: null, pauseReason: null };
    case 'REPLAY':
      if (s.status !== 'animating' && s.status !== 'waiting' && s.status !== 'paused') return s;
      return {
        ...s,
        status: 'animating',
        pausedFrom: null,
        pauseReason: null,
        animElapsedMs: 0,
        waitElapsedMs: 0,
        isReplay: true,
      };
    case 'SET_DELAY': {
      if (Number.isNaN(e.delayMs)) return s;
      const delayMs = clampDelay(e.delayMs);
      return delayMs === s.delayMs ? s : { ...s, delayMs };
    }
    default: {
      const _exhaustive: never = e;
      void _exhaustive;
      return s;
    }
  }
}

export function displayedSnapshotIndex(s: PlaybackState): number {
  if (s.total === 0) return 0;
  switch (s.status) {
    case 'idle':
      return 0;
    case 'animating':
      return s.index;
    case 'paused':
      return s.pausedFrom === 'waiting' ? s.index + 1 : s.index;
    case 'waiting':
    case 'complete':
      return s.index + 1;
  }
}

export function animationProgress(s: PlaybackState): number {
  const active = s.status === 'animating' || (s.status === 'paused' && s.pausedFrom === 'animating');
  if (!active || s.total === 0) return 0;
  const dur = s.animMs[s.index]!;
  return Math.min(1, Math.max(0, s.animElapsedMs / dur));
}
