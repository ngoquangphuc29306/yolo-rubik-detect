// GET /health. Returns the parsed health, or null when unreachable/invalid/aborted. Never throws.
import type { HealthResponse } from '@/types/api';
import { HEALTH_PATH } from './api-config';
import { parseHealthResponse } from './parsers';

export interface HealthOptions {
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export async function getHealth(opts: HealthOptions): Promise<HealthResponse | null> {
  const { signal } = opts;
  if (signal.aborted) return null;
  const doFetch: typeof fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  try {
    const response = await doFetch(`${opts.baseUrl ?? ''}${HEALTH_PATH}`, { method: 'GET', signal, cache: 'no-store' });
    if (response.status !== 200) return null;
    const text = await response.text();
    if (signal.aborted) return null;
    const parsed = parseHealthResponse(JSON.parse(text));
    return parsed.ok ? parsed.value : null;
  } catch {
    return null;
  }
}
