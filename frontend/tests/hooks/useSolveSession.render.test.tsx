// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { useSolveSession } from '@/hooks/useSolveSession';
import { useSessionStore } from '@/stores/session-store';
import { useCubeStore } from '@/stores/cube-store';
import { demoFaces } from '@/demo/demo-fixtures';
import type { SolveRequest } from '@/types/api';

beforeEach(() => {
  useSessionStore.setState({ mode: null, screen: 'landing', sessionId: 0 });
  useCubeStore.getState().reset();
});

it('useSolveSession solves a demo request and exposes the result', async () => {
  act(() => useSessionStore.getState().startSession('demo', 'reconstructing'));
  const { result } = renderHook(() => useSolveSession());
  expect(result.current.status).toBe('idle');
  await act(async () => {
    await result.current.solve({ schemaVersion: 1, faces: demoFaces(0) as unknown as SolveRequest['faces'] });
  });
  expect(result.current.status).toBe('ready');
  expect(result.current.solution?.source).toBe('demo-fixture');
});
