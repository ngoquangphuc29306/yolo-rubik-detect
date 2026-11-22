// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeBanner } from '@/components/ModeBanner';
import { WorkspaceHeader } from '@/components/WorkspaceHeader';
import { useSessionStore } from '@/stores/session-store';

const TEXT = 'DEMO — simulated scan data. Not a camera reading.';

beforeEach(() => {
  useSessionStore.setState({ mode: null, screen: 'landing' });
});
afterEach(cleanup);

describe('ModeBanner', () => {
  it('shows the exact demo notice with role=status in demo mode', () => {
    useSessionStore.setState({ mode: 'demo' });
    render(<ModeBanner />);
    const el = screen.getByRole('status');
    expect(el.textContent).toBe(TEXT);
  });

  it('renders nothing in live mode', () => {
    useSessionStore.setState({ mode: 'live' });
    const { container } = render(<ModeBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when no session mode is set (Landing)', () => {
    const { container } = render(<ModeBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('disappears when a live session replaces a demo session', () => {
    useSessionStore.getState().startSession('demo', 'scanning');
    render(<ModeBanner />);
    expect(screen.queryByText(TEXT)).not.toBeNull();
    act(() => useSessionStore.getState().startSession('live', 'scanning'));
    expect(screen.queryByText(TEXT)).toBeNull();
  });
});

describe('WorkspaceHeader banner', () => {
  it('shows the banner in demo only', () => {
    useSessionStore.setState({ mode: 'demo' });
    render(<WorkspaceHeader activeStage="scan" />);
    expect(screen.queryByText(TEXT)).not.toBeNull();
    cleanup();
    useSessionStore.setState({ mode: 'live' });
    render(<WorkspaceHeader activeStage="scan" />);
    expect(screen.queryByText(TEXT)).toBeNull();
  });
});
