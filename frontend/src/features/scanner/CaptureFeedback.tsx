// Brief confirmation that a face was stored: a single green fade on the guide zone (~400 ms, no strobe),
// a check mark with the stage letter (~900 ms), a polite announcement and the existing capture chime.
// Triggered only by an increase of `capturedCount` while mounted; owns no cube or scan state.
import * as React from 'react';
import { Check } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { playCaptureSound } from '@/lib/audio';
import type { GuideRect } from '@/lib/scan-roi';
import type { FaceId } from '@/types/cube';
import { FACE_NAMES } from './scan-guide';

export const FLASH_MS = 400;
export const CHECK_MS = 900;

export interface CaptureFeedbackProps {
  capturedCount: number;
  /** The face that was just stored; read when the count rises. */
  face: FaceId | null;
  soundEnabled: boolean;
  /** Guide zone in view pixels; the flash outlines it. Null: the whole frame edge. */
  zone: GuideRect | null;
}

export function CaptureFeedback({ capturedCount, face, soundEnabled, zone }: CaptureFeedbackProps) {
  const reduced = usePrefersReducedMotion();
  const previous = React.useRef(capturedCount);
  const [shown, setShown] = React.useState<{ id: number; face: FaceId | null } | null>(null);
  const [flash, setFlash] = React.useState(false);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const optsRef = React.useRef({ face, soundEnabled });
  optsRef.current = { face, soundEnabled };

  React.useEffect(() => {
    const rose = capturedCount > previous.current;
    previous.current = capturedCount;
    if (!rose) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShown((s) => ({ id: (s?.id ?? 0) + 1, face: optsRef.current.face }));
    setFlash(true);
    timers.current.push(setTimeout(() => setFlash(false), FLASH_MS));
    timers.current.push(setTimeout(() => setShown(null), CHECK_MS));
    if (optsRef.current.soundEnabled) playCaptureSound(true);
  }, [capturedCount]);

  React.useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const name = shown?.face ? FACE_NAMES[shown.face].fullName : null;
  const zoneStyle: React.CSSProperties = zone
    ? { left: zone.x, top: zone.y, width: zone.w, height: zone.h }
    : { inset: 0 };

  return (
    <>
      {flash && !reduced && (
        <div
          data-testid="capture-flash"
          aria-hidden="true"
          className="absolute z-10 rounded-lg border-4 border-emerald-400 pointer-events-none animate-capture-flash"
          style={zoneStyle}
        />
      )}
      {shown && (
        <div
          data-testid="capture-check"
          aria-hidden="true"
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 pointer-events-none${reduced ? '' : ' animate-capture-check'}`}
        >
          <div className="h-20 w-20 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg">
            <Check className="h-12 w-12 text-white" strokeWidth={3} />
          </div>
          <span className="rounded-md bg-black/65 px-3 py-1 text-sm font-semibold text-emerald-300">
            {shown.face ?? 'Face'} captured
          </span>
        </div>
      )}
      <span aria-live="polite" className="sr-only">
        {shown ? `${name ? `${name} face` : 'Face'} captured` : ''}
      </span>
    </>
  );
}
