// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LiveScanGuide, type LiveScanGuideProps } from '@/features/scanner/LiveScanGuide';
import { ARROW_ROTATION_DEG } from '@/features/scanner/RotationArrow';
import { ROTATION_STEPS, type ArrowDirection } from '@/lib/rotation-steps';
import { netMirror } from '../helpers/mirror';

afterEach(cleanup);

const SQUARE = { x: 100, y: 20, w: 300, h: 300 };
const FACE = { x: 160, y: 80, w: 150, h: 150 };
const base: LiveScanGuideProps = { square: SQUARE, face: null, cells: null, boxes: [], progress: 0, phase: 'rotating', hint: null, arrow: null };
const arrowOf = () => screen.getByTestId('rotation-arrow');

/** The vector the user sees on screen: the SVG's own rotation, then every inline scaleX(-1) on it and its ancestors. */
function visualVector(): [number, number] {
  const el = arrowOf();
  const svg = el.querySelector('svg')!;
  const deg = Number(svg.getAttribute('data-rotation'));
  expect(svg.style.transform).toBe(`rotate(${deg}deg)`);
  const rad = (deg * Math.PI) / 180;
  const x = Math.round(Math.cos(rad));
  const y = Math.round(Math.sin(rad)); // screen y grows downward, so positive rotation turns right into down
  return [x * netMirror(el) || 0, y || 0]; // `|| 0` folds -0
}

const EXPECT: Record<ArrowDirection, [number, number]> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

describe('rotation arrow on the mirrored overlay', () => {
  it.each(['right', 'down', 'up', 'left'] as const)('%s: the rendered direction is what the user sees on screen', (dir) => {
    render(<LiveScanGuide {...base} arrow={dir} />);
    expect(arrowOf().getAttribute('data-direction')).toBe(dir);
    expect(ARROW_ROTATION_DEG[dir]).toBe({ right: 0, down: 90, left: 180, up: 270 }[dir]);
    expect(netMirror(arrowOf())).toBe(1); // inside the mirrored layer, counter-mirrored: reads unmirrored
    expect(visualVector()).toEqual(EXPECT[dir]);
  });

  it('every step of the table gives its arrow direction on screen', () => {
    for (const s of ROTATION_STEPS) {
      render(<LiveScanGuide {...base} arrow={s.arrow} />);
      expect(visualVector()).toEqual(EXPECT[s.arrow]);
      cleanup();
    }
  });

  it('the arrow sits inside the mirror layer (so it moves with the mirrored cube) but is not itself flipped', () => {
    render(<LiveScanGuide {...base} arrow="right" />);
    const layer = screen.getByTestId('mirror-layer');
    expect(layer.contains(arrowOf())).toBe(true);
    expect(arrowOf().style.transform).toBe('scaleX(-1)');
  });

  it('is centred on the fitted face when known, else on the placement zone', () => {
    const { rerender } = render(<LiveScanGuide {...base} arrow="right" face={FACE} />);
    const centre = () => {
      const el = arrowOf();
      return [parseFloat(el.style.left) + parseFloat(el.style.width) / 2, parseFloat(el.style.top) + parseFloat(el.style.height) / 2];
    };
    expect(centre()).toEqual([235, 155]);
    rerender(<LiveScanGuide {...base} arrow="right" face={null} />);
    expect(centre()).toEqual([250, 170]);
  });

  it('no arrow prop, no arrow; reduced motion disables the animation; the arrow is decorative', () => {
    const { rerender, container } = render(<LiveScanGuide {...base} />);
    expect(container.querySelector('[data-testid="rotation-arrow"]')).toBeNull();
    rerender(<LiveScanGuide {...base} arrow="down" />);
    expect(arrowOf().getAttribute('aria-hidden')).toBe('true');
    expect(arrowOf().innerHTML).toMatch(/motion-reduce:animate-none/);
    expect(arrowOf().innerHTML).toMatch(/animate-arrow-down/);
  });

  it('contains no text, so nothing can render mirrored', () => {
    render(<LiveScanGuide {...base} arrow="up" />);
    expect(arrowOf().textContent).toBe('');
  });
});
