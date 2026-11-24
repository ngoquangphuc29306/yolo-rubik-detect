// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElementSize, useVideoFrameSize } from '@/hooks/useElementSize';

class FakeRO {
  static instances: FakeRO[] = [];
  disconnected = false;
  constructor(public cb: (e: { contentRect: { width: number; height: number } }[]) => void) {
    FakeRO.instances.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
}
const elWith = (w: number, h: number) => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ width: w, height: h }) as DOMRect;
  return el;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  FakeRO.instances = [];
});

describe('useElementSize', () => {
  it('reads the initial size, follows ResizeObserver and disconnects on cleanup', () => {
    vi.stubGlobal('ResizeObserver', FakeRO);
    const el = elWith(300, 200);
    const { result, unmount } = renderHook(() => useElementSize(el));
    expect(result.current).toEqual({ w: 300, h: 200 });
    act(() => FakeRO.instances[0]!.cb([{ contentRect: { width: 600, height: 400 } }]));
    expect(result.current).toEqual({ w: 600, h: 400 });
    unmount();
    expect(FakeRO.instances[0]!.disconnected).toBe(true);
  });

  it('falls back to the initial measurement without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { result } = renderHook(() => useElementSize(elWith(120, 80)));
    expect(result.current).toEqual({ w: 120, h: 80 });
  });

  it('is zero for a null element', () => {
    const { result } = renderHook(() => useElementSize(null));
    expect(result.current).toEqual({ w: 0, h: 0 });
  });
});

describe('useVideoFrameSize', () => {
  it('re-reads on loadedmetadata and resize, and stops listening on cleanup', () => {
    const video = document.createElement('video');
    let w = 0;
    let h = 0;
    Object.defineProperty(video, 'videoWidth', { get: () => w });
    Object.defineProperty(video, 'videoHeight', { get: () => h });
    const { result, unmount } = renderHook(() => useVideoFrameSize(video));
    expect(result.current).toEqual({ w: 0, h: 0 });
    w = 1280;
    h = 720;
    act(() => void video.dispatchEvent(new Event('loadedmetadata')));
    expect(result.current).toEqual({ w: 1280, h: 720 });
    w = 640;
    h = 480;
    act(() => void video.dispatchEvent(new Event('resize')));
    expect(result.current).toEqual({ w: 640, h: 480 });
    unmount();
    w = 1;
    h = 1;
    video.dispatchEvent(new Event('resize'));
    expect(result.current).toEqual({ w: 640, h: 480 });
  });

  it('is zero for a null video', () => {
    expect(renderHook(() => useVideoFrameSize(null)).result.current).toEqual({ w: 0, h: 0 });
  });
});
