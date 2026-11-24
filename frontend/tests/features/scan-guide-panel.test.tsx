// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seen = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('@/components/three/RubiksCube3D', async () => {
  const React = await import('react');
  return {
    RubiksCube3D: (p: Record<string, unknown>) => {
      seen.props.push(p);
      return React.createElement('div', { 'data-testid': 'cube-stub' });
    },
  };
});

import { ScanGuidePanel } from '@/features/scanner/ScanGuidePanel';
import { scanGuide } from '@/features/scanner/scan-guide';
import { ROTATION_STEPS } from '@/lib/rotation-steps';
import { stepEndPose, stepStartPose } from '@/lib/reference-motion';

const last = () => seen.props[seen.props.length - 1]!;
const base = { stageNumber: 2, faceLabel: 'R — Right', metrics: null, rescanning: false };
const live = (stage: 'F' | 'R' | 'U', step: number | null, extra = {}) =>
  render(
    <ScanGuidePanel
      {...base}
      guide={scanGuide(stage, { F: 'green', U: 'white' }, true)}
      live
      step={step === null ? null : ROTATION_STEPS[step - 1]!}
      {...extra}
    />,
  );
const reduceMotion = (reduced: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduced && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));

beforeEach(() => {
  seen.props = [];
  reduceMotion(false);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ScanGuidePanel - live layout', () => {
  it('puts a large full-width square cube below the heading', () => {
    live('R', 1);
    const box = screen.getByTestId('cube-stub').parentElement!.parentElement!;
    expect(box.className).toContain('aspect-square');
    expect(box.className).toContain('w-full');
    expect(box.className).toMatch(/max-w-\[(2[89]\d|3[0-4]\d)px\]/);
    expect(box.className).not.toContain('w-40');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a one-line caption instead of the long instruction', () => {
    live('R', 1);
    expect(screen.getByText('Next: red centre')).toBeTruthy();
    expect(screen.queryByText(/Turn the entire cube/)).toBeNull();
  });

  it('highlights the face the move ends on and labels it with the stage letter', () => {
    live('R', 1);
    expect(last().highlightFace).toBe('R');
    expect(screen.getByTestId('target-face-chip').textContent).toBe('R');
  });

  it('the large cube sits far enough back that its corners stay inside the frame while it turns', () => {
    live('R', 1);
    const [, , z] = last().cameraPosition as [number, number, number];
    const fov = last().fov as number;
    const halfHeight = z * Math.tan((fov * Math.PI) / 360);
    const cornerRadius = (3 * Math.sqrt(3)) / 2; // half the cube's space diagonal
    expect(halfHeight).toBeGreaterThan(cornerRadius * 1.05);
  });

  it('a return step highlights Front (not scanned)', () => {
    live('U', 4);
    expect(last().highlightFace).toBe('F');
    expect(screen.getByText('Next: green centre')).toBeTruthy();
  });

  it('start pose: no animation, highlights F, keeps the start-pose line', () => {
    live('F', null, { emphasis: true });
    expect(screen.getByText('Start pose: green centre toward the camera, white centre on top.')).toBeTruthy();
    expect(last().highlightFace).toBe('F');
    expect(last().referenceRotationRef).toBeUndefined();
    expect(last().referenceRotation).toEqual(scanGuide('F', {}, true).referenceRotation);
  });

  it('the cube canvas is mirrored like the preview, the chip text is not', () => {
    live('R', 1);
    const box = screen.getByTestId('cube-stub').parentElement!;
    expect(box.style.transform).toBe('scaleX(-1)');
    expect(screen.getByTestId('target-face-chip').closest('[style*="scaleX"]')).toBeNull();
  });
});

describe('ScanGuidePanel - animation lifecycle', () => {
  it('drives the cube through a ref that starts at the step start pose, no per-frame props', () => {
    const raf = vi.fn(() => 7);
    const caf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);
    const { unmount } = live('R', 1);
    const ref = last().referenceRotationRef as { current: number[] };
    expect(ref.current).toEqual(stepStartPose(ROTATION_STEPS[0]!));
    expect(raf).toHaveBeenCalled();
    unmount();
    expect(caf).toHaveBeenCalledWith(7);
  });

  it('prefers-reduced-motion: no loop, shows the end pose and a static arrow', () => {
    reduceMotion(true);
    const raf = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', raf);
    live('R', 1);
    expect(raf).not.toHaveBeenCalled();
    expect(last().referenceRotationRef).toBeUndefined();
    expect(last().referenceRotation).toEqual(stepEndPose(ROTATION_STEPS[0]!));
    expect(screen.getByTestId('static-arrow').getAttribute('data-direction')).toBe('right');
  });
});

describe('ScanGuidePanel - demo unchanged', () => {
  it('keeps the small cube, instruction, metrics and no highlight', () => {
    const guide = scanGuide('R', {});
    render(
      <ScanGuidePanel
        {...base}
        guide={guide}
        metrics={{ centerName: 'Red', centerHex: '#f00', stickers: 9, confidenceLabel: '97%', faceStatus: 'ok' }}
      />,
    );
    expect(screen.getByTestId('cube-stub').parentElement!.className).toContain('w-24');
    expect(screen.getByText(guide.instruction)).toBeTruthy();
    expect(screen.getByText('Detected Stickers')).toBeTruthy();
    expect(last().highlightFace).toBeUndefined();
    expect(last().referenceRotationRef).toBeUndefined();
    expect(screen.queryByTestId('target-face-chip')).toBeNull();
  });
});
