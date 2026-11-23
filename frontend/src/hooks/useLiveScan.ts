// Live capture loop: video -> guide crop -> transport (one frame in flight) -> pure scan machine.
// The stage advances only after onCapture() reports the grid was stored.
import { useCallback, useEffect, useRef, useState } from 'react';
import { grabFrame as defaultGrabFrame } from '@/lib/frame-grabber';
import { cropSize, guideSquare, type GuideSquare } from '@/lib/scan-roi';
import {
  initialLiveScanState,
  liveScanReducer,
  ROTATION_MS,
  type LiveScanEvent,
  type LiveScanState,
} from '@/lib/live-scan-machine';
import type { ScanTransport, SendResult } from '@/services/scan-transport';
import type { FrameResult } from '@/types/api';
import type { ColorName, FaceGrid, FaceId } from '@/types/cube';

export type LiveConnection = 'idle' | 'connecting' | 'live' | 'error';
type Centers = Partial<Record<FaceId, ColorName>>;

export interface UseLiveScanOptions {
  enabled: boolean;
  video: HTMLVideoElement | null;
  createTransport: () => ScanTransport;
  /** Must return true ONLY when the grid was stored. */
  onCapture: (face: FaceId, grid: FaceGrid) => boolean;
  initialCenters?: Centers;
  grabFrame?: (video: HTMLVideoElement, square: GuideSquare, size: number) => Promise<Blob | null>;
  now?: () => number;
  minIntervalMs?: number;
}

export interface UseLiveScanResult {
  connection: LiveConnection;
  state: LiveScanState;
  lastResult: FrameResult | null;
  errorMessage: string | null;
  rescan: (face: FaceId, previousCenter: ColorName) => void;
  reset: (centers?: Centers) => void;
  retry: () => void;
}

const IDLE_SLEEP_MS = 100;
const MAX_FRAME_ERRORS = 5;
const FRAME_ERROR_CODES: readonly string[] = ['FRAME_TOO_LARGE', 'INVALID_FRAME'];

export function useLiveScan(options: UseLiveScanOptions): UseLiveScanResult {
  const { enabled, video } = options;
  const optsRef = useRef(options);
  optsRef.current = options;

  const stateRef = useRef<LiveScanState | null>(null);
  stateRef.current ??= initialLiveScanState(options.initialCenters);
  const [state, setState] = useState<LiveScanState>(stateRef.current);
  const [connection, setConnection] = useState<LiveConnection>('idle');
  const [lastResult, setLastResult] = useState<FrameResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mountedRef = useRef(false);
  const rotationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatch = useCallback((e: LiveScanEvent): LiveScanState => {
    const next = liveScanReducer(stateRef.current!, e);
    stateRef.current = next;
    if (mountedRef.current) setState(next);
    return next;
  }, []);

  const clearRotation = useCallback(() => {
    if (rotationTimer.current !== null) clearTimeout(rotationTimer.current);
    rotationTimer.current = null;
  }, []);

  const scheduleRotation = useCallback(() => {
    clearRotation();
    if (stateRef.current!.phase !== 'rotating') return;
    const epoch = stateRef.current!.epoch;
    rotationTimer.current = setTimeout(() => {
      rotationTimer.current = null;
      dispatch({ type: 'ROTATION_DONE', epoch });
    }, ROTATION_MS);
  }, [clearRotation, dispatch]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !video) {
      setConnection('idle');
      setLastResult(null);
      setErrorMessage(null);
      return;
    }
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });
    const clock = () => (optsRef.current.now ?? (() => performance.now()))();
    const transport = optsRef.current.createTransport();
    setConnection('connecting');
    setErrorMessage(null);

    const stop = (message: string) => {
      if (cancelled) return;
      cancelled = true;
      setConnection('error');
      setErrorMessage(message);
      transport.close();
    };

    const handleCapture = () => {
      const pending = stateRef.current!.pendingCapture;
      if (stateRef.current!.phase !== 'captured' || !pending) return;
      let stored = false;
      try {
        stored = optsRef.current.onCapture(pending.face, pending.grid) === true;
      } catch {
        stored = false;
      }
      if (stored) {
        dispatch({ type: 'CAPTURE_STORED', epoch: stateRef.current!.epoch });
        scheduleRotation();
      } else {
        dispatch({ type: 'CAPTURE_FAILED', epoch: stateRef.current!.epoch });
      }
    };

    const run = async () => {
      try {
        const connected = await transport.connect();
        if (cancelled) return;
        if (!connected.ok) {
          stop(connected.error.message);
          return;
        }
      } catch {
        stop('Could not open the vision connection.');
        return;
      }
      setConnection('live');
      scheduleRotation(); // resume a pause that a previous connection left half-way
      let lastStart = Number.NEGATIVE_INFINITY;
      let frameErrors = 0;
      while (!cancelled) {
        const phase = stateRef.current!.phase;
        if (phase === 'captured' || phase === 'rotating' || phase === 'done' || video.readyState < 2) {
          await sleep(IDLE_SLEEP_MS);
          continue;
        }
        const wait = lastStart + (optsRef.current.minIntervalMs ?? 100) - clock();
        if (wait > 0) {
          await sleep(wait);
          continue;
        }
        const epoch = stateRef.current!.epoch;
        const square = guideSquare({ w: video.videoWidth, h: video.videoHeight });
        if (!square) {
          await sleep(IDLE_SLEEP_MS);
          continue;
        }
        let blob: Blob | null = null;
        try {
          blob = await (optsRef.current.grabFrame ?? defaultGrabFrame)(video, square, cropSize(square));
        } catch {
          blob = null;
        }
        if (cancelled) return;
        if (!blob) {
          await sleep(IDLE_SLEEP_MS);
          continue;
        }
        lastStart = clock();
        let r: SendResult;
        try {
          r = await transport.send(blob);
        } catch {
          stop('The vision connection failed.');
          return;
        }
        blob = null; // the frame lives only in this iteration
        if (cancelled) return;
        if (r.ok) {
          frameErrors = 0;
          setLastResult(r.result);
          dispatch({ type: 'RESULT', epoch, result: r.result, at: clock() });
          handleCapture();
        } else if (r.error.kind === 'api' && FRAME_ERROR_CODES.includes(r.error.code)) {
          frameErrors += 1;
          if (frameErrors >= MAX_FRAME_ERRORS) {
            stop('The scan keeps failing. Check the camera and try again.');
            return;
          }
        } else {
          stop(r.error.message);
          return;
        }
      }
    };
    void run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
      clearRotation();
      transport.close();
    };
  }, [enabled, video, attempt, dispatch, scheduleRotation, clearRotation]);

  const rescan = useCallback(
    (face: FaceId, previousCenter: ColorName) => {
      clearRotation();
      dispatch({ type: 'RESCAN', face, previousCenter });
    },
    [clearRotation, dispatch],
  );

  const reset = useCallback(
    (centers?: Centers) => {
      clearRotation();
      setLastResult(null);
      dispatch({ type: 'RESET', centers });
    },
    [clearRotation, dispatch],
  );

  const retry = useCallback(() => {
    if (connection === 'error') setAttempt((a) => a + 1);
  }, [connection]);

  return { connection, state, lastResult, errorMessage, rescan, reset, retry };
}
