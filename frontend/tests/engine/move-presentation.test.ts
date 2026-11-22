// Presentation descriptors against ARCHITECTURE 7.2 (ported from the retired legacy-characterization test,
// now asserted on engine/move-presentation parseMove).
import { describe, expect, it } from 'vitest';
import { parseMove } from '@/engine/move-presentation';
import type { FaceId, MoveToken } from '@/types/cube';

const FACES: FaceId[] = ['U', 'D', 'R', 'L', 'F', 'B'];
const MOVES = FACES.flatMap((f) => [f, `${f}'`, `${f}2`]) as MoveToken[];
const QUARTER = Math.PI / 2;

// Quarter turn clockwise viewed from outside the face, about the positive axis.
const SPEC: Record<FaceId, { axis: 'x' | 'y' | 'z'; layer: 1 | -1; cwDegrees: number }> = {
  R: { axis: 'x', layer: 1, cwDegrees: -90 },
  L: { axis: 'x', layer: -1, cwDegrees: 90 },
  U: { axis: 'y', layer: 1, cwDegrees: -90 },
  D: { axis: 'y', layer: -1, cwDegrees: 90 },
  F: { axis: 'z', layer: 1, cwDegrees: -90 },
  B: { axis: 'z', layer: -1, cwDegrees: 90 },
};

describe('parseMove vs ARCHITECTURE 7.2', () => {
  it('covers all 18 tokens', () => {
    expect(MOVES).toHaveLength(18);
  });

  it.each(MOVES)('%s axis, layer, angle', (m) => {
    const face = m[0] as FaceId;
    const spec = SPEC[face];
    const turns = m.endsWith('2') ? 2 : 1;
    const sign = (spec.cwDegrees > 0 ? 1 : -1) * (m.endsWith("'") ? -1 : 1);
    const d = parseMove(m);
    expect(d.face).toBe(face);
    expect(d.axis).toBe(spec.axis);
    expect(d.layer).toBe(spec.layer);
    expect(d.turns).toBe(turns);
    expect(d.angle).toBeCloseTo(sign * QUARTER * turns, 12);
  });

  it('plain quarter turns are -90,+90,-90,+90,-90,+90 degrees for R,L,U,D,F,B', () => {
    const deg = (['R', 'L', 'U', 'D', 'F', 'B'] as const).map((f) => Math.round((parseMove(f).angle * 180) / Math.PI));
    expect(deg).toEqual([-90, 90, -90, 90, -90, 90]);
  });
});
