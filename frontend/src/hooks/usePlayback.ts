import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import {
  animationProgress,
  createPlaybackState,
  displayedSnapshotIndex,
  playbackReducer,
  type PlaybackEvent,
  type PlaybackState,
  type PlaybackStatus,
} from '@/engine/playback-fsm';
import { playCountdownTick, playMoveSound, playSuccessChime } from '@/lib/audio';
import type { MoveToken } from '@/types/cube';

/** Longest dt one frame may contribute; longer visible stalls are truncated (never skip steps). */
export const MAX_FRAME_DT_MS = 250;
/** React state is published at most this often while only time advances. */
const PUBLISH_INTERVAL_MS = 1000 / 30;

export interface UsePlaybackOptions {
  moves: readonly MoveToken[];
  delayMs: number;
  soundEnabled: boolean;
  /** When false the clock does not run (state is kept); re-enabling resets the frame baseline. */
  enabled: boolean;
}

export interface PlaybackControls {
  start(): void;
  pause(): void;
  resume(): void;
  replay(): void;
  /** New playback-run generation, same moves: back to idle at move 0. */
  restart(): void;
}

/** Renderer snapshot, written synchronously with every reducer transition (never throttled). */
export interface PlaybackFrame {
  displayedIndex: number;
  activeIndex: number;
  /** 0 unless animating / paused mid-animation. */
  progress: number;
  status: PlaybackStatus;
}

function toFrame(s: PlaybackState): PlaybackFrame {
  return {
    displayedIndex: displayedSnapshotIndex(s),
    activeIndex: s.index,
    progress: animationProgress(s),
    status: s.status,
  };
}

export interface UsePlayback {
  state: PlaybackState;
  displayedIndex: number;
  /** The renderer reads only this, per frame; it cannot tear against throttled React state. */
  frameRef: MutableRefObject<PlaybackFrame>;
  controls: PlaybackControls;
}

/** Whole seconds left in the wait phase (also while paused from it), else null. */
function waitBucket(s: PlaybackState): number | null {
  if (s.status === 'waiting' || (s.status === 'paused' && s.pausedFrom === 'waiting')) {
    return Math.ceil((s.waitTotalMs - s.waitElapsedMs) / 1000);
  }
  return null;
}

/** Audio cues derive from observed state transitions only. */
function emitCues(prev: PlaybackState, next: PlaybackState, e: PlaybackEvent, sound: boolean) {
  if (next === prev) return;
  const moveStarted =
    next.status === 'animating' &&
    (e.type === 'START' ||
      e.type === 'REPLAY' ||
      (e.type === 'TICK' && prev.status === 'waiting' && next.index > prev.index));
  if (moveStarted) playMoveSound(sound);

  const pb = waitBucket(prev) ?? Infinity;
  const nb = waitBucket(next);
  if (nb !== null && nb < pb && nb >= 1 && nb <= 3) playCountdownTick(sound, nb === 1);

  if (prev.status !== 'complete' && next.status === 'complete' && next.total > 0) playSuccessChime(sound);
}

