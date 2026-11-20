// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSolveSession } from '@/hooks/useSolveSession';
import { useSessionStore } from '@/stores/session-store';
import { useCubeStore } from '@/stores/cube-store';
import { solveRequestGuard } from '@/stores/solve-guard';
import { demoFaces } from '@/demo/demo-fixtures';
import type { SolveRequest } from '@/types/api';

const request = { schemaVersion: 1, faces: demoFaces(0) as unknown as SolveRequest['faces'] } as SolveRequest;

beforeEach(() => {
  solveRequestGuard.reset();
  useSessionStore.setState({ mode: null, screen: 'landing', sessionId: 0 });
  useCubeStore.getState().reset();
});

it('useSolveSession solves a demo request and exposes the result', async () => {
  act(() => useSessionStore.getState().startSession('demo', 'reconstructing'));
  const { result } = renderHook(() => useSolveSession());
  expect(result.current.status).toBe('idle');
  await act(async () => { await result.current.solve(request); });
  expect(result.current.status).toBe('ready');
  expect(result.current.solution?.source).toBe('demo-fixture');
});

it('startSession followed synchronously by solve() completes to ready', async () => {
  const { result } = renderHook(() => useSolveSession());
  await act(async () => {
    useSessionStore.getState().startSession('demo', 'reconstructing');
    await result.current.solve(request);
  });
  expect(result.current.status).toBe('ready');
});

it('unmount mid-flight: the result still lands for the same session', async () => {
  act(() => useSessionStore.getState().startSession('demo', 'reconstructing'));
  const { result, unmount } = renderHook(() => useSolveSession());
  let p!: Promise<void>;
  act(() => { p = result.current.solve(request); });
  unmount();
  await p;
  expect(useCubeStore.getState().status).toBe('ready');
});

it('a solve from a second hook instance supersedes the first and aborts its signal', async () => {
  act(() => useSessionStore.getState().startSession('live', 'reconstructing'));
  const signals: AbortSignal[] = [];
  let release!: (r: Response) => void;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_u, init) => {
    signals.push(init!.signal as AbortSignal);
    return new Promise<Response>((res) => { if (signals.length === 1) release = res; });
  });
  const a = renderHook(() => useSolveSession());
  const b = renderHook(() => useSolveSession());
  let pa!: Promise<void>;
  act(() => { pa = a.result.current.solve(request); });
  act(() => { void b.result.current.solve(request); });
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
  release(new Response('{}', { status: 200 }));
  await act(async () => { await pa; });
  expect(useCubeStore.getState().status).toBe('solving'); // A's late result ignored; B still owns the status
  fetchSpy.mockRestore();
});
