import { describe, expect, it } from 'vitest';
import {
  HALF_TURN_MS,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  QUARTER_TURN_MS,
  animDurationMs,
  animationProgress,
  createPlaybackState,
  displayedSnapshotIndex,
  playbackReducer,
  type PlaybackEvent,
  type PlaybackState,
} from '@/engine/playback-fsm';
import type { MoveToken } from '@/types/cube';

// ---------- helpers ----------
const ALL_TOKENS: MoveToken[] = (['U', 'R', 'F', 'D', 'L', 'B'] as const).flatMap((f) => [
  f,
  `${f}'` as MoveToken,
  `${f}2` as MoveToken,
]);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomMoves(rnd: () => number, n: number): MoveToken[] {
  return Array.from({ length: n }, () => ALL_TOKENS[Math.floor(rnd() * ALL_TOKENS.length)]!);
}

const reduce = (s: PlaybackState, ...es: PlaybackEvent[]): PlaybackState =>
  es.reduce(playbackReducer, s);

function reset(moves: readonly MoveToken[], generation = 1, delayMs = 2000): PlaybackState {
  return playbackReducer(createPlaybackState(), { type: 'RESET', generation, moves, delayMs });
}
function started(moves: readonly MoveToken[], generation = 1, delayMs = 2000): PlaybackState {
  return playbackReducer(reset(moves, generation, delayMs), { type: 'START', generation });
}
const tick = (s: PlaybackState, dtMs: number, generation = s.generation): PlaybackState =>
  playbackReducer(s, { type: 'TICK', generation, dtMs });
const pause = (s: PlaybackState, reason: 'user' | 'hidden' = 'user'): PlaybackState =>
  playbackReducer(s, { type: 'PAUSE', generation: s.generation, reason });
const resume = (s: PlaybackState): PlaybackState =>
  playbackReducer(s, { type: 'RESUME', generation: s.generation });
const replay = (s: PlaybackState): PlaybackState =>
  playbackReducer(s, { type: 'REPLAY', generation: s.generation });
const setDelay = (s: PlaybackState, delayMs: number): PlaybackState =>
  playbackReducer(s, { type: 'SET_DELAY', generation: s.generation, delayMs });

// ---------- constants ----------
describe('constants and durations', () => {
  it('has the specified timing constants', () => {
    expect(QUARTER_TURN_MS).toBe(780);
    expect(HALF_TURN_MS).toBe(975);
    expect(MIN_DELAY_MS).toBe(2000);
    expect(MAX_DELAY_MS).toBe(15000);
  });
  it('animDurationMs: half turns are 975, quarter turns and primes are 780', () => {
    expect(animDurationMs('R')).toBe(780);
    expect(animDurationMs("R'")).toBe(780);
    expect(animDurationMs('F2')).toBe(975);
    for (const t of ALL_TOKENS) expect(animDurationMs(t)).toBe(t.endsWith('2') ? 975 : 780);
  });
  it('createPlaybackState is generation 0, idle, total 0', () => {
    const s = createPlaybackState();
    expect(s).toMatchObject({
      generation: 0,
      status: 'idle',
      total: 0,
      index: 0,
      playbackMs: 0,
      isReplay: false,
      pausedFrom: null,
      pauseReason: null,
    });
    expect(s.animMs).toEqual([]);
  });
});

