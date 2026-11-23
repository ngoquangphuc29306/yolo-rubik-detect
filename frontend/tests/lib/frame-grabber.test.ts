// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { grabFrame } from '@/lib/frame-grabber';

const video = (over: Record<string, number> = {}) =>
  ({ videoWidth: 1280, videoHeight: 720, readyState: 4, ...over }) as unknown as HTMLVideoElement;

afterEach(() => vi.restoreAllMocks());

function stubCanvas(blob: Blob | null) {
  const ctx = { drawImage: vi.fn(), scale: vi.fn(), setTransform: vi.fn(), transform: vi.fn(), translate: vi.fn() };
  const toBlob = vi.fn((cb: BlobCallback, _type?: string, _q?: number) => cb(blob));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob as never);
  return { ctx, toBlob };
}

describe('grabFrame', () => {
  it('draws the guide rectangle unmirrored and encodes JPEG 0.85', async () => {
    const blob = new Blob(['j'], { type: 'image/jpeg' });
    const { ctx, toBlob } = stubCanvas(blob);
    const v = video();
    const out = await grabFrame(v, { x: 381, y: 101, side: 518 }, 518);
    expect(out).toBe(blob);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(v, 381, 101, 518, 518, 0, 0, 518, 518);
    expect(ctx.scale).not.toHaveBeenCalled();
    expect(ctx.setTransform).not.toHaveBeenCalled();
    expect(ctx.transform).not.toHaveBeenCalled();
    expect(toBlob.mock.calls[0]![1]).toBe('image/jpeg');
    expect(toBlob.mock.calls[0]![2]).toBe(0.85);
  });

  it('stays unmirrored even when the displayed video is CSS-mirrored', async () => {
    const { ctx } = stubCanvas(new Blob(['j']));
    const v = Object.assign(document.createElement('video'), {});
    v.style.transform = 'scaleX(-1)';
    Object.defineProperty(v, 'videoWidth', { value: 1280 });
    Object.defineProperty(v, 'videoHeight', { value: 720 });
    Object.defineProperty(v, 'readyState', { value: 4 });
    await grabFrame(v, { x: 316, y: 36, side: 648 }, 640);
    expect(ctx.drawImage).toHaveBeenCalledWith(v, 316, 36, 648, 648, 0, 0, 640, 640);
    expect(ctx.scale).not.toHaveBeenCalled();
    expect(ctx.setTransform).not.toHaveBeenCalled();
    expect(ctx.transform).not.toHaveBeenCalled();
    expect(ctx.translate).not.toHaveBeenCalled();
  });

  it('downsizes to the crop size without flipping', async () => {
    const { ctx } = stubCanvas(new Blob(['j']));
    await grabFrame(video({ videoWidth: 1920, videoHeight: 1080 }), { x: 570, y: 151, side: 777 }, 640);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 570, 151, 777, 777, 0, 0, 640, 640);
  });

  it('returns null when the video is not ready, without touching a canvas', async () => {
    const { ctx } = stubCanvas(new Blob(['j']));
    expect(await grabFrame(video({ readyState: 1 }), { x: 0, y: 0, side: 10 }, 10)).toBeNull();
    expect(await grabFrame(video({ videoWidth: 0 }), { x: 0, y: 0, side: 10 }, 10)).toBeNull();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('returns null when encoding fails or there is no 2d context', async () => {
    stubCanvas(null);
    expect(await grabFrame(video(), { x: 0, y: 0, side: 10 }, 10)).toBeNull();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(await grabFrame(video(), { x: 0, y: 0, side: 10 }, 10)).toBeNull();
  });
});
