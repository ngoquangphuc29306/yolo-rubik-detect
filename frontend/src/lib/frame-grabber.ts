// Crops the guide square from a <video> into a JPEG blob. Unmirrored: the backend sees real frame coordinates.
// The blob is returned to the caller and never stored or logged here.
import type { GuideSquare } from '@/lib/scan-roi';

export async function grabFrame(video: HTMLVideoElement, square: GuideSquare, size: number): Promise<Blob | null> {
  if (video.readyState < 2 || !(video.videoWidth > 0) || !(size > 0)) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, square.x, square.y, square.side, square.side, 0, 0, size, size);
    return await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}