// ---------- B1: RESET and generations ----------
describe('B1 RESET / generation guard', () => {
  it('RESET gen1 -> gen2 re-initialises everything, including a half-finished gen1 state', () => {
    let s = started(['R', 'U', 'F2'], 1, 5000);
    s = tick(s, 780 + 300 + 780 + 5000); // deep in the run
    s = replay(s);
    s = pause(s, 'hidden');
    expect(s.playbackMs).toBeGreaterThan(0);
    const next = playbackReducer(s, { type: 'RESET', generation: 2, moves: ['L', 'D2'], delayMs: 3000 });
    expect(next).toEqual({
      generation: 2,
      status: 'idle',
      pausedFrom: null,
      pauseReason: null,
      animMs: [780, 975],
      total: 2,
      index: 0,
      animElapsedMs: 0,
      waitElapsedMs: 0,
      waitTotalMs: 0,
      delayMs: 3000,
      isReplay: false,
      playbackMs: 0,
    });
  });

  it('late gen1 TICK/PAUSE/REPLAY (and RESUME, SET_DELAY, START) after gen2 are reference-equal no-ops', () => {
    const g2 = tick(started(['R', 'U'], 2), 100);
    const late: PlaybackEvent[] = [
      { type: 'TICK', generation: 1, dtMs: 100 },
      { type: 'PAUSE', generation: 1, reason: 'user' },
      { type: 'RESUME', generation: 1 },
      { type: 'REPLAY', generation: 1 },
      { type: 'SET_DELAY', generation: 1, delayMs: 9000 },
      { type: 'START', generation: 1 },
    ];
    for (const e of late) expect(playbackReducer(g2, e)).toBe(g2);
  });

  it('late RESET gen1 and duplicate RESET gen2 after gen2 are no-ops', () => {
    const g2 = tick(started(['R', 'U'], 2), 100);
    expect(playbackReducer(g2, { type: 'RESET', generation: 1, moves: ['L'], delayMs: 2000 })).toBe(g2);
    expect(playbackReducer(g2, { type: 'RESET', generation: 2, moves: ['L'], delayMs: 2000 })).toBe(g2);
  });

  it('RESET on idle (first reset from generation 0) yields idle with total > 0', () => {
    const s = reset(['R', 'U']);
    expect(s.status).toBe('idle');
    expect(s.total).toBe(2);
    expect(s.generation).toBe(1);
  });

  it('RESET with empty moves => complete, total 0, snapshot index 0, START is a no-op', () => {
    const s = reset([]);
    expect(s.status).toBe('complete');
    expect(s.total).toBe(0);
    expect(displayedSnapshotIndex(s)).toBe(0);
    expect(playbackReducer(s, { type: 'START', generation: 1 })).toBe(s);
  });

  it('RESET clamps delayMs into [2000, 15000]', () => {
    expect(reset(['R'], 1, 10).delayMs).toBe(MIN_DELAY_MS);
    expect(reset(['R'], 1, 999999).delayMs).toBe(MAX_DELAY_MS);
    expect(reset(['R'], 1, 7000).delayMs).toBe(7000);
  });

  it('restarting the SAME move list with a higher generation after complete returns to idle, index 0, playbackMs 0', () => {
    const moves: MoveToken[] = ['R', 'U'];
    let s = tick(started(moves, 1), 100000);
    expect(s.status).toBe('complete');
    expect(s.playbackMs).toBeGreaterThan(0);
    s = playbackReducer(s, { type: 'RESET', generation: 2, moves, delayMs: 2000 });
    expect(s.status).toBe('idle');
    expect(s.index).toBe(0);
    expect(s.playbackMs).toBe(0);
    expect(displayedSnapshotIndex(s)).toBe(0);
    // and the run is playable again
    expect(playbackReducer(s, { type: 'START', generation: 2 }).status).toBe('animating');
  });

  it('after a run restart, late events of the previous run are reference-equal no-ops', () => {
    const moves: MoveToken[] = ['R', 'U'];
    const done = tick(started(moves, 1), 100000);
    const s2 = playbackReducer(done, { type: 'RESET', generation: 2, moves, delayMs: 2000 });
    const late: PlaybackEvent[] = [
      { type: 'TICK', generation: 1, dtMs: 500 },
      { type: 'PAUSE', generation: 1, reason: 'user' },
      { type: 'REPLAY', generation: 1 },
      { type: 'RESUME', generation: 1 },
      { type: 'SET_DELAY', generation: 1, delayMs: 8000 },
      { type: 'RESET', generation: 1, moves: ['L'], delayMs: 2000 },
    ];
    for (const e of late) expect(playbackReducer(s2, e)).toBe(s2);
  });
});

