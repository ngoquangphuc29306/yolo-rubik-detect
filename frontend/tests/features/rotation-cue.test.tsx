// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RotationCue } from '@/features/scanner/RotationCue';
import { scanGuide } from '@/features/scanner/scan-guide';
import { SCAN_FACE_ORDER, type FaceId } from '@/types/cube';

afterEach(cleanup);
const KNOWN = { F: 'green', U: 'white' } as const;

describe('RotationCue', () => {
  it.each(SCAN_FACE_ORDER)('next face %s', (face: FaceId) => {
    const g = scanGuide(face, KNOWN);
    render(<RotationCue guide={g} nextFace={face} />);
    const cue = screen.getByRole('status');
    expect(cue.textContent).toContain('Rotate the whole cube');
    expect(cue.textContent).toContain(g.rotationHint);
    expect(cue.textContent).toContain('Follow the arrow and the reference cube — the app checks colours, not how you hold the cube.');
    expect(cue.textContent).not.toMatch(/verified|detects? (your )?orientation/i);
    const arrow = screen.getByTestId('rotation-arrow');
    expect(arrow.getAttribute('data-direction')).toBe(g.arrowDirection);
    expect(arrow.className).toMatch(/motion-reduce:animate-none/);
    const items = screen.queryAllByRole('listitem');
    if (face === 'U' || face === 'D') {
      expect(cue.textContent).not.toContain(g.instruction);
      expect(items).toHaveLength(2);
      expect(items[0]!.textContent).toBe(g.steps![0]);
      expect(items[1]!.textContent).toBe(g.steps![1]);
      expect(items[0]!.textContent).toMatch(/green face looks at the camera/);
    } else {
      expect(cue.textContent).toContain(g.instruction);
      expect(items).toHaveLength(0);
    }
  });

  it('none direction shows a hold steady pulse', () => {
    render(<RotationCue guide={scanGuide('F', KNOWN)} nextFace="F" />);
    const arrow = screen.getByTestId('rotation-arrow');
    expect(arrow.getAttribute('data-direction')).toBe('none');
    expect(arrow.className).toMatch(/animate-arrow-pulse/);
  });
});
