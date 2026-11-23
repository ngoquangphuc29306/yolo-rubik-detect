// @vitest-environment jsdom
import { StrictMode, type JSXElementConstructor, type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveScan, type UseLiveScanOptions } from '@/hooks/useLiveScan';
import { ROTATION_MS } from '@/lib/live-scan-machine';
import { clientError } from '@/services/parsers';
import type { ConnectResult, ScanTransport, SendResult } from '@/services/scan-transport';
import type { FrameResult, SolveError } from '@/types/api';
import type { ColorName, FaceId } from '@/types/cube';

// ---- fakes ---------------------------------------------------------------------------
const READY = {
  type: 'ready', schemaVersion: 1, scanId: 's', modelVersion: 'm', imgsz: 640, maxFrameBytes: 1048576, maxFrameEdge: 1280,
} as const;

class FakeTransport implements ScanTransport {
  readonly available = true;
  closed = false;
  connectCalls = 0;
  sendTimes: number[] = [];
  sends: { blob: Blob; resolve: (r: SendResult) => void; settled: boolean }[] = [];
  connectResult: ConnectResult = { ok: true, ready: READY };
  async connect(): Promise<ConnectResult> {
    this.connectCalls += 1;
    return this.connectResult;
  }
  send(blob: Blob): Promise<SendResult> {
    this.sendTimes.push(Date.now());
    return new Promise((resolve) => {
      const entry = {
        blob,
        settled: false,
        resolve: (r: SendResult) => {
          entry.settled = true;
          resolve(r);
        },
      };
      this.sends.push(entry);
    });
  }
  close(): void {
    this.closed = true;
  }
  get inFlight(): number {
    return this.sends.filter((s) => !s.settled).length;
  }
}

const GRIDS: Record<FaceId, ColorName[]> = {
  F: ['white', 'red', 'blue', 'orange', 'green', 'yellow', 'red', 'white', 'blue'],
  R: ['green', 'green', 'white', 'yellow', 'red', 'orange', 'blue', 'blue', 'yellow'],
  B: ['red', 'yellow', 'orange', 'orange', 'blue', 'green', 'white', 'yellow', 'green'],
  L: ['blue', 'white', 'red', 'green', 'orange', 'blue', 'yellow', 'red', 'yellow'],
  U: ['orange', 'blue', 'yellow', 'red', 'white', 'green', 'orange', 'green', 'red'],
  D: ['yellow', 'orange', 'green', 'blue', 'yellow', 'red', 'green', 'orange', 'white'],
};

function frame(grid: ColorName[] | null, reason?: string): FrameResult {
  const valid = grid !== null;
  return {
    type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 518, height: 518,
    detections: [],
    cells: Array.from({ length: 9 }, (_, i) => ({
      color: grid ? grid[i]! : null, confidence: grid ? 0.9 : null, status: grid ? ('ok' as const) : ('missing' as const),
    })),
    grid,
    face: null,
    quality: valid ? { valid: true } : { valid: false, reason: reason ?? 'NO_FACE' },
    inferenceMs: 10,
  };
}
const good = (f: FaceId): SendResult => ({ ok: true, result: frame(GRIDS[f]) });
const apiErr = (code: 'INVALID_FRAME' | 'FRAME_TOO_LARGE' | 'MODEL_UNAVAILABLE'): SendResult => {
  const error: SolveError = { kind: 'api', code, message: `api ${code}`, retryable: code !== 'MODEL_UNAVAILABLE' };
  return { ok: false, error };
};

const fakeVideo = (): HTMLVideoElement =>
  ({ videoWidth: 1280, videoHeight: 720, readyState: 4 }) as unknown as HTMLVideoElement;

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

/** Wait until a send is in flight, then resolve the oldest unsettled one. */
async function answer(t: FakeTransport, r: SendResult): Promise<void> {
  for (let i = 0; i < 100 && t.inFlight === 0; i++) await advance(50);
  const pending = t.sends.find((s) => !s.settled);
  if (!pending) throw new Error('no send in flight');
  await act(async () => { pending.resolve(r); await vi.advanceTimersByTimeAsync(0); });
}