// ---------- snapshot indexing ----------
describe('displayedSnapshotIndex', () => {
  it('is 0 before START and for idle', () => {
    expect(displayedSnapshotIndex(reset(['R', 'U']))).toBe(0);
  });
  it('is 0 for total = 0', () => {
    expect(displayedSnapshotIndex(createPlaybackState())).toBe(0);
    expect(displayedSnapshotIndex(reset([]))).toBe(0);
  });
  it('is index while animating / paused-from-animating, index+1 while waiting / paused-from-waiting / complete', () => {
    let s = started(['R', 'U', 'F']);
    expect(displayedSnapshotIndex(s)).toBe(0);
    expect(displayedSnapshotIndex(pause(tick(s, 100)))).toBe(0);
    s = tick(s, 780 + 10);
    expect(s.status).toBe('waiting');
    expect(displayedSnapshotIndex(s)).toBe(1);
    expect(displayedSnapshotIndex(pause(s))).toBe(1);
    s = tick(s, 100000);
    expect(s.status).toBe('complete');
    expect(displayedSnapshotIndex(s)).toBe(3);
  });
  it('1-move solution: 0 while animating, 1 while waiting and complete', () => {
    let s = started(['R']);
    expect(displayedSnapshotIndex(s)).toBe(0);
    s = tick(s, 780);
    expect(displayedSnapshotIndex(s)).toBe(1);
    s = tick(s, 2000);
    expect(s.status).toBe('complete');
    expect(displayedSnapshotIndex(s)).toBe(1);
  });
});

// ---------- START ----------
describe('START', () => {
  it('idle with total > 0 -> animating at index 0', () => {
    const s = started(['R', 'U']);
    expect(s).toMatchObject({ status: 'animating', index: 0, animElapsedMs: 0 });
  });
  it('is a no-op from every non-idle status', () => {
    const base = started(['R', 'U']);
    for (const s of [base, tick(base, 800), pause(base), tick(base, 100000)]) {
      expect(playbackReducer(s, { type: 'START', generation: 1 })).toBe(s);
    }
  });
});

