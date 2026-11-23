import { describe, expect, it } from 'vitest';
import {
  STABLE_MS,
  STABLE_RESULTS,
  hintForReason,
  initialLiveScanState,
  liveScanReducer,
  stabilityProgress,
  type LiveScanEvent,
  type LiveScanState,
} from '@/features/scanner/live-scan-machine';
import type { FrameResult } from '@/types/api';
import type { ColorName } from '@/types/cube';

const mk = (center: ColorName, other: ColorName = 'red'): ColorName[] => [
  other, other, other, other, center, other, other, other, other,
];

function res(grid: ColorName[] | null, reason?: string): FrameResult {
  return {
    type: 'frame_result', schemaVersion: 1, scanId: 's', frameSeq: 1, width: 640, height: 480,
    detections: [], cells: [], grid,
    quality: grid ? { valid: true } : { valid: false, ...(reason ? { reason } : {}) },
    inferenceMs: 1,
  };
}
const R = (s: LiveScanState, grid: ColorName[] | null, at: number, reason?: string, epoch = s.epoch) =>
  liveScanReducer(s, { type: 'RESULT', epoch, result: res(grid, reason), at });

/** Feeds STABLE_RESULTS results spanning exactly STABLE_MS. */
function stabilize(s: LiveScanState, grid: ColorName[], t0 = 0): LiveScanState {
  let cur = s;
  for (let i = 0; i < STABLE_RESULTS - 1; i++) cur = R(cur, grid, t0 + i * 10);
  return R(cur, grid, t0 + STABLE_MS);
}
const store = (s: LiveScanState): LiveScanState => liveScanReducer(s, { type: 'CAPTURE_STORED', epoch: s.epoch });
const rot = (s: LiveScanState): LiveScanState => liveScanReducer(s, { type: 'ROTATION_DONE', epoch: s.epoch });

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

const ALL = { F: 'green', R: 'red', B: 'blue', L: 'orange', U: 'white', D: 'yellow' } as const;

describe('initial state', () => {
  it('starts at F aligning', () => {
    const s = initialLiveScanState();
    expect(s.stage).toBe('F');
    expect(s.phase).toBe('aligning');
    expect(s.streak).toBeNull();
    expect(s.capturedCenters).toEqual({});
  });
  it('starts at the first face without a preloaded centre', () => {
    expect(initialLiveScanState({ F: 'green', R: 'red' }).stage).toBe('B');
  });
});

describe('stability', () => {
  it('5 results in 900 ms do not capture', () => {
    let s = initialLiveScanState();
    for (let i = 0; i < 5; i++) s = R(s, mk('green'), i * 225);
    expect(s.phase).toBe('stabilizing');
    expect(s.pendingCapture).toBeNull();
  });
  it('4 results over 2 s do not capture; a 5th does', () => {
    let s = initialLiveScanState();
    for (let i = 0; i < 4; i++) s = R(s, mk('green'), i * 700);
    expect(s.phase).toBe('stabilizing');
    s = R(s, mk('green'), 2800);
    expect(s.phase).toBe('captured');
    expect(s.pendingCapture).toEqual({ face: 'F', grid: mk('green') });
  });
  it('a 6th result completes after 5 results in 900 ms', () => {
    let s = initialLiveScanState();
    for (let i = 0; i < 5; i++) s = R(s, mk('green'), i * 225);
    s = R(s, mk('green'), 1000);
    expect(s.phase).toBe('captured');
  });
  it('a changed colour resets the streak to count 1', () => {
    let s = initialLiveScanState();
    s = R(s, mk('green'), 0);
    s = R(s, mk('green'), 100);
    s = R(s, mk('green', 'blue'), 200);
    expect(s.streak).toMatchObject({ count: 1, since: 200 });
  });
  it('an invalid result resets with a hint', () => {
    let s = R(initialLiveScanState(), mk('green'), 0);
    s = R(s, null, 50, 'NO_FACE');
    expect(s.streak).toBeNull();
    expect(s.phase).toBe('aligning');
    expect(s.hint).toBe('Place one cube face inside the square.');
  });
  it('stabilityProgress', () => {
    let s = initialLiveScanState();
    expect(stabilityProgress(s, 0)).toBe(0);
    s = R(s, mk('green'), 0);
    s = R(s, mk('green'), 100);
    expect(stabilityProgress(s, 100)).toBeCloseTo(0.1);
    expect(stabilityProgress(s, 5000)).toBeCloseTo(2 / 5);
  });
});

