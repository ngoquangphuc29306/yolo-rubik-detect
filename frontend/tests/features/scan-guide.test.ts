import { describe, expect, it } from 'vitest';
import { scanGuide } from '@/features/scanner/scan-guide';
import { FACE_META } from '@/lib/cubeEngine';
import { SCAN_FACE_ORDER, type ColorName, type FaceId } from '@/types/cube';

const ALL: Record<FaceId, ColorName> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
const COLOR_WORDS = /red|blue|orange|yellow|green|white/i;

describe('scanGuide', () => {
  it.each(SCAN_FACE_ORDER)('with all centres known, %s equals the legacy FACE_META text', (stage) => {
    const g = scanGuide(stage, ALL);
    const m = FACE_META[stage];
    expect(g.heading).toBe(m.scanHeading);
    expect(g.instruction).toBe(m.scanInstruction);
    expect(g.rotationHint).toBe(m.rotationHint);
    expect(g.arrowDirection).toBe(m.arrowDirection);
    expect(g.referenceRotation).toEqual(m.referenceRotation);
  });

  it.each(['R', 'B', 'L', 'D'] as const)('with only F and U known, %s text has no colour word', (stage) => {
    const g = scanGuide(stage, { F: 'green', U: 'white' });
    expect(`${g.heading} ${g.instruction} ${g.rotationHint}`).not.toMatch(COLOR_WORDS);
  });

  it('names the face direction for an unknown centre', () => {
    expect(scanGuide('R', { F: 'green', U: 'white' }).instruction).toBe(
      'Turn the entire cube 90° to the left (do not twist a layer) until the face that was on the right faces the camera.',
    );
  });

  it('F and U stages may name green and white', () => {
    const known = { F: 'green', U: 'white' } as const;
    expect(scanGuide('F', known).instruction).toBe(FACE_META.F.scanInstruction);
    expect(scanGuide('U', known).instruction).toBe(FACE_META.U.scanInstruction);
  });

  it('uses a different centre colour when known (not hard-coded)', () => {
    expect(scanGuide('R', { ...ALL, R: 'blue', B: 'red' }).instruction).toContain('blue center');
  });
});