// ---------- B2: durations and TICK ----------
describe('B2 TICK semantics', () => {
  it('R animation phase is exactly 780 ms', () => {
    let s = tick(started(['R', 'U']), 779);
    expect(s).toMatchObject({ status: 'animating', animElapsedMs: 779 });
    s = tick(s, 1);
    expect(s).toMatchObject({ status: 'waiting', index: 0, waitElapsedMs: 0, waitTotalMs: 2000 });
  });

  it('F2 animation phase is exactly 975 ms', () => {
    let s = tick(started(['F2', 'U']), 974);
    expect(s.status).toBe('animating');
    s = tick(s, 1);
    expect(s.status).toBe('waiting');
  });

  it('pause mid-F2 preserves its elapsed; resume continues to 975', () => {
    let s = tick(started(['F2']), 500);
    s = pause(s);
    expect(s).toMatchObject({ status: 'paused', pausedFrom: 'animating', animElapsedMs: 500 });
    s = resume(s);
    expect(s).toMatchObject({ status: 'animating', animElapsedMs: 500, pausedFrom: null, pauseReason: null });
    s = tick(s, 474);
    expect(s.status).toBe('animating');
    s = tick(s, 1);
    expect(s.status).toBe('waiting');
  });

  it('animationProgress uses the per-move duration', () => {
    const f2 = tick(started(['F2']), 487.5);
    expect(animationProgress(f2)).toBeCloseTo(0.5, 10);
    const r = tick(started(['R']), 390);
    expect(animationProgress(r)).toBeCloseTo(0.5, 10);
    expect(animationProgress(pause(r))).toBeCloseTo(0.5, 10);
  });

  it('animationProgress is 0 unless animating or paused-from-animating', () => {
    expect(animationProgress(createPlaybackState())).toBe(0);
    expect(animationProgress(reset(['R']))).toBe(0);
    expect(animationProgress(tick(started(['R', 'U']), 800))).toBe(0); // waiting
    expect(animationProgress(pause(tick(started(['R', 'U']), 800)))).toBe(0); // paused from waiting
    expect(animationProgress(tick(started(['R']), 100000))).toBe(0); // complete
    expect(animationProgress(reset([]))).toBe(0);
  });

  it('replay of F2 is again 975 ms', () => {
    let s = tick(started(['F2', 'U']), 975 + 500); // waiting after F2
    s = replay(s);
    expect(s).toMatchObject({ status: 'animating', index: 0, animElapsedMs: 0, isReplay: true });
    s = tick(s, 974);
    expect(s.status).toBe('animating');
    s = tick(s, 1);
    expect(s.status).toBe('waiting');
    expect(s.waitElapsedMs).toBe(0);
  });

  it('final wait completes (waiting -> complete only after the full delay)', () => {
    let s = tick(started(['R']), 780);
    s = tick(s, 1999);
    expect(s.status).toBe('waiting');
    s = tick(s, 1);
    expect(s.status).toBe('complete');
    expect(s.playbackMs).toBe(780 + 2000);
  });

  it('wait -> next move increments index and starts animating', () => {
    const s = tick(started(['R', 'U']), 780 + 2000);
    expect(s).toMatchObject({ status: 'animating', index: 1, animElapsedMs: 0 });
  });

  it('overshoot carries into the next phase (end of anim + 300 ms of wait)', () => {
    const s = tick(started(['R', 'U']), 780 + 300);
    expect(s).toMatchObject({ status: 'waiting', waitElapsedMs: 300, waitTotalMs: 2000, playbackMs: 1080 });
  });

  it('a huge tick carries across several moves', () => {
    const s = tick(started(['R', 'U', 'F']), 780 + 2000 + 780 + 2000 + 100);
    expect(s).toMatchObject({ status: 'animating', index: 2, animElapsedMs: 100 });
  });

  it('overshoot after complete is discarded and not counted in playbackMs', () => {
    const s = tick(started(['R']), 780 + 2000 + 5000);
    expect(s.status).toBe('complete');
    expect(s.playbackMs).toBe(2780);
    expect(tick(s, 1000)).toBe(s);
  });

  it('NaN, negative, Infinity and non-number dtMs are ignored (reference-equal)', () => {
    const s = tick(started(['R', 'U']), 100);
    for (const dt of [NaN, -1, -0.0001, Infinity, -Infinity, '5' as unknown as number]) {
      expect(tick(s, dt)).toBe(s);
    }
  });

  it('TICK 0 changes nothing', () => {
    const s = started(['R']);
    expect(tick(s, 0)).toBe(s);
  });

  it('TICK in idle / paused / complete returns the same state (paused ticks do not touch playbackMs)', () => {
    const idle = reset(['R']);
    expect(tick(idle, 100)).toBe(idle);
    const p = pause(tick(started(['R']), 100));
    expect(tick(p, 100)).toBe(p);
    const done = tick(started(['R']), 100000);
    expect(tick(done, 100)).toBe(done);
  });

  it('TICK 2000 is equivalent to twenty TICK 100', () => {
    const base = started(['R', 'U2', 'F']);
    let s = base;
    for (let i = 0; i < 20; i++) s = tick(s, 100);
    expect(s).toEqual(tick(base, 2000));
  });

  it('associativity: reduce(TICK a, TICK b) == TICK(a+b) over many random splits and totals {1,2,5,18}', () => {
    const rnd = mulberry32(0xc0ffee);
    let cases = 0;
    for (const total of [1, 2, 5, 18]) {
      for (let iter = 0; iter < 60; iter++) {
        const moves = randomMoves(rnd, total);
        const delay = 2000 + Math.floor(rnd() * 13001);
        const base = started(moves, 1, delay);
        const horizon = animSum(moves) + total * delay;
        const sum = Math.floor(rnd() * (horizon * 1.2));
        const direct = tick(base, sum);
        // two-way split
        const a = Math.floor(rnd() * (sum + 1));
        expect(reduce(base, tickEv(a), tickEv(sum - a))).toEqual(direct);
        // many-way split
        let rest = sum;
        let s = base;
        while (rest > 0) {
          const c = Math.min(rest, 1 + Math.floor(rnd() * 1500));
          s = tick(s, c);
          rest -= c;
        }
        expect(s).toEqual(direct);
        cases++;
      }
    }
    expect(cases).toBe(240);
  });

  function tickEv(dtMs: number): PlaybackEvent {
    return { type: 'TICK', generation: 1, dtMs };
  }
  function animSum(moves: readonly MoveToken[]): number {
    return moves.reduce((acc, m) => acc + animDurationMs(m), 0);
  }

  it('playbackMs equals the exact total of applied time up to completion', () => {
    const moves: MoveToken[] = ['R', 'F2', "U'"];
    const full = 780 + 975 + 780 + 3 * 2500;
    const s = tick(started(moves, 1, 2500), 10 ** 7);
    expect(s.status).toBe('complete');
    expect(s.playbackMs).toBe(full);
  });
});

