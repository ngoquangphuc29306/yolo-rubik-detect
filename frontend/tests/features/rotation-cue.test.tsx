// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RotationCue } from '@/features/scanner/RotationCue';
import { ROTATION_STEPS } from '@/lib/rotation-steps';

afterEach(cleanup);

describe('RotationCue (caption block, never mirrored)', () => {
  it.each(ROTATION_STEPS)('step $step names the expected centre and the target stage', (step) => {
    render(<RotationCue step={step} stage={step.captures ?? 'U'} saved={false} />);
    const cue = screen.getByRole('status');
    expect(cue.textContent).toContain(`Next: ${step.to} centre`);
    expect(cue.textContent).toContain(step.captures ? 'face' : 'Return to the Front face (not scanned)');
    expect(cue.textContent).not.toMatch(/verified|detects? (your )?orientation/i);
    expect(cue.getAttribute('data-step')).toBe(String(step.step));
  });

  it('is one horizontal row from sm up and stacked below, never absolutely positioned', () => {
    render(<RotationCue step={ROTATION_STEPS[0]!} stage="R" saved />);
    const cue = screen.getByRole('status');
    expect(cue.className.split(' ')).toContain('flex-col');
    expect(cue.className.split(' ')).toContain('sm:flex-row');
    expect(cue.className).not.toMatch(/absolute/);
    expect(cue.getAttribute('data-next-face')).toBe('R');
  });

  it('says Saved only right after a capture, and always points at the arrow on the preview', () => {
    const { rerender } = render(<RotationCue step={ROTATION_STEPS[0]!} stage="R" saved />);
    expect(screen.getByRole('status').textContent).toContain('Saved.');
    rerender(<RotationCue step={ROTATION_STEPS[0]!} stage="R" saved={false} />);
    expect(screen.getByRole('status').textContent).not.toContain('Saved.');
    expect(screen.getByRole('status').textContent).toContain('Follow the arrow on the preview');
    expect(screen.getByRole('status').textContent).toContain('the app checks colours, not how you hold the cube');
  });

  it('a return step says nothing is scanned', () => {
    render(<RotationCue step={ROTATION_STEPS[3]!} stage="U" saved={false} />);
    expect(screen.getByRole('status').textContent).toContain('No scan on this step');
  });
});