describe('capture gate', () => {
  it('F with non-green centre is rejected', () => {
    const s = stabilize(initialLiveScanState(), mk('red', 'blue'));
    expect(s.phase).toBe('aligning');
    expect(s.pendingCapture).toBeNull();
    expect(s.streak).toBeNull();
    expect(s.hint).toBe('Hold the face with the green centre toward the camera and white on top.');
  });
  it('U with non-white centre is rejected', () => {
    let s = initialLiveScanState({ F: 'green', R: 'red', B: 'blue', L: 'orange' });
    expect(s.stage).toBe('U');
    s = stabilize(s, mk('yellow', 'blue'));
    expect(s.phase).toBe('aligning');
    expect(s.hint).toBe('The top face centre should be white. Return to the green face, then tilt the top toward you.');
  });
  it('already captured centre is rejected, naming the colour', () => {
    let s = stabilize(initialLiveScanState(), mk('green'));
    s = rot(store(s));
    s = stabilize(s, mk('green', 'blue'));
    expect(s.stage).toBe('R');
    expect(s.phase).toBe('aligning');
    expect(s.hint).toContain('green');
    expect(s.hint).toBe('We still see the green face. Follow the arrow and turn the whole cube.');
  });
  it('D stage rejects a tilt that shows green again', () => {
    const s0 = initialLiveScanState({ F: 'green', R: 'red', B: 'blue', L: 'orange', U: 'white' });
    expect(s0.stage).toBe('D');
    const s = stabilize(s0, mk('green'));
    expect(s.phase).toBe('aligning');
    expect(s.pendingCapture).toBeNull();
    expect(s.hint).toBe('We still see the green face. Follow the arrow and turn the whole cube.');
  });
  it('rescan accepts only the previous centre', () => {
    let s = initialLiveScanState(ALL);
    s = liveScanReducer(s, { type: 'RESCAN', face: 'R', previousCenter: 'red' });
    expect(s.stage).toBe('R');
    expect(s.capturedCenters.R).toBeUndefined();
    const bad = stabilize(s, mk('yellow'));
    expect(bad.phase).toBe('aligning');
    expect(bad.hint).toBe('We still see the yellow face. Follow the arrow and turn the whole cube.');
    const unseen = stabilize(s, mk('blue'));
    expect(unseen.hint).toBe('We still see the blue face. Follow the arrow and turn the whole cube.');
    const ok = stabilize(s, mk('red', 'blue'));
    expect(ok.phase).toBe('captured');
    expect(ok.pendingCapture?.face).toBe('R');
  });
  it('rescan mismatch (uncaptured, wrong colour) gives the same-face hint', () => {
    // R rescanned; the cube shows a face whose centre is not captured and not red.
    const centers = { F: 'green', B: 'blue', L: 'orange', U: 'white', D: 'yellow' } as const;
    let s = initialLiveScanState(centers);
    s = liveScanReducer(s, { type: 'RESCAN', face: 'R', previousCenter: 'red' });
    const bad = stabilize(s, mk('blue', 'red'));
    expect(bad.hint).toBe('We still see the blue face. Follow the arrow and turn the whole cube.');
    const wrong = liveScanReducer(
      initialLiveScanState({ F: 'green', B: 'blue', L: 'orange', U: 'white' }),
      { type: 'RESCAN', face: 'R', previousCenter: 'red' },
    );
    const m = stabilize(wrong, mk('yellow'));
    expect(m.phase).toBe('aligning');
    expect(m.hint).toBe('This is not the same face as before. Show the red-centred face again.');
  });
});