// ---------- PAUSE / RESUME ----------
describe('PAUSE / RESUME', () => {
  it('pause/resume while animating preserves both counters and records reason', () => {
    const a = tick(started(['R', 'U']), 300);
    const p = pause(a, 'hidden');
    expect(p).toMatchObject({
      status: 'paused',
      pausedFrom: 'animating',
      pauseReason: 'hidden',
      animElapsedMs: 300,
      waitElapsedMs: 0,
      playbackMs: 300,
    });
    const r = resume(p);
    expect(r).toMatchObject({ status: 'animating', pausedFrom: null, pauseReason: null, animElapsedMs: 300, playbackMs: 300 });
    expect(r.index).toBe(a.index);
  });

  it('pause/resume while waiting preserves wait elapsed and waitTotalMs', () => {
    const w = tick(started(['R', 'U']), 780 + 700);
    const p = pause(w);
    expect(p).toMatchObject({ status: 'paused', pausedFrom: 'waiting', pauseReason: 'user', waitElapsedMs: 700, waitTotalMs: 2000 });
    const r = resume(p);
    expect(r).toMatchObject({ status: 'waiting', waitElapsedMs: 700, waitTotalMs: 2000, pausedFrom: null, pauseReason: null });
    expect(tick(r, 1300).status).toBe('animating');
  });

  it('PAUSE from idle / paused / complete is a no-op; RESUME from non-paused is a no-op', () => {
    const idle = reset(['R']);
    const p = pause(tick(started(['R']), 10));
    const done = tick(started(['R']), 10 ** 6);
    for (const s of [idle, p, done]) expect(pause(s)).toBe(s);
    const run = started(['R']);
    for (const s of [idle, run, done]) expect(resume(s)).toBe(s);
  });

  it('time spent paused does not count toward playbackMs', () => {
    const p = pause(tick(started(['R']), 200));
    expect(tick(p, 5000).playbackMs).toBe(200);
  });
});

// ---------- REPLAY ----------
describe('REPLAY', () => {
  it('from animating: restarts the same move, index unchanged, isReplay true', () => {
    const s = replay(tick(started(['R', 'U']), 400));
    expect(s).toMatchObject({ status: 'animating', index: 0, animElapsedMs: 0, isReplay: true, pausedFrom: null });
  });

  it('from waiting: same index (never index+1), fresh anim, fresh full wait afterwards', () => {
    const w = tick(started(['R', 'U']), 780 + 900);
    const r = replay(w);
    expect(r).toMatchObject({ status: 'animating', index: 0, animElapsedMs: 0, isReplay: true });
    const after = tick(r, 780);
    expect(after).toMatchObject({ status: 'waiting', index: 0, waitElapsedMs: 0, waitTotalMs: 2000 });
  });

  it('from paused (both phases): resumes as an animating replay and clears the pause', () => {
    for (const p of [pause(tick(started(['R', 'U']), 300)), pause(tick(started(['R', 'U']), 1500))]) {
      expect(replay(p)).toMatchObject({
        status: 'animating',
        index: 0,
        animElapsedMs: 0,
        isReplay: true,
        pausedFrom: null,
        pauseReason: null,
      });
    }
  });

  it('from idle or complete is a no-op', () => {
    const idle = reset(['R']);
    const done = tick(started(['R']), 10 ** 6);
    expect(replay(idle)).toBe(idle);
    expect(replay(done)).toBe(done);
    const empty = reset([]);
    expect(replay(empty)).toBe(empty);
  });

  it('replay on the final move still ends in complete only after a full wait', () => {
    let s = tick(started(['R', 'U']), 780 + 2000 + 780 + 500); // final wait, 500 in
    expect(s).toMatchObject({ status: 'waiting', index: 1 });
    s = replay(s);
    expect(s).toMatchObject({ status: 'animating', index: 1 });
    s = tick(s, 780 + 1999);
    expect(s.status).toBe('waiting');
    s = tick(s, 1);
    expect(s.status).toBe('complete');
  });

  it('derived displayed-index sequence across a replay never shows index+2 and never changes index', () => {
    const base = tick(started(['R', 'U', 'F']), 780 + 600); // waiting, index 0
    expect(displayedSnapshotIndex(base)).toBe(1);
    const seen: number[] = [];
    let s = replay(base);
    for (let i = 0; i < 200 && s.index === 0 && s.status !== 'complete'; i++) {
      expect(s.index).toBe(0);
      seen.push(displayedSnapshotIndex(s));
      s = tick(s, 50);
    }
    expect(Math.max(...seen)).toBeLessThanOrEqual(1);
    expect(seen[0]).toBe(0); // replay shows S[index] again
    expect(seen).toContain(1);
  });

  it('replay does not change playbackMs', () => {
    const s = tick(started(['R', 'U']), 400);
    expect(replay(s).playbackMs).toBe(400);
  });
});

