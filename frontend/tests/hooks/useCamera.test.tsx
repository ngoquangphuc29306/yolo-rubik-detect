// @vitest-environment jsdom
import { StrictMode, useEffect, type ReactNode } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCameraController, useCamera, type CameraState } from '@/hooks/useCamera';

// ---- fakes: no real camera is ever touched ---------------------------------------
interface FakeTrack {
  stopped: boolean;
  stop: ReturnType<typeof vi.fn>;
}
interface FakeStream {
  id: number;
  tracks: FakeTrack[];
  getTracks(): FakeTrack[];
}
let streamId = 0;
function fakeStream(trackCount = 1): FakeStream {
  const tracks: FakeTrack[] = [];
  for (let i = 0; i < trackCount; i++) {
    const t: FakeTrack = { stopped: false, stop: vi.fn() };
    t.stop.mockImplementation(() => {
      t.stopped = true;
    });
    tracks.push(t);
  }
  return { id: ++streamId, tracks, getTracks: () => tracks };
}
const asStream = (s: FakeStream) => s as unknown as MediaStream;
const live = (s: FakeStream) => s.tracks.some((t) => !t.stopped);
const allStopped = (s: FakeStream) => s.tracks.every((t) => t.stopped);

interface Deferred {
  resolve(s: FakeStream): void;
  reject(e: unknown): void;
  promise: Promise<MediaStream>;
  done?: boolean;
}
let pending: Deferred[] = [];
const getUserMedia = vi.fn((_c: MediaStreamConstraints) => {
  let resolve!: (s: MediaStream) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<MediaStream>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  pending.push({ promise, resolve: (s) => resolve(asStream(s)), reject });
  return promise;
});
const domError = (name: string) => Object.assign(new Error(name), { name });
const flush = () => act(async () => {});