describe('transitions', () => {
  it('CAPTURE_STORED advances stage and epoch into rotating', () => {
    const c = stabilize(initialLiveScanState(), mk('green'));
    const s = store(c);
    expect(s.stage).toBe('R');
    expect(s.phase).toBe('rotating');
    expect(s.epoch).toBe(c.epoch + 1);
    expect(s.capturedCenters).toEqual({ F: 'green' });
    expect(s.pendingCapture).toBeNull();
    expect(s.streak).toBeNull();
  });
  it('results are ignored while captured, rotating and done', () => {
    const c = stabilize(initialLiveScanState(), mk('green'));
    expect(R(c, mk('green'), 5000)).toBe(c);
    const r = store(c);
    expect(R(r, mk('red'), 5000)).toBe(r);
    const d = initialLiveScanState({ F: 'green', R: 'red', B: 'blue', L: 'orange', U: 'white' });
    const done = store(stabilize(d, mk('yellow')));
    expect(done.phase).toBe('done');
    expect(R(done, mk('yellow'), 9000)).toBe(done);
  });
  it('stale-epoch events are ignored', () => {
    const s = initialLiveScanState();
    expect(R(s, mk('green'), 0, undefined, s.epoch + 1)).toBe(s);
    const c = stabilize(s, mk('green'));
    expect(liveScanReducer(c, { type: 'CAPTURE_STORED', epoch: c.epoch - 1 })).toBe(c);
    expect(liveScanReducer(c, { type: 'CAPTURE_FAILED', epoch: c.epoch + 1 })).toBe(c);
    const r = store(c);
    expect(liveScanReducer(r, { type: 'ROTATION_DONE', epoch: r.epoch - 1 })).toBe(r);
  });
  it('CAPTURE_STORED / CAPTURE_FAILED / ROTATION_DONE outside their phase are ignored', () => {
    const s = initialLiveScanState();
    expect(liveScanReducer(s, { type: 'CAPTURE_STORED', epoch: s.epoch })).toBe(s);
    expect(liveScanReducer(s, { type: 'CAPTURE_FAILED', epoch: s.epoch })).toBe(s);
    expect(liveScanReducer(s, { type: 'ROTATION_DONE', epoch: s.epoch })).toBe(s);
  });
  it('CAPTURE_FAILED stays on the stage, then a fresh streak can capture', () => {
    const c = stabilize(initialLiveScanState(), mk('green'));
    const f = liveScanReducer(c, { type: 'CAPTURE_FAILED', epoch: c.epoch });
    expect(f).toMatchObject({ stage: 'F', phase: 'aligning', streak: null, pendingCapture: null, epoch: c.epoch + 1 });
    expect(f.hint).toBe('Could not save this face — hold steady to try again.');
    expect(stabilize(f, mk('green'), 10_000).phase).toBe('captured');
  });
  it('ROTATION_DONE resumes aligning with a new epoch', () => {
    const r = store(stabilize(initialLiveScanState(), mk('green')));
    const a = rot(r);
    expect(a).toMatchObject({ phase: 'aligning', hint: null, epoch: r.epoch + 1, stage: 'R' });
  });
  it('full F-R-B-L-U-D sequence ends in done', () => {
    const cols: ColorName[] = ['green', 'red', 'blue', 'orange', 'white', 'yellow'];
    const stages = ['F', 'R', 'B', 'L', 'U', 'D'];
    let s = initialLiveScanState();
    cols.forEach((c, i) => {
      expect(s.stage).toBe(stages[i]);
      s = stabilize(s, mk(c, c === 'red' ? 'blue' : 'red'));
      expect(s.phase).toBe('captured');
      s = store(s);
      if (i < 5) s = rot(s);
    });
    expect(s.phase).toBe('done');
    expect(Object.values(s.capturedCenters).sort()).toEqual([...cols].sort());
  });
  it('RESCAN of R then capture leads to the first uncaptured face or done', () => {
    let s = initialLiveScanState();
    s = rot(store(stabilize(s, mk('green'))));
    s = rot(store(stabilize(s, mk('red', 'blue'))));
    s = liveScanReducer(s, { type: 'RESCAN', face: 'R', previousCenter: 'red' });
    expect(s.epoch).toBeGreaterThan(0);
    s = store(stabilize(s, mk('red', 'blue')));
    expect(s.stage).toBe('B');
    expect(s.phase).toBe('rotating');
    expect(s.rescan).toBeNull();
    let d = initialLiveScanState(ALL);
    d = liveScanReducer(d, { type: 'RESCAN', face: 'R', previousCenter: 'red' });
    d = store(stabilize(d, mk('red', 'blue')));
    expect(d.phase).toBe('done');
  });
  it('RESET restarts with epoch + 1', () => {
    const s = store(stabilize(initialLiveScanState(), mk('green')));
    const r = liveScanReducer(s, { type: 'RESET' });
    expect(r).toMatchObject({ stage: 'F', phase: 'aligning', epoch: s.epoch + 1, capturedCenters: {} });
    expect(liveScanReducer(s, { type: 'RESET', centers: { F: 'green' } }).stage).toBe('R');
  });
});

