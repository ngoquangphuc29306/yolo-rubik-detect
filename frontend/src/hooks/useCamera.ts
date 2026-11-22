// Safe browser-camera lifecycle. Acquires a stream and attaches it to a <video> element; never mirrors,
// draws, captures or transmits frames. Every exit path (stop, dispose, supersede, late resolution) stops tracks.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLatestGuard } from '@/lib/request-guard';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'not-found' | 'error';
export interface CameraState {
  status: CameraStatus;
  message?: string;
}

export interface CameraControllerDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  onState: (state: CameraState) => void;
  attach: (stream: MediaStream | null) => void;
}

export interface CameraController {
  start(): void;
  stop(): void;
  dispose(): void;
}

const CONSTRAINTS: MediaStreamConstraints = {
  video: { width: 1280, height: 720, facingMode: 'environment' },
  audio: false,
};

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

const SECURE_MSG = 'Camera access requires a secure connection (localhost or HTTPS)';

function classify(err: unknown): CameraState {
  const e = (typeof err === 'object' && err !== null ? err : {}) as { name?: unknown; message?: unknown };
  const name = typeof e.name === 'string' ? e.name : '';
  const detail = typeof e.message === 'string' && e.message ? `: ${e.message}` : '';
  if (name === 'InsecureContext') return { status: 'error', message: SECURE_MSG };
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { status: 'denied', message: 'Camera permission was denied' };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return { status: 'not-found', message: 'No suitable camera was found' };
  }
  return { status: 'error', message: `Could not start the camera${detail}` };
}

export function createCameraController(deps: CameraControllerDeps): CameraController {
  const guard = createLatestGuard();
  let active: MediaStream | null = null;
  let dead = false;

  // Stops every track of the active stream and detaches it. Never throws.
  function releaseActive(): void {
    const old = active;
    active = null;
    try {
      stopTracks(old);
    } catch {
      /* keep going: detach regardless */
    }
    try {
      deps.attach(null);
    } catch {
      /* a failing detach must not block teardown */
    }
  }

  function stop(): void {
    if (dead) return;
    guard.reset();
    releaseActive();
    deps.onState({ status: 'idle' });
  }

  return {
    start() {
      if (dead) return;
      const handle = guard.begin();
      // Exactly one device is ever open: release any active stream BEFORE requesting a new one.
      releaseActive();
      deps.onState({ status: 'requesting' });
      let request: Promise<MediaStream>;
      try {
        request = deps.getUserMedia(CONSTRAINTS);
      } catch (err) {
        deps.onState(classify(err));
        return;
      }
      request.then(
        (stream) => {
          if (dead || !handle.isCurrent()) {
            stopTracks(stream);
            return;
          }
          try {
            active = stream;
            deps.attach(stream);
            deps.onState({ status: 'active' });
          } catch (err) {
            stopTracks(stream);
            releaseActive();
            try {
              deps.onState(classify(err));
            } catch {
              /* nothing more can be reported */
            }
          }
        },
        (err: unknown) => {
          if (dead || !handle.isCurrent()) return;
          deps.onState(classify(err));
        },
      );
    },
    stop,
    dispose() {
      stop();
      dead = true;
      guard.reset();
    },
  };
}

function browserGetUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== 'function') {
    throw { name: 'InsecureContext', message: SECURE_MSG };
  }
  return md.getUserMedia(constraints);
}

export function useCamera({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<CameraState>({ status: 'idle' });
  const controllerRef = useRef<CameraController | null>(null);
  const elementRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Callback ref: keeps srcObject in sync with the element lifecycle and never leaves a stale stream attached.
  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    const prev = elementRef.current;
    if (prev && prev !== el) prev.srcObject = null;
    elementRef.current = el;
    if (el) el.srcObject = streamRef.current;
  }, []);

  // One controller per mount (a fresh one after each StrictMode remount).
  useEffect(() => {
    const controller = createCameraController({
      getUserMedia: browserGetUserMedia,
      onState: setState,
      attach: (stream) => {
        streamRef.current = stream;
        if (elementRef.current) elementRef.current.srcObject = stream;
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = controllerRef.current;
    controller?.start();
    return () => controller?.stop();
  }, [enabled]);

  const start = useCallback(() => controllerRef.current?.start(), []);
  const stop = useCallback(() => controllerRef.current?.stop(), []);

  return { state, videoRef, start, stop };
}
