import { describe, expect, it } from 'vitest';
import { createLatestGuard } from '@/lib/request-guard';

describe('createLatestGuard', () => {
  it('begin() returns a current handle with an unaborted signal and increasing ids', () => {
    const g = createLatestGuard();
    const a = g.begin();
    expect(a.isCurrent()).toBe(true);
    expect(a.signal.aborted).toBe(false);
    expect(g.begin().id).toBeGreaterThan(a.id);
  });

  it('begin() aborts the previous request and supersedes it', () => {
    const g = createLatestGuard();
    const a = g.begin();
    const b = g.begin();
    expect(a.signal.aborted).toBe(true);
    expect(a.isCurrent()).toBe(false);
    expect(b.signal.aborted).toBe(false);
    expect(b.isCurrent()).toBe(true);
  });

  it('ignores a stale success and a stale error after a newer begin()', async () => {
    const g = createLatestGuard();
    const applied: string[] = [];
    const run = (name: string, settle: Promise<string>) => {
      const h = g.begin();
      return settle.then(
        (v) => { if (h.isCurrent()) applied.push(`ok:${name}:${v}`); },
        (e: Error) => { if (h.isCurrent()) applied.push(`err:${name}:${e.message}`); },
      );
    };
    let resolveFirst!: (v: string) => void;
    let rejectThird!: (e: Error) => void;
    const first = run('first', new Promise<string>((res) => { resolveFirst = res; }));
    const second = run('second', Promise.resolve('fresh'));
    resolveFirst('stale');
    await Promise.all([first, second]);
    expect(applied).toEqual(['ok:second:fresh']);

    const third = run('third', new Promise<string>((_, rej) => { rejectThird = rej; }));
    const fourth = run('fourth', Promise.reject(new Error('current-failure')));
    rejectThird(new Error('stale-failure'));
    await Promise.all([third, fourth]);
    expect(applied).toEqual(['ok:second:fresh', 'err:fourth:current-failure']);
  });

  it('reset() aborts the current request and invalidates every handle', () => {
    const g = createLatestGuard();
    const a = g.begin();
    g.reset();
    expect(a.signal.aborted).toBe(true);
    expect(a.isCurrent()).toBe(false);
    const b = g.begin();
    expect(b.isCurrent()).toBe(true);
    expect(a.isCurrent()).toBe(false);
  });

  it('reset() with no request is a no-op and guards are independent', () => {
    expect(() => createLatestGuard().reset()).not.toThrow();
    const h1 = createLatestGuard();
    const h2 = createLatestGuard();
    const a = h1.begin();
    h2.begin();
    h2.reset();
    expect(a.isCurrent()).toBe(true);
  });
});
