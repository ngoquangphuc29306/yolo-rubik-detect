// Pure maths for the controlled cube renderer: no React, no three. Unit-tested in node.
import type { PlaybackFrame } from '@/hooks/usePlayback';

/** Ease-in-out cubic used for move interpolation. */
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
  /** Move whose layer is rotating (the pivot turns), or null when nothing is mid-turn. */
  activeMove: M | null;
  progress: number;
  /** Move whose layer is highlighted and whose arrow is shown: animating, waiting or paused. */
  highlightMove: M | null;
  /** Index of highlightMove in the move list, or -1. */
  highlightIndex: number;
}

/**
 * Single source of truth for what the renderer shows from one PlaybackFrame read.
 * Mid-turn means status 'animating', or 'paused' from animating (displayedIndex === activeIndex;
 * paused from waiting shows activeIndex + 1). Idle, waiting and complete show a static snapshot.
 * The highlight (layer tint + arrow) additionally persists through waiting and any pause, matching
 * the established look; only idle and complete clear it.
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
  const highlighted = frame.status === 'animating' || frame.status === 'waiting' || frame.status === 'paused';
  const highlightMove = highlighted ? (activeMoves[frame.activeIndex] ?? null) : null;
  return {
    snapshotIndex,
    activeMove,
    progress: activeMove === null ? 0 : frame.progress,
    highlightMove,
    highlightIndex: highlightMove === null ? -1 : frame.activeIndex,
  };
}

/** What the renderer has committed to React state: which snapshot is shown and which move is highlighted. */
export interface CommittedView {
  snapshotIndex: number;
  /** Highlighted move index, or -1. */
  moveIndex: number;
}

export interface Reconciled {
  /** New committed view when the frame's selection differs from the committed one, else null. */
  commit: CommittedView | null;
  /** Euler angles to write to the pivot this frame, or null to leave it untouched. */
  rotation: { x: number; y: number; z: number } | null;
}

/**
 * One frame of renderer reconciliation (pure). Membership of the pivot comes from the committed view and
 * can lag the frame by one render; the angle is applied from the same frame read.
 * - Selection matches: pivot = eased angle while turning, identity otherwise.
 * - Mismatch: commit the new view. If the committed view was a mid-turn view that the frame has moved past
 *   (landing, or a dt-truncated stall), hold the pivot at that move's FULL angle until the commit resets it,
 *   so the layer never pops back for a frame.
 */
export function reconcile<M extends PivotMove>(
  frame: PlaybackFrame,
  committed: CommittedView,
  snapshots: readonly unknown[],
  activeMoves: readonly M[],
): Reconciled {
  const sel = selectShown(frame, snapshots, activeMoves);
  if (sel.snapshotIndex === committed.snapshotIndex && sel.highlightIndex === committed.moveIndex) {
    const rotation = sel.activeMove
      ? pivotRotation(sel.activeMove, sel.progress)
      : { x: 0, y: 0, z: 0 };
    return { commit: null, rotation };
  }
  const commit = { snapshotIndex: sel.snapshotIndex, moveIndex: sel.highlightIndex };
  const wasTurningView = committed.moveIndex >= 0 && committed.snapshotIndex === committed.moveIndex;
  const committedMove = wasTurningView ? activeMoves[committed.moveIndex] : undefined;
  if (committedMove && sel.snapshotIndex > committed.snapshotIndex) {
    return { commit, rotation: pivotRotation(committedMove, 1) };
  }
  return { commit, rotation: null };
}
