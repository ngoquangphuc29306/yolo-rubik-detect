// Scan transport boundary. The real transport talks to /ws/scan; the Unavailable one is the Demo/no-backend stand-in.
import type { FrameResult, ScanReady, SolveError } from '@/types/api';
import { clientError, parseScanServerMessage } from '@/services/parsers';

export type ConnectResult = { ok: true; ready: ScanReady } | { ok: false; error: SolveError };
export type SendResult = { ok: true; result: FrameResult } | { ok: false; error: SolveError };

export interface ScanTransport {
  readonly available: boolean;
  connect(): Promise<ConnectResult>;
  send(frame: Blob): Promise<SendResult>;
  close(): void;
}

const UNAVAILABLE = (): SolveError => clientError('BACKEND_UNAVAILABLE', 'Vision service not connected.');

export class UnavailableScanTransport implements ScanTransport {
  readonly available = false;

  async connect(): Promise<ConnectResult> {
    return { ok: false, error: UNAVAILABLE() };
  }

  async send(_frame: Blob): Promise<SendResult> {
    return { ok: false, error: UNAVAILABLE() };
  }

  close(): void {}
}

export interface WebSocketScanTransportOptions {
  WebSocketImpl?: typeof WebSocket;
  timeoutMs?: number;
  newScanId?: () => string;
}

const defaultScanId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

type State = 'idle' | 'connecting' | 'ready' | 'failed' | 'closed';
type Failure = { ok: false; error: SolveError };
type Pending =
  | { kind: 'connect'; settle: (r: ConnectResult) => void; timer: ReturnType<typeof setTimeout> }
  | { kind: 'frame'; settle: (r: SendResult) => void; timer: ReturnType<typeof setTimeout> };

/** One scan session over a WebSocket: hello -> ready, then one frame in flight at a time. */
export class WebSocketScanTransport implements ScanTransport {
  readonly available = true;
  private ws: WebSocket | null = null;
  private state: State = 'idle';
  private pending: Pending | null = null;
  private scanId = '';
  private readonly timeoutMs: number;

  constructor(
    private readonly url: string,
    private readonly opts: WebSocketScanTransportOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 5000;
  }

  connect(): Promise<ConnectResult> {
    if (this.state !== 'idle') {
      return Promise.resolve({ ok: false, error: clientError('REQUEST_INVALID', 'Transport cannot be reused.') });
    }
    const Impl = this.opts.WebSocketImpl ?? (typeof WebSocket === 'undefined' ? undefined : WebSocket);
    if (!Impl) {
      return Promise.resolve({ ok: false, error: clientError('BACKEND_UNAVAILABLE', 'WebSockets are not supported.', true) });
    }
    this.state = 'connecting';
    this.scanId = (this.opts.newScanId ?? defaultScanId)();
    let ws: WebSocket;
    try {
      ws = new Impl(this.url);
    } catch {
      this.state = 'failed';
      return Promise.resolve({ ok: false, error: clientError('BACKEND_UNAVAILABLE', 'Could not open the vision connection.', true) });
    }
    this.ws = ws;
    ws.binaryType = 'arraybuffer';
    const live = () => this.ws === ws && this.state !== 'closed' && this.state !== 'failed';
    ws.onopen = () => {
      if (!live()) return;
      try {
        ws.send(JSON.stringify({ type: 'hello', schemaVersion: 1, scanId: this.scanId }));
      } catch {
        this.fail(clientError('BACKEND_UNAVAILABLE', 'Vision connection lost.', true));
      }
    };
    ws.onmessage = (ev: MessageEvent) => {
      if (live()) this.onMessage(ev.data);
    };
    const lost = () => {
      if (live()) this.fail(clientError('BACKEND_UNAVAILABLE', 'Vision connection lost.', true));
    };
    ws.onerror = lost;
    ws.onclose = lost;
    return new Promise<ConnectResult>((resolve) => {
      this.pending = { kind: 'connect', settle: resolve, timer: this.startTimer() };
    });
  }

  send(frame: Blob): Promise<SendResult> {
    if (this.pending?.kind === 'frame') {
      return Promise.resolve({ ok: false, error: clientError('REQUEST_INVALID', 'A frame is already in flight.') });
    }
    if (this.state !== 'ready' || !this.ws) {
      return Promise.resolve({ ok: false, error: clientError('REQUEST_INVALID', 'Vision connection is not ready.') });
    }
    try {
      this.ws.send(frame);
    } catch {
      this.fail(clientError('BACKEND_UNAVAILABLE', 'Vision connection lost.', true));
      return Promise.resolve({ ok: false, error: clientError('BACKEND_UNAVAILABLE', 'Vision connection lost.', true) });
    }
    return new Promise<SendResult>((resolve) => {
      this.pending = { kind: 'frame', settle: resolve, timer: this.startTimer() };
    });
  }

  close(): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    this.settleFailure(clientError('REQUEST_CANCELLED', 'Vision connection closed.'));
    this.detach();
  }

  private startTimer(): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      if (this.pending) this.fail(clientError('NETWORK', 'The vision service did not answer in time.', true));
    }, this.timeoutMs);
  }

  private take(): Pending | null {
    const p = this.pending;
    this.pending = null;
    if (p) clearTimeout(p.timer);
    return p;
  }

  private settleFailure(error: SolveError): void {
    const f: Failure = { ok: false, error };
    this.take()?.settle(f);
  }

  private fail(error: SolveError): void {
    if (this.state === 'closed') return;
    this.state = 'failed';
    this.settleFailure(error);
    this.detach();
  }

  private detach(): void {
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try {
      ws.close(1000);
    } catch {
      /* already closed */
    }
  }

  private onMessage(data: unknown): void {
    const p = this.pending;
    if (!p) return; // unsolicited or late: never resolves a request
    let json: unknown;
    try {
      if (typeof data !== 'string') throw new Error('binary');
      json = JSON.parse(data);
    } catch {
      this.badResponse(p, 'Vision service sent an unreadable message.');
      return;
    }
    const parsed = parseScanServerMessage(json);
    if (!parsed.ok) {
      this.badResponse(p, parsed.error.message);
      return;
    }
    const m = parsed.value;
    if (m.type === 'error') {
      const error: SolveError = { kind: 'api', code: m.code, message: m.message, retryable: m.retryable };
      if (p.kind === 'connect') this.fail(error);
      else this.settleFailure(error);
    } else if (p.kind === 'connect' && m.type === 'ready' && m.scanId === this.scanId) {
      this.state = 'ready';
      this.take();
      p.settle({ ok: true, ready: m });
    } else if (p.kind === 'frame' && m.type === 'frame_result' && m.scanId === this.scanId) {
      this.take();
      p.settle({ ok: true, result: m });
    } else {
      this.badResponse(p, 'Vision service sent an unexpected message.');
    }
  }

  private badResponse(p: Pending, message: string): void {
    const error = clientError('BAD_RESPONSE', message);
    if (p.kind === 'connect') this.fail(error);
    else this.settleFailure(error);
  }
}
