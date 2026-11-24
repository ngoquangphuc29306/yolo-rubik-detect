// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chime = vi.hoisted(() => vi.fn());
vi.mock('@/lib/audio', () => ({ playCaptureSound: chime }));

import { CaptureFeedback, FLASH_MS, CHECK_MS } from '@/features/scanner/CaptureFeedback';

const ZONE = { x: 100, y: 20, w: 300, h: 300 };
type Props = React.ComponentProps<typeof CaptureFeedback>;
const base: Props = { capturedCount: 0, face: null, soundEnabled: true, zone: ZONE };
const r = (p: Partial<Props> = {}) => render(<CaptureFeedback {...base} {...p} />);

function setReduced(matches: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: matches && q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {},
  })) as never;
}

beforeEach(() => {
  vi.useFakeTimers();
  chime.mockClear();
  setReduced(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('CaptureFeedback', () => {
  it('shows nothing on mount, even when faces are already captured', () => {
    r({ capturedCount: 3, face: 'B' });
    expect(screen.queryByTestId('capture-check')).toBeNull();
    expect(screen.queryByTestId('capture-flash')).toBeNull();
    expect(chime).not.toHaveBeenCalled();
  });

  it('shows flash, check with the stage letter and a polite announcement when the count increases', () => {
    const { rerender } = r();
    rerender(<CaptureFeedback {...base} capturedCount={1} face="F" />);
    expect(screen.getByTestId('capture-flash')).toBeTruthy();
    expect(screen.getByTestId('capture-check').textContent).toContain('F captured');
    const live = screen.getByText('Front face captured');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(chime).toHaveBeenCalledTimes(1);
    expect(chime).toHaveBeenCalledWith(true);
  });

  it('removes the flash after ~400 ms and the check after ~900 ms', () => {
    const { rerender } = r();
    rerender(<CaptureFeedback {...base} capturedCount={1} face="F" />);
    expect(FLASH_MS).toBe(400);
    expect(CHECK_MS).toBe(900);
    act(() => void vi.advanceTimersByTime(FLASH_MS));
    expect(screen.queryByTestId('capture-flash')).toBeNull();
    expect(screen.getByTestId('capture-check')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(CHECK_MS - FLASH_MS));
    expect(screen.queryByTestId('capture-check')).toBeNull();
  });

  it('does not retrigger for re-renders at the same count; chimes once per capture', () => {
    const { rerender } = r();
    rerender(<CaptureFeedback {...base} capturedCount={1} face="F" />);
    rerender(<CaptureFeedback {...base} capturedCount={1} face="F" soundEnabled />);
    expect(chime).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(CHECK_MS));
    rerender(<CaptureFeedback {...base} capturedCount={1} face="F" />);
    expect(screen.queryByTestId('capture-check')).toBeNull();
    rerender(<CaptureFeedback {...base} capturedCount={2} face="R" />);
    expect(screen.getByTestId('capture-check').textContent).toContain('R captured');
    expect(chime).toHaveBeenCalledTimes(2);
  });

  it('a count that drops (rescan) shows nothing; the recapture does', () => {
    const { rerender } = r({ capturedCount: 3, face: 'B' });
    rerender(<CaptureFeedback {...base} capturedCount={2} face="B" />);
    expect(screen.queryByTestId('capture-check')).toBeNull();
    rerender(<CaptureFeedback {...base} capturedCount={3} face="B" />);
    expect(screen.getByTestId('capture-check')).toBeTruthy();
  });

  it('does not play the chime when sound is off, but still shows the confirmation', () => {
    const { rerender } = r({ soundEnabled: false });
    rerender(<CaptureFeedback {...base} soundEnabled={false} capturedCount={1} face="F" />);
    expect(chime).not.toHaveBeenCalled();
    expect(screen.getByTestId('capture-check')).toBeTruthy();
  });

  it('reduced motion: no flash and a static check mark', () => {
    setReduced(true);
    const { rerender } = r();
    rerender(<CaptureFeedback {...base} capturedCount={1} face="F" />);
    expect(screen.queryByTestId('capture-flash')).toBeNull();
    const check = screen.getByTestId('capture-check');
    expect(check.className).not.toMatch(/animate-/);
  });

  it('the text is not mirrored and nothing claims verification', () => {
    const { rerender, container } = r();
    rerender(<CaptureFeedback {...base} capturedCount={1} face="F" />);
    expect(container.querySelector('[style*="scaleX(-1)"]')).toBeNull();
    expect(container.textContent).not.toMatch(/verified|orientation/i);
  });

  it('clears its timers on unmount', () => {
    const { rerender, unmount } = r();
    rerender(<CaptureFeedback {...base} capturedCount={1} face="F" />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