let transports: FakeTransport[];
let consoleError: ReturnType<typeof vi.spyOn>;
const grab = vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' }));

function setup(over: Partial<UseLiveScanOptions> = {}, video: HTMLVideoElement | null = fakeVideo(), wrapper?: JSXElementConstructor<{ children: ReactNode }>) {
  const onCapture = vi.fn((_f: FaceId, _g: unknown) => true);
  const createTransport = vi.fn(() => {
    const t = new FakeTransport();
    transports.push(t);
    return t;
  });
  const props = { enabled: true, video, createTransport, onCapture, grabFrame: grab, now: () => Date.now(), minIntervalMs: 300, ...over } as UseLiveScanOptions;
  const hook = renderHook((p: UseLiveScanOptions) => useLiveScan(p), { initialProps: props, wrapper });
  return { ...hook, props, onCapture, createTransport };
}

/** Five identical valid results spanning more than 1000 ms. */
async function stableFace(t: FakeTransport, f: FaceId) {
  for (let i = 0; i < 5; i++) await answer(t, good(f));
}

beforeEach(() => {
  vi.useFakeTimers();
  transports = [];
  grab.mockClear();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe('useLiveScan lifecycle', () => {
  it('enabled=false constructs nothing and stays idle', async () => {
    const { result, createTransport } = setup({ enabled: false });
    await advance(2000);
    expect(createTransport).not.toHaveBeenCalled();
    expect(result.current.connection).toBe('idle');
  });

  it('a failed connect gives error + message, starts no loop and closes the transport', async () => {
    const { result } = setup({
      createTransport: () => {
        const t = new FakeTransport();
        t.connectResult = { ok: false, error: clientError('BACKEND_UNAVAILABLE', 'Vision service not connected.', true) };
        transports.push(t);
        return t;
      },
    });
    await advance(2000);
    expect(result.current.connection).toBe('error');
    expect(result.current.errorMessage).toBe('Vision service not connected.');
    expect(transports[0]!.sends).toHaveLength(0);
    expect(transports[0]!.closed).toBe(true);
  });

  it('connects then goes live and sends', async () => {
    const { result } = setup();
    await advance(10);
    expect(result.current.connection).toBe('live');
    await advance(200);
    expect(transports[0]!.sends).toHaveLength(1);
  });

  it('video=null goes idle and closes; a video again uses a NEW transport', async () => {
    const v = fakeVideo();
    const { result, rerender, props, createTransport } = setup({}, v);
    await advance(300);
    rerender({ ...props, video: null });
    await advance(10);
    expect(result.current.connection).toBe('idle');
    expect(result.current.lastResult).toBeNull();
    expect(transports[0]!.closed).toBe(true);
    const sentBefore = transports[0]!.sends.length;
    rerender({ ...props, video: v });
    await advance(300);
    expect(createTransport).toHaveBeenCalledTimes(2);
    expect(transports[1]).not.toBe(transports[0]);
    expect(transports[0]!.sends).toHaveLength(sentBefore);
    expect(transports[1]!.sends.length).toBeGreaterThan(0);
  });

  it('unmount mid-flight closes the transport, sends nothing more and clears timers without warnings', async () => {
    const { unmount } = setup();
    await advance(300);
    const t = transports[0]!;
    expect(t.inFlight).toBe(1);
    unmount();
    expect(t.closed).toBe(true);
    await act(async () => { t.sends[0]!.resolve(good('F')); await vi.advanceTimersByTimeAsync(5000); });
    expect(t.sends).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('unmount while rotating clears the rotation timer', async () => {
    const { unmount, result } = setup();
    await advance(10);
    await stableFace(transports[0]!, 'F');
    expect(result.current.state.phase).toBe('rotating');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('StrictMode leaves exactly one live transport', async () => {
    const { createTransport } = setup({}, fakeVideo(), StrictMode);
    await advance(300);
    expect(createTransport).toHaveBeenCalledTimes(2);
    expect(transports[0]!.closed).toBe(true);
    expect(transports[1]!.closed).toBe(false);
    expect(transports[0]!.sends).toHaveLength(0);
    expect(transports[1]!.sends).toHaveLength(1);
  });
});

describe('useLiveScan loop', () => {
  it('a second send starts only after the first resolves, and not before minIntervalMs since the previous start', async () => {
    setup({ minIntervalMs: 300 });
    await advance(10);
    const t = transports[0]!;
    await advance(0);
    expect(t.sends).toHaveLength(1);
    const start = t.sendTimes[0]!;
    await act(async () => { t.sends[0]!.resolve(good('F')); await vi.advanceTimersByTimeAsync(0); });
    await advance(100);
    expect(t.sends).toHaveLength(1);
    await advance(400);
    expect(t.sends).toHaveLength(2);
    expect(t.sendTimes[1]! - start).toBeGreaterThanOrEqual(300);
    expect(t.inFlight).toBe(1); // the second send is the only one pending
  });

  it('stable valid results call onCapture exactly once with the face and grid, then rotate', async () => {
    const { result, onCapture } = setup();
    await advance(10);
    await stableFace(transports[0]!, 'F');
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture).toHaveBeenCalledWith('F', GRIDS.F);
    expect(result.current.state.phase).toBe('rotating');
    expect(result.current.state.stage).toBe('R');
    expect(result.current.state.capturedCenters.F).toBe('green');
    expect(result.current.lastResult?.grid).toEqual(GRIDS.F);
  });

  it('sends nothing while rotating; resumes only after ROTATION_MS', async () => {
    const { result } = setup();
    await advance(10);
    const t = transports[0]!;
    await stableFace(t, 'F');
    const sent = t.sends.length;
    await advance(ROTATION_MS - 100);
    expect(result.current.state.phase).toBe('rotating');
    expect(t.sends).toHaveLength(sent);
    await advance(100 + 10);
    expect(result.current.state.phase).toBe('aligning');
    await advance(300);
    expect(t.sends.length).toBe(sent + 1);
  });

  it('test_capture_failure_keeps_stage (onCapture returns false)', async () => {
    const results = [false, true];
    const cap = vi.fn(() => results.shift() ?? true);
    const { result } = setup({ onCapture: cap });
    await advance(10);
    const t = transports[0]!;
    await stableFace(t, 'F');
    expect(cap).toHaveBeenCalledTimes(1);
    const s = result.current.state;
    expect(s.stage).toBe('F');
    expect(s.phase).toBe('aligning');
    expect(s.streak).toBeNull();
    expect(s.capturedCenters.F).toBeUndefined();
    expect(s.hint).toBe('Could not save this face — hold steady to try again.');
    // scanning continues and a later stable streak is stored
    await stableFace(t, 'F');
    expect(result.current.state.phase).toBe('rotating');
    expect(result.current.state.capturedCenters.F).toBe('green');
    expect(cap).toHaveBeenCalledTimes(2);
  });

  it('test_capture_failure_keeps_stage (onCapture throws)', async () => {
    let calls = 0;
    const onCapture = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw new Error('store exploded');
      return true;
    });
    const { result } = setup({ onCapture });
    await advance(10);
    const t = transports[0]!;
    await stableFace(t, 'F');
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(result.current.state.stage).toBe('F');
    expect(result.current.state.phase).toBe('aligning');
    expect(result.current.state.hint).toBe('Could not save this face — hold steady to try again.');
    await stableFace(t, 'F');
    expect(onCapture).toHaveBeenCalledTimes(2);
    expect(result.current.state.phase).toBe('rotating');
  });

  it('drops a result that arrives after rescan() (epoch changed in flight)', async () => {
    const { result } = setup();
    await advance(10);
    const t = transports[0]!;
    await advance(300);
    expect(t.inFlight).toBe(1);
    const epochBefore = result.current.state.epoch;
    act(() => result.current.rescan('F', 'green'));
    expect(result.current.state.epoch).toBe(epochBefore + 1);
    await act(async () => { t.sends[0]!.resolve(good('F')); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.state.streak).toBeNull();
    expect(result.current.state.phase).toBe('aligning');
    expect(result.current.lastResult).toBeNull(); // a stale frame never reaches the overlay
  });

  it('a stale result does not undo reset() clearing lastResult', async () => {
    const { result } = setup();
    await advance(10);
    const t = transports[0]!;
    await answer(t, good('F'));
    expect(result.current.lastResult).not.toBeNull();
    await advance(300);
    expect(t.inFlight).toBe(1);
    act(() => result.current.reset());
    expect(result.current.lastResult).toBeNull();
    await act(async () => { t.sends[1]!.resolve(good('F')); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.lastResult).toBeNull();
  });

  it('a slow send (longer than minIntervalMs) lets the next send start immediately', async () => {
    setup({ minIntervalMs: 300 });
    await advance(10);
    const t = transports[0]!;
    await advance(1000);
    expect(t.sends).toHaveLength(1);
    await act(async () => { t.sends[0]!.resolve(good('F')); await vi.advanceTimersByTimeAsync(0); });
    expect(t.sends).toHaveLength(2);
  });

  it('disable then re-enable while rotating resumes the pause', async () => {
    const { result, rerender, props } = setup();
    await advance(10);
    await stableFace(transports[0]!, 'F');
    expect(result.current.state.phase).toBe('rotating');
    rerender({ ...props, enabled: false });
    await advance(ROTATION_MS * 2);
    expect(result.current.state.phase).toBe('rotating'); // timer was cleared with the connection
    rerender({ ...props, enabled: true });
    await advance(ROTATION_MS + 50);
    expect(result.current.state.phase).toBe('aligning');
    expect(transports[1]!.sends.length).toBeGreaterThan(0);
  });

  it('an unexpected throw in the loop ends in error with a closed transport', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let thrown = false;
    const { result } = setup({
      now: () => {
        if (!thrown) {
          thrown = true;
          throw new TypeError('boom');
        }
        return Date.now();
      },
    });
    await advance(300);
    expect(thrown).toBe(true);
    expect(result.current.connection).toBe('error');
    expect(result.current.errorMessage).toBe('The live scan stopped unexpectedly. Try again.');
    expect(transports[0]!.closed).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).toContain('TypeError');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('boom');
    const sent = transports[0]!.sends.length;
    await advance(2000);
    expect(transports[0]!.sends).toHaveLength(sent);
    warn.mockRestore();
  });

  it('an error clears the overlay result and the stability streak; retry() needs a fresh full streak', async () => {
    const { result, onCapture } = setup();
    await advance(10);
    const t = transports[0]!;
    for (let i = 0; i < 4; i++) await answer(t, good('F'));
    expect(result.current.state.streak?.count).toBe(4);
    expect(result.current.lastResult).not.toBeNull();
    await answer(t, { ok: false, error: clientError('NETWORK', 'dropped', true) });
    expect(result.current.connection).toBe('error');
    expect(result.current.lastResult).toBeNull();
    expect(result.current.state.streak).toBeNull();
    act(() => result.current.retry());
    await advance(10);
    await answer(transports[1]!, good('F'));
    expect(onCapture).not.toHaveBeenCalled();
    expect(result.current.state.streak?.count).toBe(1);
    expect(result.current.state.phase).toBe('stabilizing');
  });

  it('a stale streak is not reused after disable then re-enable', async () => {
    const { result, rerender, props, onCapture } = setup();
    await advance(10);
    for (let i = 0; i < 4; i++) await answer(transports[0]!, good('F'));
    expect(result.current.state.streak?.count).toBe(4);
    rerender({ ...props, enabled: false });
    await advance(10);
    expect(result.current.lastResult).toBeNull();
    rerender({ ...props, enabled: true });
    await advance(10);
    expect(result.current.state.streak).toBeNull();
    await answer(transports[1]!, good('F'));
    expect(onCapture).not.toHaveBeenCalled();
    expect(result.current.state.streak?.count).toBe(1);
  });

  it('createTransport throwing ends in error instead of crashing the tree', async () => {
    const { result } = setup({
      createTransport: () => {
        throw new Error('nope');
      },
    });
    await advance(100);
    expect(result.current.connection).toBe('error');
    expect(result.current.errorMessage).toBe('The live scan could not start. Try again.');
  });

  it('rescan and reset clear a pending rotation timer', async () => {
    const { result } = setup();
    await advance(10);
    await stableFace(transports[0]!, 'F');
    expect(result.current.state.phase).toBe('rotating');
    const withRotation = vi.getTimerCount();
    act(() => result.current.rescan('F', 'green'));
    expect(vi.getTimerCount()).toBe(withRotation - 1); // the rotation timer is gone
    expect(result.current.state.phase).toBe('aligning');
    const epoch = result.current.state.epoch;
    await advance(ROTATION_MS + 50);
    expect(result.current.state.epoch).toBe(epoch); // no ROTATION_DONE fired
    await stableFace(transports[0]!, 'F');
    await answer(transports[0]!, good('F')); // the first answer after rescan was the dropped in-flight frame
    expect(result.current.state.phase).toBe('rotating');
    const withRotation2 = vi.getTimerCount();
    act(() => result.current.reset());
    expect(vi.getTimerCount()).toBe(withRotation2 - 1);
    expect(result.current.state.capturedCenters).toEqual({});
    expect(result.current.lastResult).toBeNull();
  });

  it('captures all six faces in scan order and then sends nothing', async () => {
    const { result, onCapture } = setup();
    await advance(10);
    const t = transports[0]!;
    const order: FaceId[] = ['F', 'R', 'B', 'L', 'U', 'D'];
    for (const f of order) {
      await stableFace(t, f);
      await advance(ROTATION_MS + 50);
    }
    expect(onCapture.mock.calls.map((c) => c[0])).toEqual(order);
    expect(onCapture.mock.calls.map((c) => c[1])).toEqual(order.map((f) => GRIDS[f]));
    expect(result.current.state.phase).toBe('done');
    const sent = t.sends.length;
    await advance(5000);
    expect(t.sends).toHaveLength(sent);
  });
});

describe('useLiveScan errors', () => {
  it('5 consecutive INVALID_FRAME errors stop with a message and close the transport', async () => {
    const { result } = setup();
    await advance(10);
    const t = transports[0]!;
    for (let i = 0; i < 4; i++) await answer(t, apiErr('INVALID_FRAME'));
    expect(result.current.connection).toBe('live');
    await answer(t, apiErr('FRAME_TOO_LARGE'));
    expect(result.current.connection).toBe('error');
    expect(result.current.errorMessage).toBe('The scan keeps failing. Check the camera and try again.');
    expect(t.closed).toBe(true);
    const sent = t.sends.length;
    await advance(3000);
    expect(t.sends).toHaveLength(sent);
  });

  it('a good result resets the consecutive frame-error counter', async () => {
    const { result } = setup();
    await advance(10);
    const t = transports[0]!;
    for (let i = 0; i < 4; i++) await answer(t, apiErr('INVALID_FRAME'));
    await answer(t, { ok: true, result: frame(null) });
    for (let i = 0; i < 4; i++) await answer(t, apiErr('INVALID_FRAME'));
    expect(result.current.connection).toBe('live');
    expect(t.closed).toBe(false);
  });

  it('MODEL_UNAVAILABLE is fatal', async () => {
    const { result } = setup();
    await advance(10);
    await answer(transports[0]!, apiErr('MODEL_UNAVAILABLE'));
    expect(result.current.connection).toBe('error');
    expect(result.current.errorMessage).toBe('api MODEL_UNAVAILABLE');
    expect(transports[0]!.closed).toBe(true);
  });

  it('a client error stops the loop; retry() makes a new transport and resumes; retry is a no-op otherwise', async () => {
    const { result, createTransport } = setup();
    await advance(10);
    act(() => result.current.retry());
    await advance(10);
    expect(createTransport).toHaveBeenCalledTimes(1); // not in error: no-op
    const t = transports[0]!;
    await answer(t, { ok: false, error: clientError('BAD_RESPONSE', 'garbled') });
    expect(result.current.connection).toBe('error');
    expect(result.current.errorMessage).toBe('garbled');
    expect(t.closed).toBe(true);
    const sent = t.sends.length;
    await advance(3000);
    expect(t.sends).toHaveLength(sent);
    act(() => result.current.retry());
    await advance(400);
    expect(createTransport).toHaveBeenCalledTimes(2);
    expect(result.current.connection).toBe('live');
    expect(result.current.errorMessage).toBeNull();
    expect(transports[1]!.sends).toHaveLength(1);
  });
});
