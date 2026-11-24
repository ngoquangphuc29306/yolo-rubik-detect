import { describe, expect, it } from 'vitest';
import { scanGuide } from '@/features/scanner/scan-guide';
import legacyScanGuide from '../golden/legacy-scan-guide.json';
import { ROTATION_STEPS } from '@/lib/rotation-steps';
import { SCAN_FACE_ORDER, type ColorName, type FaceId } from '@/types/cube';

const ALL: Record<FaceId, ColorName> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
const COLORS: ColorName[] = ['white', 'yellow', 'red', 'orange', 'blue', 'green'];

const PATTERNS: Record<string, Partial<Record<FaceId, ColorName>>> = {
  'all six known': ALL,
  'only F+U known': { F: 'green', U: 'white' },
  'nothing known': {},
};

const text = (g: ReturnType<typeof scanGuide>) => `${g.heading} ${g.instruction} ${g.rotationHint} ${(g.steps ?? []).join(' ')}`;

describe('scanGuide', () => {
  describe.each(Object.entries(PATTERNS))('%s', (_name, known) => {
    it.each(SCAN_FACE_ORDER)('%s: no colour word for an unknown centre', (stage) => {
      const knownColors = new Set(Object.values(known));
      for (const c of COLORS) {
        if (!knownColors.has(c)) expect(text(scanGuide(stage, known)).toLowerCase()).not.toContain(c);
      }
    });

    it.each(SCAN_FACE_ORDER)('%s: grammatical (no doubled fragments)', (stage) => {
      const g = scanGuide(stage, known);
      for (const s of [g.heading, g.instruction, g.rotationHint]) {
        expect(s).not.toMatch(/face front/);
        expect(s).not.toMatch(/top face on top/);
        expect(s).not.toMatch(/  /);
        expect(s).not.toMatch(/\b(\w+) \1\b/i);
        expect(s.trim()).toBe(s);
      }
    });
  });

  // U and D entries were updated deliberately in Phase 3 (design 13.7); the rest is the frozen legacy text.
  it.each(SCAN_FACE_ORDER)('all six known: %s equals the frozen legacy FACE_META text', (stage) => {
    const g = scanGuide(stage, ALL);
    const m = legacyScanGuide.faces[stage];
    expect(g.heading).toBe(m.scanHeading);
    expect(g.instruction).toBe(m.scanInstruction);
    expect(g.rotationHint).toBe(m.rotationHint);
    expect(g.arrowDirection).toBe(m.arrowDirection);
    expect(g.referenceRotation).toEqual(m.referenceRotation);
    expect(g.steps).toEqual('steps' in m ? m.steps : undefined);
  });

  it.each(SCAN_FACE_ORDER)('%s: arrow and reference rotation do not depend on known centres', (stage) => {
    const a = scanGuide(stage, {});
    expect(a.arrowDirection).toBe(scanGuide(stage, ALL).arrowDirection);
    expect(a.referenceRotation).toEqual(scanGuide(stage, ALL).referenceRotation);
  });

  it('F+U known: may name white/green but never red, blue, orange or yellow', () => {
    for (const stage of SCAN_FACE_ORDER) {
      expect(text(scanGuide(stage, { F: 'green', U: 'white' }))).not.toMatch(/red|blue|orange|yellow/i);
    }
    expect(scanGuide('B', { F: 'green', U: 'white' }).instruction).toContain('keeping white on top');
  });

  it('names the face direction for an unknown centre', () => {
    expect(scanGuide('R', { F: 'green', U: 'white' }).instruction).toBe(
      'Turn the entire cube 90° to the left (do not twist a layer) until the face that was on the right faces the camera.',
    );
  });

  it('uses a different centre colour when known (not hard-coded)', () => {
    expect(scanGuide('R', { ...ALL, R: 'blue', B: 'red' }).instruction).toContain('blue center');
  });

  describe('mirrored (live preview) variant', () => {
    it.each(['R', 'B', 'L', 'U', 'D'] as const)('%s: the arrow equals the arrow of the step that captures it', (stage) => {
      const step = ROTATION_STEPS.find((s) => s.captures === stage)!;
      expect(scanGuide(stage, ALL, true).arrowDirection).toBe(step.arrow);
    });
    it.each(['R', 'B', 'L'] as const)('%s: no left/right wording that would contradict the arrow', (stage) => {
      const g = scanGuide(stage, ALL, true);
      expect(`${g.heading} ${g.instruction} ${g.rotationHint}`).not.toMatch(/left/i);
      expect(g.instruction).toContain('the way the arrow points');
    });
    it('F, U, D text and every reference rotation equal the unmirrored guide', () => {
      for (const stage of SCAN_FACE_ORDER) {
        const a = scanGuide(stage, ALL, true);
        const b = scanGuide(stage, ALL);
        expect(a.referenceRotation).toEqual(b.referenceRotation);
        if (stage === 'F' || stage === 'U' || stage === 'D') expect(a).toEqual(b);
      }
    });
    it('the unmirrored default stays the frozen legacy text (demo)', () => {
      expect(scanGuide('R', ALL).arrowDirection).toBe('left');
      expect(scanGuide('R', ALL).instruction).toContain('to the left');
    });
  });
});
