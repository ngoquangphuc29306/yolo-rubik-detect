// Backend health -> LiveReadiness. checkHealth is pure (no React); the hook is a thin wrapper.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLatestGuard, type LatestGuard } from '@/lib/request-guard';
import { getHealth as getHealthDefault } from '@/services/health-client';
import { deriveLiveReadiness } from '@/services/readiness';
import type { HealthResponse, LiveReadiness } from '@/types/api';

export interface HealthDeps {
  guard: LatestGuard;
  getHealth: (opts: { signal: AbortSignal }) => Promise<HealthResponse | null>;
  onResult: (readiness: LiveReadiness) => void;
}

export async function checkHealth(deps: HealthDeps): Promise<void> {
  const handle = deps.guard.begin();
  const health = await deps.getHealth({ signal: handle.signal });
  if (!handle.isCurrent()) return;
  deps.onResult(deriveLiveReadiness(health));
}

/** readiness is null until the first check completes (never assumed ready). */
export function useBackendHealth(enabled = true) {
  const [readiness, setReadiness] = useState<LiveReadiness | null>(null);
  const guardRef = useRef<LatestGuard | null>(null);
  guardRef.current ??= createLatestGuard();
  const guard = guardRef.current;

  const refresh = useCallback(
    () => checkHealth({ guard, getHealth: (o) => getHealthDefault(o), onResult: setReadiness }),
    [guard],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return () => guard.reset();
  }, [enabled, refresh, guard]);

  return { readiness, refresh };
}
