import { describe, expect, it } from 'vitest';
import { coachFrame, EXTENT_TOO_FAR, EXTENT_TOO_NEAR } from '@/lib/scan-coaching';
import type { FrameCell, FrameResult } from '@/types/api';

const ok: FrameCell = { color: 'green', confidence: 0.9, status: 'ok' };
const missing: FrameCell = { color: null, confidence: null, status: 'missing' };
const det = (s: number) => ({ classId: 0, color: 'green' as const, confidence: 0.9, xyxy: [0, 0, s, s] as [number, number, number, number] });

function result(over: Partial<FrameResult> = {}): FrameResult {
  return {
    type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 500, height: 500,
    detections: [], cells: [], grid: null, face: null, quality: { valid: false }, inferenceMs: 1,
    ...over,
  };
}
const faceOf = (side: number) => ({ x0: 10, y0: 10, x1: 10 + side, y1: 10 + side });
const cells = (n: number): FrameCell[] => Array.from({ length: 9 }, (_, i) => (i < n ? ok : missing));

describe('coachFrame', () => {
  it('returns nothing for null or empty results', () => {
    expect(coachFrame(null)).toEqual({ count: null, line: null });
    expect(coachFrame(result())).toEqual({ count: null, line: null });
  });

  it('counts ok cells when a lattice exists', () => {
    expect(coachFrame(result({ face: faceOf(250), cells: cells(7), quality: { valid: false, reason: 'INCOMPLETE' } })).count).toBe(7);
    expect(coachFrame(result({ face: faceOf(250), cells: cells(0) })).count).toBe(0);
  });

  it('counts detections (capped at 9) when there is no lattice', () => {
    expect(coachFrame(result({ detections: [det(20), det(20)] })).count).toBe(2);
    expect(coachFrame(result({ detections: Array.from({ length: 12 }, () => det(20)) })).count).toBe(9);
  });

  it('too small a face asks to move closer; boundary is exclusive', () => {
    const small = coachFrame(result({ face: faceOf(80), cells: cells(9) }));
    expect(small.line).toBe('Move the cube a little closer');
    const edge = coachFrame(result({ face: faceOf(500 * EXTENT_TOO_NEAR), cells: cells(9) }));
    expect(edge.line).not.toBe('Move the cube a little closer');
  });

  it('too large a face asks to move farther; boundary is exclusive', () => {
    expect(coachFrame(result({ face: faceOf(480), cells: cells(9) })).line).toBe('Move the cube a little farther');
    expect(coachFrame(result({ face: faceOf(500 * EXTENT_TOO_FAR), cells: cells(9) })).line).not.toBe('Move the cube a little farther');
  });

  it('INCOMPLETE with a big face asks to move farther, with a mid face keeps stickers visible', () => {
    const big = coachFrame(result({ face: faceOf(400), cells: cells(6), quality: { valid: false, reason: 'INCOMPLETE' } }));
    expect(big.line).toBe('Move the cube a little farther');
    const mid = coachFrame(result({ face: faceOf(250), cells: cells(6), quality: { valid: false, reason: 'INCOMPLETE' } }));
    expect(mid.line).toBe('Keep all nine stickers inside the square');
  });

  it('TILTED and MISALIGNED ask for a flat face', () => {
    for (const reason of ['TILTED', 'MISALIGNED']) {
      expect(coachFrame(result({ face: faceOf(250), cells: cells(9), quality: { valid: false, reason } })).line).toBe(
        'Hold the cube flat toward the camera',
      );
    }
  });

  it('AMBIGUOUS mentions glare and light', () => {
    expect(coachFrame(result({ face: faceOf(250), cells: cells(8), quality: { valid: false, reason: 'AMBIGUOUS' } })).line).toBe(
      'Some stickers are unclear — reduce glare or change the light',
    );
  });

  it('a valid frame says hold steady', () => {
    const r = coachFrame(result({ face: faceOf(250), cells: cells(9), grid: Array(9).fill('green'), quality: { valid: true } }));
    expect(r).toEqual({ count: 9, line: 'Hold steady' });
  });

  it('NO_FACE with tiny detections asks to move closer; with no detections gives no line', () => {
    expect(coachFrame(result({ detections: [det(10), det(10)], quality: { valid: false, reason: 'NO_FACE' } })).line).toBe(
      'Move the cube a little closer',
    );
    expect(coachFrame(result({ quality: { valid: false, reason: 'NO_FACE' } })).line).toBeNull();
  });

  it('never claims orientation or verification', () => {
    for (const reason of ['NO_FACE', 'INCOMPLETE', 'AMBIGUOUS', 'MISALIGNED', 'TILTED', undefined]) {
      const r = coachFrame(result({ face: faceOf(250), cells: cells(5), quality: { valid: false, reason } }));
      expect(r.line ?? '').not.toMatch(/verified|orientation/i);
    }
  });

  it('ignores a zero width safely', () => {
    expect(() => coachFrame(result({ width: 0, face: faceOf(100), cells: cells(9) }))).not.toThrow();
  });
});
