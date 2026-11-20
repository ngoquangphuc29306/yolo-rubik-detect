// Scan transport boundary. Phase 1 has no WebSocket transport: live scanning is always unavailable.
import type { SolveError } from '@/types/api';

export interface ScanTransport {
  readonly available: boolean;
  connect(): Promise<{ ok: true } | { ok: false; error: SolveError }>;
  close(): void;
}

export class UnavailableScanTransport implements ScanTransport {
  readonly available = false;

  async connect(): Promise<{ ok: false; error: SolveError }> {
    return {
      ok: false,
      error: {
        kind: 'client',
        code: 'BACKEND_UNAVAILABLE',
        message: 'Vision service not connected.',
        retryable: false,
      },
    };
  }

  close(): void {}
}
