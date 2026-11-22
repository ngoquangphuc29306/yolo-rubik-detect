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
      return React.createElement('div', { 'data-testid': 'cube-stub' });
    },
  };
});

import { AlignmentScreen } from '@/features/align/AlignmentScreen';
import { applyMove, buildSnapshots } from '@/engine/move-engine';
import { SOLVED } from '@/engine/cube-state';
import { toCubies } from '@/engine/cubie-adapter';
import { useCubeStore } from '@/stores/cube-store';
import { useSessionStore } from '@/stores/session-store';

// Non-demo centres (demo is green front / white top / red right).
const CENTERS: CenterColors = { U: 'red', R: 'blue', F: 'white', D: 'orange', L: 'green', B: 'yellow' };
const invert = (m: MoveToken): MoveToken =>
  (m.endsWith("'") ? m[0] : m.endsWith('2') ? m : `${m}'`) as MoveToken;

function makeSolution(moves: readonly MoveToken[]) {
  let state = SOLVED as FaceletState;
  for (const m of [...moves].reverse()) state = applyMove(state, invert(m));
  return { state, centers: CENTERS, moves, snapshots: buildSnapshots(state, moves), source: 'demo-fixture' as const };
}
const load = (moves: readonly MoveToken[]) => {
  const s = makeSolution(moves);
  act(() => {
    useCubeStore.getState().setReady(s);
    useSessionStore.setState({ screen: 'alignment', mode: 'demo' });
  });
  return s;
};

beforeEach(() => {
  cube.props = null;
  useSessionStore.getState().startSession('demo', 'alignment');
  act(() => useSessionStore.getState().setGuidance(5000));
});
afterEach(cleanup);

describe('AlignmentScreen', () => {
  it('labels come from the session centres and the move count from the solution', () => {
    load(['R', 'U2', "F'"]);
    render(<AlignmentScreen />);
    expect(screen.getByText('Top:').nextSibling?.textContent).toBe('Red');
    expect(screen.getByText('Front:').nextSibling?.textContent).toBe('White');
    expect(screen.getByText('Right:').nextSibling?.textContent).toBe('Blue');
    expect(screen.getByText('3 moves ready')).toBeTruthy();
  });

  it('shows toCubies(solution.state, centers) in the twin', () => {
    const s = load(['R']);
    render(<AlignmentScreen />);
    expect(cube.props?.cubies).toEqual(toCubies(s.state, s.centers));
  });

  it('Start is disabled unless the cube store is ready', () => {
    const s = makeSolution(['R']);
    act(() => useCubeStore.setState({ status: 'solving', solution: s }));
    render(<AlignmentScreen />);
    expect((screen.getByRole('button', { name: /Start AI Guidance/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Start goes to solving and clears guidance', () => {
    load(['R']);
    render(<AlignmentScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Start AI Guidance/ }));
    expect(useSessionStore.getState().screen).toBe('solving');
    expect(useSessionStore.getState().guidance).toBeNull();
  });

  it('empty solution shows already solved with Finish and no Start or speed controls', () => {
    load([]);
    render(<AlignmentScreen />);
    expect(screen.getByText(/Your cube is already solved/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Start AI Guidance/ })).toBeNull();
    expect(screen.queryByLabelText('Seconds between solving moves')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(useSessionStore.getState().screen).toBe('completion');
  });

  it('slider and presets write delayMs', () => {
    load(['R']);
    render(<AlignmentScreen />);
    fireEvent.change(screen.getByLabelText('Seconds between solving moves'), { target: { value: '8' } });
    expect(useSessionStore.getState().settings.delayMs).toBe(8000);
    fireEvent.click(screen.getByRole('button', { name: /Fast/ }));
    expect(useSessionStore.getState().settings.delayMs).toBe(3000);
  });

  it('Back to Summary goes to reconstructing', () => {
    load(['R']);
    render(<AlignmentScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Summary' }));
    expect(useSessionStore.getState().screen).toBe('reconstructing');
  });

  it('without a solution shows a neutral state and never renders a cube', () => {
    render(<AlignmentScreen />);
    expect(screen.getByText(/No solution yet/)).toBeTruthy();
    expect(cube.props).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Back to Summary/ }));
    expect(useSessionStore.getState().screen).toBe('reconstructing');
  });
});
