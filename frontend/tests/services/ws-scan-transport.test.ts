import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketScanTransport } from '@/services/scan-transport';

const doc = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../../../fixtures/vision/ws-messages.json'), 'utf8'),
) as { messages: { id: string; message: Record<string, unknown> }[] };
const fx = (id: string, patch: Record<string, unknown> = {}) => ({
  ...structuredClone(doc.messages.find((m) => m.id === id)!.message),
  ...patch,
});

class FakeWS {
  static instances: FakeWS[] = [];
  binaryType = 'blob';
  readyState = 0;
  sent: unknown[] = [];
  closedWith: number | undefined;
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  constructor(public url: string) {
    FakeWS.instances.push(this);
  }
  send(d: unknown) {
    this.sent.push(d);
  }
  close(code?: number) {
    this.closedWith = code;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  msg(o: unknown) {
    this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) });
  }
}

const mk = (timeoutMs = 5000) =>
  new WebSocketScanTransport('ws://h/ws/scan', {
    WebSocketImpl: FakeWS as unknown as typeof WebSocket,
    timeoutMs,
    newScanId: () => 'fixture-scan',
  });
const sock = () => FakeWS.instances[FakeWS.instances.length - 1]!;

async function connected(t = mk()) {
  const p = t.connect();
  sock().open();
  sock().msg(fx('ready'));
  const r = await p;
  expect(r.ok).toBe(true);
  return t;
}

beforeEach(() => {
  FakeWS.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('WebSocketScanTransport.connect', () => {
  it('opens with arraybuffer, sends hello on open and resolves on ready', async () => {
    const t = mk();
    expect(t.available).toBe(true);
    const p = t.connect();
    expect(sock().url).toBe('ws://h/ws/scan');
    expect(sock().binaryType).toBe('arraybuffer');
    expect(sock().sent).toEqual([]);
    sock().open();
    expect(JSON.parse(sock().sent[0] as string)).toEqual({ type: 'hello', schemaVersion: 1, scanId: 'fixture-scan' });
    sock().msg(fx('ready'));
    const r = await p;
    expect(r).toMatchObject({ ok: true, ready: { type: 'ready', scanId: 'fixture-scan' } });
  });

  it('fails with BACKEND_UNAVAILABLE on socket error or close before ready', async () => {
    for (const ev of ['onerror', 'onclose'] as const) {
      const t = mk();
      const p = t.connect();
      sock()[ev]?.({});
      expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'BACKEND_UNAVAILABLE', retryable: true } });
    }
  });

  it('fails with NETWORK on timeout', async () => {
    const t = mk(1000);
    const p = t.connect();
    vi.advanceTimersByTime(1000);
    expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'NETWORK', retryable: true } });
  });

  it('rejects a ready for another scanId', async () => {
    const t = mk();
    const p = t.connect();
    sock().open();
    sock().msg(fx('ready', { scanId: 'other' }));
    expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'BAD_RESPONSE' } });
  });

  it('surfaces a server error (MODEL_UNAVAILABLE) as an api error', async () => {
    const t = mk();
    const p = t.connect();
    sock().open();
    sock().msg({ type: 'error', schemaVersion: 1, code: 'MODEL_UNAVAILABLE', message: 'no', retryable: false });
    expect(await p).toMatchObject({ ok: false, error: { kind: 'api', code: 'MODEL_UNAVAILABLE', retryable: false } });
  });
});