// ---------- SET_DELAY ----------
describe('SET_DELAY', () => {
  it('mid-wait leaves waitTotalMs unchanged but the next wait uses the new value', () => {
    let s = tick(started(['R', 'U', 'F'], 1, 2000), 780 + 500);
    expect(s.waitTotalMs).toBe(2000);
    s = setDelay(s, 6000);
    expect(s).toMatchObject({ delayMs: 6000, waitTotalMs: 2000, waitElapsedMs: 500 });
    s = tick(s, 1500); // finishes the in-flight 2000 ms wait
    expect(s).toMatchObject({ status: 'animating', index: 1 });
    s = tick(s, 780);
    expect(s).toMatchObject({ status: 'waiting', waitTotalMs: 6000, waitElapsedMs: 0 });
  });

  it('is clamped to [2000, 15000]', () => {
    const s = started(['R']);
    expect(setDelay(s, 1).delayMs).toBe(MIN_DELAY_MS);
    expect(setDelay(s, 10 ** 9).delayMs).toBe(MAX_DELAY_MS);
    expect(setDelay(s, Infinity).delayMs).toBe(MAX_DELAY_MS);
  });

  it('NaN is ignored; an unchanged value is a reference-equal no-op', () => {
    const s = started(['R']);
    expect(setDelay(s, NaN)).toBe(s);
    expect(setDelay(s, s.delayMs)).toBe(s);
  });

  it('works in idle and paused without touching other fields', () => {
    const idle = reset(['R']);
    expect(setDelay(idle, 4000)).toEqual({ ...idle, delayMs: 4000 });
    const p = pause(tick(started(['R']), 100));
    expect(setDelay(p, 4000)).toEqual({ ...p, delayMs: 4000 });
  });
});

// ---------- empty / 1-move ----------
describe('empty and 1-move solutions', () => {
  it('empty: complete from RESET; TICK/PAUSE/REPLAY/RESUME/START are all no-ops', () => {
    const s = reset([]);
    expect(s).toMatchObject({ status: 'complete', total: 0, index: 0, playbackMs: 0 });
    for (const e of [
      { type: 'TICK', generation: 1, dtMs: 1000 },
      { type: 'PAUSE', generation: 1, reason: 'user' },
      { type: 'RESUME', generation: 1 },
      { type: 'REPLAY', generation: 1 },
      { type: 'START', generation: 1 },
    ] as PlaybackEvent[]) {
      expect(playbackReducer(s, e)).toBe(s);
    }
  });

  it('1 move: full run animating -> waiting -> complete, snapshot index in [0,1]', () => {
    let s = started(['U']);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      seen.add(displayedSnapshotIndex(s));
      s = tick(s, 16);
    }
    expect(s.status).toBe('complete');
    expect([...seen].sort()).toEqual([0, 1]);
    expect(s.index).toBe(0);
  });
});