beforeEach(() => {
  pending = [];
  getUserMedia.mockClear();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- controller -------------------------------------------------------------------
describe('createCameraController', () => {
  function setup() {
    const states: CameraState[] = [];
    const attach = vi.fn();
    const c = createCameraController({ getUserMedia, onState: (s) => states.push(s), attach });
    return { c, states, attach, last: () => states[states.length - 1] };
  }

  it('requests legacy video constraints without audio', () => {
    const { c, last } = setup();
    c.start();
    expect(last().status).toBe('requesting');
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { width: 1280, height: 720, facingMode: 'environment' },
      audio: false,
    });
  });

  it('success -> active, attach called, tracks untouched', async () => {
    const { c, last, attach } = setup();
    c.start();
    const s = fakeStream(2);
    pending[0].resolve(s);
    await flush();
    expect(last().status).toBe('active');
    expect(attach).toHaveBeenCalledWith(s);
    expect(s.tracks.every((t) => !t.stopped)).toBe(true);
  });

  it('stop() while active stops all tracks, attaches null, idle; idempotent', async () => {
    const { c, last, attach } = setup();
    c.start();
    const s = fakeStream(2);
    pending[0].resolve(s);
    await flush();
    c.stop();
    expect(allStopped(s)).toBe(true);
    expect(attach).toHaveBeenLastCalledWith(null);
    expect(last().status).toBe('idle');
    c.stop();
    expect(s.tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(last().status).toBe('idle');
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['DevicesNotFoundError', 'not-found'],
    ['AbortError', 'error'],
    ['TypeError', 'error'],
  ])('rejection %s -> %s without attach', async (name, status) => {
    const { c, last, attach } = setup();
    c.start();
    pending[0].reject(domError(name));
    await flush();
    expect(last().status).toBe(status);
    expect(last().message).toBeTruthy();
    expect(attach).not.toHaveBeenCalled();
  });

  it('non-Error rejection -> error', async () => {
    const { c, last } = setup();
    c.start();
    pending[0].reject('boom');
    await flush();
    expect(last().status).toBe('error');
  });

  it('RACE: resolves after stop() -> tracks stopped, never attached, stays idle', async () => {
    const { c, last, attach } = setup();
    c.start();
    c.stop();
    const s = fakeStream();
    pending[0].resolve(s);
    await flush();
    expect(allStopped(s)).toBe(true);
    expect(attach).not.toHaveBeenCalledWith(s);
    expect(last().status).toBe('idle');
  });

  it('RACE: resolves after dispose() -> tracks stopped, nothing attached or reported', async () => {
    const { c, states, attach } = setup();
    c.start();
    c.dispose();
    const n = states.length;
    const s = fakeStream();
    pending[0].resolve(s);
    await flush();
    expect(allStopped(s)).toBe(true);
    expect(attach).not.toHaveBeenCalledWith(s);
    expect(states.length).toBe(n);
  });

  it('start() after dispose() never acquires', () => {
    const { c } = setup();
    c.dispose();
    c.start();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('RACE: start(); start(); first resolves late -> first stopped, second the only live one', async () => {
    const { c, last, attach } = setup();
    c.start();
    c.start();
    const s1 = fakeStream();
    const s2 = fakeStream();
    pending[1].resolve(s2);
    await flush();
    pending[0].resolve(s1);
    await flush();
    expect(allStopped(s1)).toBe(true);
    expect(live(s2)).toBe(true);
    expect(attach).not.toHaveBeenCalledWith(s1);
    expect(last().status).toBe('active');
  });

  it('RACE: opposite order also leaves exactly one live stream', async () => {
    const { c, last, attach } = setup();
    c.start();
    c.start();
    const s1 = fakeStream();
    const s2 = fakeStream();
    pending[0].resolve(s1);
    await flush();
    pending[1].resolve(s2);
    await flush();
    expect(allStopped(s1)).toBe(true);
    expect(live(s2)).toBe(true);
    expect(attach).toHaveBeenLastCalledWith(s2);
    expect(last().status).toBe('active');
  });

  it('restart while active stops the previous stream when the new one arrives', async () => {
    const { c } = setup();
    c.start();
    const s1 = fakeStream();
    pending[0].resolve(s1);
    await flush();
    c.start();
    const s2 = fakeStream();
    pending[1].resolve(s2);
    await flush();
    expect(allStopped(s1)).toBe(true);
    expect(live(s2)).toBe(true);
  });

  it('rejection of a superseded request is ignored', async () => {
    const { c, last } = setup();
    c.start();
    c.start();
    pending[0].reject(domError('NotAllowedError'));
    await flush();
    expect(last().status).toBe('requesting');
    pending[1].resolve(fakeStream());
    await flush();
    expect(last().status).toBe('active');
  });

  it('rejection of a superseded request does not overwrite an active newer one', async () => {
    const { c, last } = setup();
    c.start();
    c.start();
    pending[1].resolve(fakeStream());
    await flush();
    pending[0].reject(domError('NotAllowedError'));
    await flush();
    expect(last().status).toBe('active');
  });

  it('rejection after stop() is ignored', async () => {
    const { c, last } = setup();
    c.start();
    c.stop();
    pending[0].reject(domError('NotAllowedError'));
    await flush();
    expect(last().status).toBe('idle');
  });

  it('a synchronous getUserMedia throw becomes an error state', () => {
    const states: CameraState[] = [];
    const c = createCameraController({
      getUserMedia: () => {
        throw new TypeError('nope');
      },
      onState: (s) => states.push(s),
      attach: vi.fn(),
    });
    c.start();
    expect(states[states.length - 1].status).toBe('error');
  });
});

// ---- hook -------------------------------------------------------------------------
describe('useCamera', () => {
  function mountHook(enabled: boolean, strict = false) {
    const wrapper = strict ? ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> : undefined;
    return renderHook(({ enabled: e }) => useCamera({ enabled: e }), { initialProps: { enabled }, wrapper });
  }
  const resolveAll = async (made: FakeStream[]) => {
    for (const d of pending) {
      if (d.done) continue;
      d.done = true;
      const s = fakeStream();
      made.push(s);
      d.resolve(s);
    }
    await flush();
  };

  it('enabled -> requesting then active; idle when disabled', async () => {
    const { result, rerender } = mountHook(false);
    expect(result.current.state.status).toBe('idle');
    expect(getUserMedia).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(result.current.state.status).toBe('requesting');
    const made: FakeStream[] = [];
    await resolveAll(made);
    expect(result.current.state.status).toBe('active');
    rerender({ enabled: false });
    expect(allStopped(made[0])).toBe(true);
    expect(result.current.state.status).toBe('idle');
  });

  it('unmount while active stops tracks', async () => {
    const { unmount } = mountHook(true);
    const made: FakeStream[] = [];
    await resolveAll(made);
    unmount();
    expect(allStopped(made[0])).toBe(true);
  });

  it('RACE: resolves after unmount -> stopped, no setState-on-unmounted warning', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = mountHook(true);
    unmount();
    const made: FakeStream[] = [];
    await resolveAll(made);
    expect(allStopped(made[0])).toBe(true);
    expect(err).not.toHaveBeenCalled();
  });

  it('StrictMode double mount leaves exactly one live stream', async () => {
    mountHook(true, true);
    const made: FakeStream[] = [];
    await resolveAll(made);
    expect(made.length).toBeGreaterThanOrEqual(1);
    expect(made.filter(live)).toHaveLength(1);
    expect(made.filter((s) => !live(s)).every(allStopped)).toBe(true);
  });

  it('StrictMode with the newest request resolving first still leaves one live stream', async () => {
    mountHook(true, true);
    const made: FakeStream[] = [];
    const last = pending.length - 1;
    const sLast = fakeStream();
    made.push(sLast);
    pending[last].resolve(sLast);
    pending[last].done = true;
    await flush();
    await resolveAll(made);
    expect(made.filter(live)).toHaveLength(1);
    expect(live(sLast)).toBe(true);
  });

  it('enabled true->false->true cycles leave exactly one live stream', async () => {
    const { rerender } = mountHook(true);
    const made: FakeStream[] = [];
    await resolveAll(made);
    rerender({ enabled: false });
    rerender({ enabled: true });
    await resolveAll(made);
    rerender({ enabled: false });
    rerender({ enabled: true });
    await resolveAll(made);
    expect(made.filter(live)).toHaveLength(1);
  });

  it('manual stop() and start() work', async () => {
    const { result } = mountHook(true);
    const made: FakeStream[] = [];
    await resolveAll(made);
    act(() => result.current.stop());
    expect(allStopped(made[0])).toBe(true);
    expect(result.current.state.status).toBe('idle');
    act(() => result.current.start());
    await resolveAll(made);
    expect(result.current.state.status).toBe('active');
    expect(made.filter(live)).toHaveLength(1);
  });

  it('denied permission surfaces as state with no tracks', async () => {
    const { result } = mountHook(true);
    await act(async () => pending[0].reject(domError('NotAllowedError')));
    expect(result.current.state.status).toBe('denied');
  });

  type Api = { current?: ReturnType<typeof useCamera> };
  function VideoHost({ enabled, show, api }: { enabled: boolean; show: boolean; api: Api }) {
    const cam = useCamera({ enabled });
    useEffect(() => {
      api.current = cam;
    });
    return show ? <video data-testid="v" ref={cam.videoRef} /> : null;
  }

  it('sets srcObject on the video element and clears it on stop', async () => {
    const api: Api = {};
    const { getByTestId } = render(<VideoHost enabled show api={api} />);
    const made: FakeStream[] = [];
    await resolveAll(made);
    const video = getByTestId('v') as HTMLVideoElement;
    expect(video.srcObject).toBe(made[0]);
    act(() => api.current!.stop());
    expect(video.srcObject).toBeNull();
    expect(allStopped(made[0])).toBe(true);
  });

  it('attaches a stream that arrived before the video element mounted', async () => {
    const api: Api = {};
    const { rerender, getByTestId } = render(<VideoHost enabled show={false} api={api} />);
    const made: FakeStream[] = [];
    await resolveAll(made);
    rerender(<VideoHost enabled show api={api} />);
    expect((getByTestId('v') as HTMLVideoElement).srcObject).toBe(made[0]);
  });

  it('clears srcObject when the video element unmounts', async () => {
    const api: Api = {};
    const { rerender, getByTestId } = render(<VideoHost enabled show api={api} />);
    const made: FakeStream[] = [];
    await resolveAll(made);
    const video = getByTestId('v') as HTMLVideoElement;
    rerender(<VideoHost enabled show={false} api={api} />);
    expect(video.srcObject).toBeNull();
  });
});