describe('hardening', () => {
  it('stale STORED after CAPTURE_FAILED and recapture is ignored', () => {
    const c = stabilize(initialLiveScanState(), mk('green'));
    const f = liveScanReducer(c, { type: 'CAPTURE_FAILED', epoch: c.epoch });
    expect(f.epoch).toBe(c.epoch + 1);
    expect(f.stage).toBe('F');
    const c2 = stabilize(f, mk('green'), 10_000);
    expect(c2.phase).toBe('captured');
    expect(liveScanReducer(c2, { type: 'CAPTURE_STORED', epoch: c.epoch })).toBe(c2);
    expect(R(f, mk('green'), 10_000, undefined, c.epoch)).toBe(f);
  });
  it('non-finite at is ignored', () => {
    const s = initialLiveScanState();
    expect(R(s, mk('green'), NaN)).toBe(s);
    expect(R(s, mk('green'), Infinity)).toBe(s);
  });
  it('at going backwards or equal delays capture', () => {
    let s = initialLiveScanState();
    s = R(s, mk('green'), 5000);
    for (const at of [4000, 3000, 2000, 1000]) s = R(s, mk('green'), at);
    expect(s.phase).toBe('stabilizing');
    let e = initialLiveScanState();
    for (let i = 0; i < 6; i++) e = R(e, mk('green'), 100);
    expect(e.phase).toBe('stabilizing');
  });
  it('gate hint stays latched for the same centre and clears on a different one', () => {
    let s = stabilize(initialLiveScanState(), mk('red', 'blue'));
    const hint = s.hint;
    expect(hint).not.toBeNull();
    for (let i = 0; i < 4; i++) {
      s = R(s, mk('red', 'blue'), 2000 + i);
      expect(s.hint).toBe(hint);
    }
    expect(R(s, mk('green'), 3000).hint).toBeNull();
    expect(R(s, null, 3000, 'TILTED').hint).toBe('Hold the face straight toward the camera.');
    expect(stabilize(s, mk('red', 'blue'), 5000).hint).toBe(hint);
  });
  it.each(['R', 'B', 'L'] as const)('white centre is rejected at stage %s', (stage) => {
    const pre = { F: 'green', R: 'red', B: 'blue', L: 'orange' } as const;
    const order = ['F', 'R', 'B', 'L'] as const;
    const centers = Object.fromEntries(order.slice(0, order.indexOf(stage)).map((f) => [f, pre[f]]));
    const s0 = initialLiveScanState(centers);
    expect(s0.stage).toBe(stage);
    const s = stabilize(s0, mk('white', 'blue'));
    expect(s.phase).toBe('aligning');
    expect(s.hint).toBe('That is the white (top) face. Keep white on top and turn the whole cube left.');
  });
  it('does not alias the event grid', () => {
    const grid = mk('green');
    const s = R(initialLiveScanState(), grid, 0);
    grid[0] = 'blue';
    expect(s.streak!.grid[0]).toBe('red');
    const c = stabilize(initialLiveScanState(), grid.map(() => 'green') as ColorName[]);
    const src = c.pendingCapture!.grid;
    expect(src).toEqual(Array(9).fill('green'));
  });
});

describe('immutability', () => {
  it('never mutates frozen inputs', () => {
    let s = deepFreeze(initialLiveScanState());
    const events: LiveScanEvent[] = [
      { type: 'RESULT', epoch: 0, result: res(mk('green')), at: 0 },
      { type: 'RESULT', epoch: 0, result: res(mk('green')), at: 100 },
      { type: 'RESULT', epoch: 0, result: res(null, 'TILTED'), at: 150 },
      ...[0, 1, 2, 3, 4].map((i): LiveScanEvent => ({ type: 'RESULT', epoch: 0, result: res(mk('green')), at: 200 + i * 300 })),
    ];
    for (const e of events) s = deepFreeze(liveScanReducer(s, deepFreeze(e)));
    expect(s.phase).toBe('captured');
    s = deepFreeze(liveScanReducer(s, deepFreeze({ type: 'CAPTURE_STORED', epoch: 0 } as const)));
    s = deepFreeze(liveScanReducer(s, { type: 'RESCAN', face: 'F', previousCenter: 'green' }));
    s = deepFreeze(liveScanReducer(s, { type: 'RESET' }));
    expect(s.stage).toBe('F');
  });
});

describe('hintForReason', () => {
  it('maps reasons', () => {
    expect(hintForReason('NO_FACE')).toBe('Place one cube face inside the square.');
    expect(hintForReason('INCOMPLETE')).toBe('Some stickers are not detected. Hold the face flat and steady.');
    expect(hintForReason('AMBIGUOUS')).toBe('A sticker colour is unclear. Improve the light or the angle.');
    expect(hintForReason('MISALIGNED')).toBe('Line the face up with the grid.');
    expect(hintForReason('TILTED')).toBe('Hold the face straight toward the camera.');
    expect(hintForReason(undefined)).toBe('Hold the face steady inside the square.');
    expect(hintForReason('WHAT')).toBe('Hold the face steady inside the square.');
  });
});
