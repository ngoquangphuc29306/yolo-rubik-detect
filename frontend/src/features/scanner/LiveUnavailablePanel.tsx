import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LiveReadiness } from '@/types/api';

interface LiveUnavailablePanelProps {
  /** null while the first health check is running. */
  readiness: LiveReadiness | null;
  onRetry: () => void;
}

/** Live-mode vision status. Phase 1 has no scan transport, so no state here ever enables capture. */
export function LiveUnavailablePanel({ readiness, onRetry }: LiveUnavailablePanelProps) {
  let title: string;
  let detail: string | null = null;
  let banner: string | null = null;

  if (readiness === null) {
    title = 'Checking vision service…';
  } else if (readiness.kind === 'blocked') {
    title =
      readiness.reason === 'BACKEND_UNAVAILABLE'
        ? 'Vision service is not running'
        : `Vision model is not available${readiness.solverReady ? ' — the solver is still usable' : ''}`;
    detail = 'Live scanning is blocked. Nothing is simulated in live mode.';
  } else if (readiness.kind === 'fixture-only') {
    title = 'Vision service is running a test detector';
    banner = 'Fixture detector — not real inference';
    detail = 'Capture stays disabled: fixture output is never treated as a camera reading.';
  } else {
    title = 'Vision service is connected';
    detail = 'Live capture is not available in this version yet.';
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-400/35 bg-[#19150d] px-4 py-3 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          {banner && (
            <p className="inline-block rounded-md border border-amber-400/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
              {banner}
            </p>
          )}
          <p className="text-sm font-medium text-amber-100">{title}</p>
          {detail && <p className="text-xs text-amber-200/70">{detail}</p>}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );
}