// ---------- immutability ----------
describe('immutability', () => {
  it('returns a NEW object on change and does not mutate the input', () => {
    const s = started(['R', 'U']);
    const snapshot = JSON.stringify(s);
    const n = tick(s, 100);
    expect(n).not.toBe(s);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('animMs is frozen and RESET copies the moves list (later mutation of input cannot leak in)', () => {
    const moves: MoveToken[] = ['R', 'F2'];
    const s = reset(moves);
    expect(Object.isFrozen(s.animMs)).toBe(true);
    moves.push('U');
    expect(s.animMs).toEqual([780, 975]);
    expect(s.total).toBe(2);
    expect(Object.isFrozen(createPlaybackState().animMs)).toBe(true);
  });

  it('animMs identity is stable across transitions', () => {
    const s = started(['R', 'F2']);
    expect(tick(s, 800).animMs).toBe(s.animMs);
  });
});

// ---------- exhaustiveness: no SKIP_WAIT / previous / next ----------
describe('event union is exactly the approved set', () => {
  // Record<PlaybackEvent['type'], true> fails `tsc` on a missing OR an extra event type.
  const eventTypes: Record<PlaybackEvent['type'], true> = {
    RESET: true,
    START: true,
    TICK: true,
    PAUSE: true,
    RESUME: true,
    REPLAY: true,
    SET_DELAY: true,
  };
  it('contains exactly RESET, START, TICK, PAUSE, RESUME, REPLAY, SET_DELAY', () => {
    expect(new Set(Object.keys(eventTypes))).toEqual(
      new Set(['RESET', 'START', 'TICK', 'PAUSE', 'RESUME', 'REPLAY', 'SET_DELAY']),
    );
  });
  it('an unknown event (e.g. SKIP_WAIT) is a reference-equal no-op at runtime', () => {
    const s = started(['R']);
    const bogus = { type: 'SKIP_WAIT', generation: 1 } as unknown as PlaybackEvent;
    expect(playbackReducer(s, bogus)).toBe(s);
  });
});

// ---------- invariants property ----------
describe('invariants (seeded random event sequences)', () => {
  function randomEvent(rnd: () => number, gen: number): PlaybackEvent {
    const r = rnd();
    const g = rnd() < 0.1 ? gen - 1 : gen; // occasional stale generation
    if (r < 0.5) {
      const dts = [0, 1, 16, 100, 700, 780, 975, 2000, 5000, NaN, -5, Infinity];
      const dtMs = rnd() < 0.8 ? Math.floor(rnd() * 1200) : dts[Math.floor(rnd() * dts.length)]!;
      return { type: 'TICK', generation: g, dtMs };
    }
    if (r < 0.6) return { type: 'PAUSE', generation: g, reason: rnd() < 0.5 ? 'user' : 'hidden' };
    if (r < 0.72) return { type: 'RESUME', generation: g };
    if (r < 0.82) return { type: 'REPLAY', generation: g };
    if (r < 0.9) return { type: 'SET_DELAY', generation: g, delayMs: Math.floor(rnd() * 20000) - 1000 };
    return { type: 'START', generation: g };
  }

  function checkInvariants(s: PlaybackState) {
    expect(s.index).toBeGreaterThanOrEqual(0);
    expect(s.index).toBeLessThanOrEqual(Math.max(s.total - 1, 0));
    expect(s.animMs.length).toBe(s.total);
    const d = displayedSnapshotIndex(s);
    expect(Number.isInteger(d)).toBe(true);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(s.total);
    expect(s.animElapsedMs).toBeGreaterThanOrEqual(0);
    if (s.total > 0) expect(s.animElapsedMs).toBeLessThanOrEqual(s.animMs[s.index]!);
    expect(s.waitElapsedMs).toBeGreaterThanOrEqual(0);
    expect(s.waitElapsedMs).toBeLessThanOrEqual(s.waitTotalMs);
    const p = animationProgress(s);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
    expect(s.delayMs).toBeGreaterThanOrEqual(MIN_DELAY_MS);
    expect(s.delayMs).toBeLessThanOrEqual(MAX_DELAY_MS);
    expect(Number.isFinite(s.playbackMs)).toBe(true);
    if (s.status === 'paused') expect(s.pausedFrom).not.toBeNull();
    else expect(s.pausedFrom).toBeNull();
  }

  it('holds for random generation-valid sequences over total in {0,1,2,5,18}', () => {
    const rnd = mulberry32(20261120);
    let steps = 0;
    for (const total of [0, 1, 2, 5, 18]) {
      for (let run = 0; run < 25; run++) {
        const moves = randomMoves(rnd, total);
        let gen = 1;
        let s = reset(moves, gen, 2000 + Math.floor(rnd() * 5000));
        if (rnd() < 0.8) s = playbackReducer(s, { type: 'START', generation: gen });
        for (let i = 0; i < 300; i++) {
          const prev = s;
          if (rnd() < 0.02) {
            gen += 1; // restart with a higher playback-run generation
            s = playbackReducer(s, { type: 'RESET', generation: gen, moves, delayMs: 3000 });
            expect(s.playbackMs).toBe(0);
            expect(s.generation).toBe(gen);
          } else {
            const e = randomEvent(rnd, gen);
            s = playbackReducer(s, e);
            if (e.type === 'TICK' && prev.status === 'paused') expect(s).toBe(prev);
            if (e.generation !== gen) expect(s).toBe(prev);
            expect(s.playbackMs).toBeGreaterThanOrEqual(prev.playbackMs);
          }
          checkInvariants(s);
          steps++;
        }
      }
    }
    expect(steps).toBe(5 * 25 * 300);
  });
});
