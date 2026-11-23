import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScanServerMessage } from '@/services/parsers';
import { scanSocketUrl, WS_SCAN_PATH } from '@/services/api-config';

interface Doc {
  schema: string;
  messages: { id: string; message: Record<string, any> }[];
}
const doc: Doc = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../../../fixtures/vision/ws-messages.json'), 'utf8'),
);
const get = (id: string) => structuredClone(doc.messages.find((m) => m.id === id)!.message);

describe('parseScanServerMessage', () => {
  it('has the six recorded messages', () => {
    expect(doc.schema).toBe('ws-messages/1');
    expect(doc.messages).toHaveLength(6);
  });

  it.each(doc.messages.map((m) => [m.id, m.message.type] as const))('accepts recorded %s', (id, type) => {
    const r = parseScanServerMessage(get(id));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe(type);
  });

  const rejects = (label: string, mutate: (m: Record<string, any>) => void, base = 'frame_result_valid') =>
    it(`rejects ${label}`, () => {
      const m = get(base);
      mutate(m);
      const r = parseScanServerMessage(m);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatchObject({ kind: 'client', code: 'BAD_RESPONSE' });
    });

  rejects('an extra key', (m) => (m.extra = 1));
  rejects('an extra cell key', (m) => (m.cells[0].extra = 1));
  rejects('an unknown colour', (m) => (m.detections[0].color = 'purple'));
  rejects('an unknown grid colour', (m) => (m.grid[3] = 'pink'));
  rejects('8 cells', (m) => m.cells.pop());
  rejects('a non-finite box', (m) => (m.detections[0].xyxy[1] = null));
  rejects('a 3-element box', (m) => m.detections[0].xyxy.pop());
  rejects('a missing scanId', (m) => delete m.scanId);
  rejects('wrong schemaVersion', (m) => (m.schemaVersion = 2));
  rejects('frameSeq 0', (m) => (m.frameSeq = 0));
  rejects('non-integer frameSeq', (m) => (m.frameSeq = 1.5));
  rejects('invalid without reason', (m) => (m.quality = { valid: false }));
  rejects('valid with reason', (m) => (m.quality = { valid: true, reason: 'X' }));
  rejects('a cell with colour but null confidence', (m) => (m.cells[0].confidence = null));
  rejects('a cell with confidence but null colour', (m) => (m.cells[0].color = null));
  rejects('an 8-colour grid', (m) => m.grid.pop());
  rejects('an unknown message type', (m) => (m.type = 'pong'));
  rejects('an unknown error code', (m) => (m.code = 'NOPE'), 'error_invalid_frame');
  rejects('ready without maxFrameEdge', (m) => delete m.maxFrameEdge, 'ready');
  it('rejects non-objects', () => {
    for (const v of [null, 'x', 3, [], undefined]) expect(parseScanServerMessage(v).ok).toBe(false);
  });
});

describe('scanSocketUrl', () => {
  it('maps http to ws and https to wss', () => {
    expect(WS_SCAN_PATH).toBe('/ws/scan');
    expect(scanSocketUrl({ protocol: 'http:', host: '127.0.0.1:5173' })).toBe('ws://127.0.0.1:5173/ws/scan');
    expect(scanSocketUrl({ protocol: 'https:', host: 'x.example' })).toBe('wss://x.example/ws/scan');
  });
});
