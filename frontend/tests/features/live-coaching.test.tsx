// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveViewport, type LiveScanView } from '@/features/scanner/LiveViewport';
import { initialLiveScanState, type LiveScanState } from '@/lib/live-scan-machine';
import type { FrameCell, FrameResult } from '@/types/api';
import { netMirror } from '../helpers/mirror';

const ok: FrameCell = { color: 'green', confidence: 0.9, status: 'ok' };
const missing: FrameCell = { color: null, confidence: null, status: 'missing' };
const result = (over: Partial<FrameResult> = {}): FrameResult => ({
  type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 500, height: 500,
  detections: [], cells: Array.from({ length: 9 }, (_, i) => (i < 7 ? ok : missing)),
  grid: null, face: { x0: 100, y0: 100, x1: 350, y1: 350 },
  quality: { valid: false, reason: 'INCOMPLETE' }, inferenceMs: 1, ...over,
});

function view(state: Partial<LiveScanState>, lastResult: FrameResult | null): LiveScanView {
  return { connection: 'live', state: { ...initialLiveScanState(), ...state }, lastResult, errorMessage: null, onRetry: vi.fn() };
}
const r = (scan: LiveScanView) =>
  render(<LiveViewport camera={{ status: 'active' } as never} videoRef={() => {}} onEnableCamera={() => {}} scan={scan} />);

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 500 } as DOMRect);
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 1280, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 720, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('live detection coaching', () => {
  it('shows a sticker count chip that is not mirrored', () => {
    r(view({ phase: 'aligning', hint: 'Some stickers are not detected. Hold the face flat and steady.' }, result()));
    const chip = screen.getByText('7 of 9 stickers seen');
    expect(netMirror(chip)).toBe(1);
    expect(screen.getByTestId('mirror-layer').contains(chip)).toBe(false);
  });

  it('replaces the generic reason hint with the coaching line', () => {
    r(view({ phase: 'aligning', hint: 'Some stickers are not detected. Hold the face flat and steady.' }, result({ face: { x0: 10, y0: 10, x1: 480, y1: 480 } })));
    expect(screen.getByText('Move the cube a little farther')).toBeTruthy();
    expect(screen.queryByText(/not detected/)).toBeNull();
    expect(netMirror(screen.getByText('Move the cube a little farther'))).toBe(1);
  });

  it('keeps colour-gate hints ahead of coaching', () => {
    const gate = 'That is the white (top) face. Keep white on top and turn the whole cube the way the arrow points.';
    r(view({ phase: 'aligning', stage: 'R', hint: gate, gateRejected: 'white' }, result()));
    expect(screen.getByText(gate)).toBeTruthy();
    expect(screen.queryByText('Keep all nine stickers inside the square')).toBeNull();
  });

  it('shows Hold steady while stabilizing', () => {
    r(view({ phase: 'stabilizing', hint: null }, result({ quality: { valid: true }, grid: Array(9).fill('green') as never, cells: Array(9).fill(ok) })));
    expect(screen.getByText('Hold steady')).toBeTruthy();
    expect(screen.getByText('9 of 9 stickers seen')).toBeTruthy();
  });

  it('shows nothing without a result', () => {
    r(view({ phase: 'aligning', hint: null }, null));
    expect(screen.queryByText(/stickers seen/)).toBeNull();
  });

  it('shows no chip after capture or while rotating', () => {
    r(view({ phase: 'rotating', step: 1, stage: 'R' }, result()));
    expect(screen.queryByText(/stickers seen/)).toBeNull();
  });
});

describe('isReasonHint', () => {
  it('matches only the generic per-frame hints', async () => {
    const { isReasonHint, hintForReason } = await import('@/lib/live-scan-machine');
    expect(isReasonHint(hintForReason('TILTED'))).toBe(true);
    expect(isReasonHint(hintForReason(undefined))).toBe(true);
    expect(isReasonHint('Could not save this face — hold steady to try again.')).toBe(false);
    expect(isReasonHint(null)).toBe(false);
  });
});
