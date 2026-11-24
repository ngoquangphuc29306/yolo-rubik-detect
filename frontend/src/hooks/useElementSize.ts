// Element and video frame sizes for overlay mapping. Browser lifecycle only; the maths lives in lib/.
import { useEffect, useState } from 'react';
import type { Size } from '@/lib/contain-transform';

const ZERO: Size = { w: 0, h: 0 };

export function useElementSize(el: HTMLElement | null): Size {
  const [size, setSize] = useState<Size>(ZERO);
  useEffect(() => {
    if (!el) {
      setSize(ZERO);
      return;
    }
    const read = (w: number, h: number) => setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    const r = el.getBoundingClientRect();
    read(r.width, r.height);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (box) read(box.width, box.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return size;
}

/** The video's intrinsic frame size, re-read on loadedmetadata and resize. */
export function useVideoFrameSize(video: HTMLVideoElement | null): Size {
  const [size, setSize] = useState<Size>(ZERO);
  useEffect(() => {
    if (!video) {
      setSize(ZERO);
      return;
    }
    const read = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    read();
    video.addEventListener('loadedmetadata', read);
    video.addEventListener('resize', read);
    return () => {
      video.removeEventListener('loadedmetadata', read);
      video.removeEventListener('resize', read);
    };
  }, [video]);
  return size;
}
