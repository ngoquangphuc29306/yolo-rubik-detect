// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveScanGuide, type LiveScanGuideProps } from '@/features/scanner/LiveScanGuide';
import { COLOR_META } from '@/lib/colors';
import type { FrameCell } from '@/types/api';

afterEach(cleanup);

const SQUARE = { x: 100, y: 20, w: 300, h: 300 };
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

  it('labels each of nine cells by status', () => {
    r();
    expect(screen.getAllByRole('img', { name: /^Row \d, column \d:/ })).toHaveLength(9);
    expect(screen.getByRole('img', { name: 'Row 1, column 1: green' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Row 1, column 3: not detected' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Row 2, column 1: unclear' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Row 2, column 3: out of position' })).toBeTruthy();
  });

  it('fills ok cells with the colour hex, shows ? for ambiguous', () => {
    r();
    const cell = screen.getByRole('img', { name: 'Row 1, column 1: green' });
    expect(cell.getAttribute('style')).toMatch(/22, 163, 74|#16a34a/i);
    expect(COLOR_META.green.hex).toBe('#16A34A');
    expect(screen.getByRole('img', { name: 'Row 2, column 1: unclear' }).textContent).toContain('?');
    expect(screen.getByRole('img', { name: 'Row 1, column 3: not detected' }).className).toMatch(/border-dashed/);
    expect(screen.getByRole('img', { name: 'Row 2, column 1: unclear' }).className).toMatch(/border-amber/);
  });

  it('null cells give nine not detected', () => {
    r({ cells: null });
    expect(screen.getAllByRole('img', { name: /: not detected$/ })).toHaveLength(9);
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

  it('captured grid is solid with check icons', () => {
    const grid = Array(9).fill('green') as LiveScanGuideProps['capturedGrid'];
    const { container } = r({ phase: 'captured', capturedGrid: grid });
    expect(container.querySelectorAll('[data-check]')).toHaveLength(9);
    expect(screen.getByRole('img', { name: 'Row 3, column 3: green' })).toBeTruthy();
  });

  it('boxes carry whole-percent titles and no visible numbers', () => {
    const { container } = r({
      boxes: [{ color: 'red', confidence: 0.876, rect: { x: 120, y: 40, w: 50, h: 50 } }],
    });
    expect(container.querySelector('[title="red 88%"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/88|0\.8/);
  });

  it('never claims verification', () => {
    const { container } = r({ hint: 'Hold the cube steadier' });
    expect(container.textContent).not.toMatch(/verified|orientation/i);
    expect(within(container).queryByText(/verified/i)).toBeNull();
  });
});
