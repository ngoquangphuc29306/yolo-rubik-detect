import { describe, expect, it } from 'vitest';
import { UnavailableScanTransport } from '@/services/scan-transport';

describe('UnavailableScanTransport', () => {
  it('always reports unavailable and never connects', async () => {
    const t = new UnavailableScanTransport();
    expect(t.available).toBe(false);
    expect(await t.connect()).toMatchObject({ ok: false, error: { kind: 'client', code: 'BACKEND_UNAVAILABLE' } });
    expect(() => t.close()).not.toThrow();
    expect(t.available).toBe(false);
  });
});