export function usePlayback({ moves, delayMs, soundEnabled, enabled }: UsePlaybackOptions): UsePlayback {
  const genRef = useRef(0);
  const stateRef = useRef<PlaybackState | null>(null);
  if (stateRef.current === null) {
    genRef.current = 1;
    stateRef.current = playbackReducer(createPlaybackState(), {
      type: 'RESET',
      generation: 1,
      moves,
      delayMs,
    });
  }
  const [state, setState] = useState<PlaybackState>(stateRef.current);

  const movesRef = useRef(moves);
  const appliedKeyRef = useRef(moves.join(' '));
  const movesKey = moves.join(' ');
  const delayRef = useRef(delayMs);
  const soundRef = useRef(soundEnabled);
  const enabledRef = useRef(enabled);
  const frameRef = useRef<PlaybackFrame>(toFrame(stateRef.current));
  const publishedRef = useRef<PlaybackState>(stateRef.current);
  const lastPublishTs = useRef(0);
  const rafId = useRef<number | null>(null);
  const loopToken = useRef(0);
  const lastTs = useRef(0);
  const mountedRef = useRef(true);

  const publish = useCallback((next: PlaybackState, force: boolean) => {
    const t = performance.now();
    if (!force && t - lastPublishTs.current < PUBLISH_INTERVAL_MS) return;
    lastPublishTs.current = t;
    publishedRef.current = next;
    setState(next);
  }, []);

  const stopLoop = useCallback(() => {
    loopToken.current++;
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = null;
  }, []);

  const dispatchRef = useRef<(e: PlaybackEvent) => void>(() => {});
  const onFrameRef = useRef<(token: number, gen: number, ts: number) => void>(() => {});

  const ensureLoop = useCallback(() => {
    const s = stateRef.current!;
    const running = s.status === 'animating' || s.status === 'waiting';
    if (!mountedRef.current || !enabledRef.current || !running) {
      stopLoop();
      return;
    }
    if (rafId.current !== null) return; // exactly one loop
    const token = ++loopToken.current;
    const gen = s.generation;
    rafId.current = requestAnimationFrame((ts) => onFrameRef.current(token, gen, ts));
  }, [stopLoop]);

  const dispatch = useCallback(
    (e: PlaybackEvent) => {
      const prev = stateRef.current!;
      const next = playbackReducer(prev, e);
      if (next === prev) return;
      stateRef.current = next;
      frameRef.current = toFrame(next);
      emitCues(prev, next, e, soundRef.current);
      publish(next, e.type !== 'TICK' || next.status !== prev.status || next.index !== prev.index);
      if (e.type === 'START' || e.type === 'RESUME' || e.type === 'REPLAY') {
        lastTs.current = performance.now();
      }
      ensureLoop();
    },
    [publish, ensureLoop],
  );
  dispatchRef.current = dispatch;

  onFrameRef.current = (token, gen) => {
    // Late callbacks from a cancelled loop or an older run are no-ops.
    if (token !== loopToken.current || gen !== genRef.current || !mountedRef.current) return;
    rafId.current = null;
    const t = performance.now();
    const dt = Math.min(Math.max(t - lastTs.current, 0), MAX_FRAME_DT_MS);
    lastTs.current = t;
    dispatchRef.current({ type: 'TICK', generation: gen, dtMs: dt });
    ensureLoop();
  };

  const reset = useCallback(
    (nextMoves: readonly MoveToken[]) => {
      stopLoop();
      genRef.current += 1;
      movesRef.current = nextMoves;
      dispatch({ type: 'RESET', generation: genRef.current, moves: nextMoves, delayMs: delayRef.current });
    },
    [dispatch, stopLoop],
  );

  // Latest option values for callbacks; declared before the effects that read them.
  useEffect(() => {
    soundRef.current = soundEnabled;
    delayRef.current = delayMs;
    movesRef.current = moves;
  });

  // Mount effect: must precede the others so mountedRef is true when they arm the loop.
  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        dispatchRef.current({ type: 'PAUSE', generation: genRef.current, reason: 'hidden' });
      } else {
        lastTs.current = performance.now(); // no auto-resume; resume stays deliberate
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Effects can re-run without a remount (Fast Refresh, <Activity>): re-arm the clock.
    lastTs.current = performance.now();
    ensureLoop();
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
      stopLoop();
    };
  }, [stopLoop, ensureLoop]);

  // Reset on moves CONTENT, so an inline/derived array with equal content never resets the run.
  useEffect(() => {
    if (appliedKeyRef.current === movesKey) return;
    appliedKeyRef.current = movesKey;
    reset(movesRef.current);
  }, [movesKey, reset]);

  useEffect(() => {
    dispatchRef.current({ type: 'SET_DELAY', generation: genRef.current, delayMs });
  }, [delayMs]);

  useEffect(() => {
    enabledRef.current = enabled;
    lastTs.current = performance.now();
    ensureLoop();
  }, [enabled, ensureLoop]);

  const controls = useMemo<PlaybackControls>(() => {
    const send = (type: 'START' | 'RESUME' | 'REPLAY') => dispatch({ type, generation: genRef.current });
    return {
      start: () => send('START'),
      pause: () => dispatch({ type: 'PAUSE', generation: genRef.current, reason: 'user' }),
      resume: () => send('RESUME'),
      replay: () => send('REPLAY'),
      restart: () => reset(movesRef.current),
    };
  }, [dispatch, reset]);

  return { state, displayedIndex: displayedSnapshotIndex(state), frameRef, controls };
}
