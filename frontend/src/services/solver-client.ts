// POST /api/solve. Never throws. Binding the response to the request (bindSolveResponse) is the caller's job.
import type { SolveError, SolveOutcome, SolveRequest } from '@/types/api';
import { SOLVE_PATH } from './api-config';
import { clientError, parseApiErrorEnvelope, parseSolveResponse } from './parsers';

export type SolveResult = { ok: true; outcome: SolveOutcome } | { ok: false; error: SolveError };

export interface SolveOptions {
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Prefix for the relative path, e.g. 'http://127.0.0.1:8000'. */
  baseUrl?: string;
}

const cancelled = (): SolveResult => ({ ok: false, error: clientError('REQUEST_CANCELLED', 'Request cancelled.') });
const unavailable = (): SolveResult => ({
  ok: false,
  error: clientError('BACKEND_UNAVAILABLE', 'The solver service is not reachable.', true),
});
const badResponse = (msg: string): SolveResult => ({ ok: false, error: clientError('BAD_RESPONSE', msg) });

export async function solve(request: SolveRequest, opts: SolveOptions): Promise<SolveResult> {
  const { signal } = opts;
  if (signal.aborted) return cancelled();
  const doFetch: typeof fetch = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  try {
    let response: Response;
    let text: string;
    try {
      response = await doFetch(`${opts.baseUrl ?? ''}${SOLVE_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal,
      });
      text = await response.text();
    } catch {
      return signal.aborted ? cancelled() : unavailable();
    }
    if (signal.aborted) return cancelled();

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }

    if (response.status === 200) {
      if (json === undefined) return badResponse('The solver response was not valid JSON.');
      const parsed = parseSolveResponse(json);
      return parsed.ok ? { ok: true, outcome: { response: parsed.value, source: 'backend' } } : parsed;
    }
    if (response.status === 422 || response.status === 503) {
      const env = json === undefined ? null : parseApiErrorEnvelope(json);
      if (env?.ok) return { ok: false, error: { kind: 'api', ...env.value.error } };
      return response.status === 503
        ? unavailable()
        : badResponse('The solver rejected the request without a valid error body.');
    }
    return response.status >= 500 ? unavailable() : badResponse(`Unexpected solver response (HTTP ${response.status}).`);
  } catch {
    return signal.aborted ? cancelled() : badResponse('The solver response could not be processed.');
  }
}
