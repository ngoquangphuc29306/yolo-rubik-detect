import { useSessionStore } from '@/stores/session-store';

/** Persistent notice shown on every workspace screen while a DEMO session is active. */
export function ModeBanner() {
  const mode = useSessionStore((s) => s.mode);
  if (mode !== 'demo') return null;
  return (
    <div
      role="status"
      data-testid="mode-banner"
      className="w-full h-7 shrink-0 px-4 flex items-center justify-center bg-amber-400/10 border-b border-amber-400/30 text-amber-300 font-mono text-xs leading-none tracking-wide"
    >
      DEMO — simulated scan data. Not a camera reading.
    </div>
  );
}
