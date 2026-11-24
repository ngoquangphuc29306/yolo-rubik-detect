// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveScanGuide, type LiveScanGuideProps } from '@/features/scanner/LiveScanGuide';
import { netMirror } from '../helpers/mirror';
import type { FrameCell } from '@/types/api';

afterEach(cleanup);

const SQUARE = { x: 100, y: 20, w: 300, h: 300 };
const FACE = { x: 160, y: 80, w: 150, h: 150 };
const ok = (color: FrameCell['color']): FrameCell => ({ color, confidence: 0.9, status: 'ok' });
const CELLS: FrameCell[] = [
  ok('green'),
  ok('green'),
  { color: null, confidence: null, status: 'missing' },
  { color: null, confidence: 0.4, status: 'ambiguous' },
  ok('white'),
  { color: 'red', confidence: 0.8, status: 'misaligned' },
  ok('blue'),
  ok('orange'),
  ok('yellow'),
];
const base: LiveScanGuideProps = {
  square: SQUARE,
  face: FACE,
  cells: CELLS,
  boxes: [],
  progress: 0.3,
  phase: 'stabilizing',
  hint: null,
};
const r = (p: Partial<LiveScanGuideProps> = {}) => render(<LiveScanGuide {...base} {...p} />);

describe('LiveScanGuide', () => {
  it('renders nothing without a square', () => {
    const { container } = r({ square: null });
    expect(container.childElementCount).toBe(0);
  });

  it('the overlay layer is mirrored; boxes and zone appear mirrored; labels and text read normally', () => {
    const { container } = r({
      boxes: [{ color: 'red', confidence: 0.9, rect: { x: 120, y: 40, w: 50, h: 50 } }],
      hint: 'Hold the cube steadier',
    });
    const layer = screen.getByTestId('mirror-layer');
    expect(layer.style.transform).toBe('scaleX(-1)');
    expect(layer.parentElement).toBe(container);
    expect(netMirror(container.querySelector('[title="red 90%"]'))).toBe(-1);
    expect(netMirror(screen.getByTestId('guide-square'))).toBe(-1);
    expect(netMirror(screen.getByText('red 0.90'))).toBe(1);
    expect(netMirror(screen.getByRole('status'))).toBe(1);
    expect(netMirror(screen.getByRole('progressbar'))).toBe(1);
  });

  it('draws the placement zone as a light dashed square', () => {
    r({ face: null, cells: null });
    const zone = screen.getByTestId('guide-square');
    expect(zone.className).toMatch(/border-dashed/);
    expect(zone.style.left).toBe('100px');
    expect(zone.style.width).toBe('300px');
  });

  it('draws no 3x3 lattice or per-cell tiles, even with a fitted face and cells', () => {
    r();
    expect(screen.queryByTestId('face-lattice')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('draws every raw detection like YOLO: coloured box and a "colour 0.88" label', () => {
    r({
      boxes: [
        { color: 'red', confidence: 0.876, rect: { x: 120, y: 40, w: 50, h: 50 } },
        { color: 'blue', confidence: 0.5, rect: { x: 200, y: 40, w: 50, h: 50 } },
      ],
    });
    const boxes = screen.getAllByTestId('yolo-box');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]!.style.borderColor).not.toBe('');
    expect(boxes[0]!.style.width).toBe('50px');
    expect(screen.getByText('red 0.88')).toBeTruthy();
    expect(screen.getByText('blue 0.50')).toBeTruthy();
  });

  it('the label chip sits at the visual top-left of the box (anchored to the mirrored right edge)', () => {
    r({ boxes: [{ color: 'green', confidence: 0.8, rect: { x: 120, y: 40, w: 50, h: 50 } }] });
    const chip = screen.getByText('green 0.80');
    expect(chip.className).toMatch(/right-0/);
    expect(chip.className).toMatch(/bottom-full/);
  });

  it('progress bar and hint', () => {
    r({ progress: 0.426, hint: 'Hold the cube steadier' });
    const bar = screen.getByRole('progressbar', { name: 'Hold steady' });
    expect(bar.getAttribute('aria-valuenow')).toBe('43');
    expect(screen.getByRole('status').textContent).toBe('Hold the cube steadier');
  });

  it('no status element without hint; border emerald at full progress', () => {
    const { container, rerender } = r();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('[data-testid="guide-square"]')!.className).not.toMatch(/emerald/);
    rerender(<LiveScanGuide {...base} progress={1} />);
    expect(container.querySelector('[data-testid="guide-square"]')!.className).toMatch(/emerald/);
    rerender(<LiveScanGuide {...base} phase="captured" />);
    expect(container.querySelector('[data-testid="guide-square"]')!.className).toMatch(/emerald/);
  });

  it('boxes keep whole-percent titles', () => {
    const { container } = r({ boxes: [{ color: 'red', confidence: 0.876, rect: { x: 120, y: 40, w: 50, h: 50 } }] });
    expect(container.querySelector('[title="red 88%"]')).toBeTruthy();
  });

  it('never claims verification in any phase', () => {
    for (const phase of ['aligning', 'stabilizing', 'captured', 'rotating', 'done'] as const) {
      const { container } = r({ phase, hint: 'Hold the cube steadier', capturedGrid: Array(9).fill('green') as LiveScanGuideProps['capturedGrid'] });
      expect(container.textContent).not.toMatch(/verified|orientation/i);
      cleanup();
    }
  });
});
