// Pure maths for the controlled cube renderer: no React, no three. Unit-tested in node.
import type { PlaybackFrame } from '@/hooks/usePlayback';

/** Same curve as the legacy inline easing in RubiksCube3D. */
export function easeInOutCubic(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface PivotMove {
  axis: 'x' | 'y' | 'z';
  /** Signed radians for the full move (positive-axis convention). */
  angle: number;
}

/** Euler rotation to apply to the layer pivot at `progress` (0..1). */
export function pivotRotation(move: PivotMove, progress: number): { x: number; y: number; z: number } {
  const r = { x: 0, y: 0, z: 0 };
  r[move.axis] = move.angle * easeInOutCubic(progress);
  return r;
}

export interface ShownSelection<M> {
  /** Index into the snapshots array (S[i]) to display. */
  snapshotIndex: number;
  /** Move whose layer is rotating, or null when nothing is mid-turn. */
  activeMove: M | null;
  progress: number;
}

/**
 * Single source of truth for what the renderer shows from one PlaybackFrame read.
 * Mid-turn means status 'animating', or 'paused' from animating (displayedIndex === activeIndex;
 * paused from waiting shows activeIndex + 1). Idle, waiting and complete show a static snapshot.
 */
export function selectShown<M>(
  frame: PlaybackFrame,
  snapshots: readonly unknown[],
  activeMoves: readonly M[],
): ShownSelection<M> {
  const last = Math.max(0, snapshots.length - 1);
  const snapshotIndex = Math.min(Math.max(0, frame.displayedIndex), last);
  const midTurn =
    frame.status === 'animating' ||
    (frame.status === 'paused' && frame.displayedIndex === frame.activeIndex);
  const activeMove = midTurn ? (activeMoves[frame.activeIndex] ?? null) : null;
  if (activeMove === null) return { snapshotIndex, activeMove: null, progress: 0 };
  return { snapshotIndex, activeMove, progress: frame.progress };
}