describe('WebSocketScanTransport.send', () => {
  it('fails with REQUEST_INVALID when not connected', async () => {
    const t = mk();
    expect(await t.send(new Blob(['x']))).toMatchObject({ ok: false, error: { kind: 'client', code: 'REQUEST_INVALID' } });
    expect(FakeWS.instances).toHaveLength(0);
  });

  it('sends the blob and resolves with the matching frame_result', async () => {
    const t = await connected();
    const blob = new Blob(['x']);
    const p = t.send(blob);
    expect(sock().sent[sock().sent.length - 1]).toBe(blob);
    sock().msg(fx('frame_result_valid'));
    const r = await p;
    expect(r).toMatchObject({ ok: true, result: { type: 'frame_result', frameSeq: 1 } });
  });

  it('rejects a second send while one is pending and sends nothing', async () => {
    const t = await connected();
    const first = t.send(new Blob(['a']));
    const before = sock().sent.length;
    const second = await t.send(new Blob(['b']));
    expect(second).toEqual({
      ok: false,
      error: { kind: 'client', code: 'REQUEST_INVALID', message: 'A frame is already in flight.', retryable: false },
    });
    expect(sock().sent).toHaveLength(before);
    sock().msg(fx('frame_result_valid'));
    expect((await first).ok).toBe(true);
  });

  it('maps a frame_result for another scanId to BAD_RESPONSE', async () => {
    const t = await connected();
    const p = t.send(new Blob(['x']));
    sock().msg(fx('frame_result_valid', { scanId: 'other' }));
    expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'BAD_RESPONSE' } });
  });

  it('maps an unparsable message to BAD_RESPONSE', async () => {
    for (const raw of ['not json', { type: 'frame_result' }]) {
      const t = await connected();
      const p = t.send(new Blob(['x']));
      sock().msg(raw);
      expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'BAD_RESPONSE' } });
    }
  });

  it('maps a server error to an api error and stays usable', async () => {
    const t = await connected();
    const p = t.send(new Blob(['x']));
    sock().msg(fx('error_invalid_frame'));
    expect(await p).toMatchObject({ ok: false, error: { kind: 'api', code: 'INVALID_FRAME', retryable: true } });
    const p2 = t.send(new Blob(['y']));
    sock().msg(fx('frame_result_valid'));
    expect((await p2).ok).toBe(true);
  });

  it('times out as NETWORK, marks itself failed and ignores the late result', async () => {
    const t = await connected(mk(1000));
    const ws = sock();
    const p = t.send(new Blob(['x']));
    vi.advanceTimersByTime(1000);
    expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'NETWORK', retryable: true } });
    ws.msg(fx('frame_result_valid')); // late: must be ignored, never throw
    expect(await t.send(new Blob(['y']))).toMatchObject({ ok: false });
    expect(ws.sent.filter((s) => s instanceof Blob)).toHaveLength(1);
  });

  it('resolves a pending send with BACKEND_UNAVAILABLE when the socket closes', async () => {
    const t = await connected();
    const p = t.send(new Blob(['x']));
    sock().onclose?.({});
    expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'BACKEND_UNAVAILABLE', retryable: true } });
  });
});

describe('WebSocketScanTransport.close', () => {
  it('cancels a pending send, closes with 1000 and ignores later events', async () => {
    const t = await connected();
    const ws = sock();
    const p = t.send(new Blob(['x']));
    t.close();
    expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'REQUEST_CANCELLED' } });
    expect(ws.closedWith).toBe(1000);
    expect(() => {
      ws.msg(fx('frame_result_valid'));
      ws.onclose?.({});
      ws.onerror?.({});
    }).not.toThrow();
    expect(await t.send(new Blob(['y']))).toMatchObject({ ok: false });
    expect(() => t.close()).not.toThrow();
  });

  it('cancels a pending connect', async () => {
    const t = mk();
    const p = t.connect();
    t.close();
    expect(await p).toMatchObject({ ok: false, error: { kind: 'client', code: 'REQUEST_CANCELLED' } });
    sock().open();
    expect(sock().sent).toEqual([]);
  });

  it('does not let a late message from a closed transport resolve a newer one', async () => {
    const a = await connected();
    const wsA = sock();
    a.close();
    const b = await connected();
    const p = b.send(new Blob(['x']));
    wsA.msg(fx('frame_result_valid', { frameSeq: 9 }));
    let settled = false;
    void p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    sock().msg(fx('frame_result_valid', { frameSeq: 1 }));
    expect(await p).toMatchObject({ ok: true, result: { frameSeq: 1 } });
  });
});
