import { describe, expect, it } from 'vitest';
import golden from '../golden/legacy-characterization.json';
import { applyMove, buildSnapshots, parseMoveToken, verifySolution } from '@/engine/move-engine';
import { CubeStateError, SOLVED, facesFromState } from '@/engine/cube-state';
import { parseMove } from '@/engine/move-presentation';
import { parseMove as legacyParseMove, type MoveNotation } from '@/lib/cubeEngine';
import type { CenterColors, ColorName, FaceId, FaceletState, MoveToken } from '@/types/cube';
import {
  SOLVED as REF_SOLVED,
  applyMove as refApply,
  toFacelets,
  type CubieState,
} from '../reference/cubie-reference';

const FACES: FaceId[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const ALL_TOKENS: MoveToken[] = FACES.flatMap((f) => [f, `${f}'`, `${f}2`] as MoveToken[]);
const fs = (s: string) => s.replace(/ /g, '') as FaceletState;
const run = (s: FaceletState, seq: string): FaceletState =>
  seq
    .split(' ')
    .filter(Boolean)
    .reduce<FaceletState>((a, t) => applyMove(a, t as MoveToken), s);
const inv = (t: MoveToken): MoveToken =>
  (t.endsWith('2') ? t : t.endsWith("'") ? t[0] : `${t}'`) as MoveToken;

// mulberry32; seed recorded here.
const SEED = 0x5eed1234;
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('parseMoveToken', () => {
  it('accepts exactly the 18 tokens', () => {
    expect(ALL_TOKENS).toHaveLength(18);
    for (const t of ALL_TOKENS) expect(parseMoveToken(t)).toBe(t);
  });
  it.each(['x', 'y', 'z', 'M', 'Rw', 'r', 'R3', "R2'", "''", '', 'u', ' R', 'R ', 'R2 ', "R'2", 'RR'])(
    'rejects %j',
    (t) => {
      expect(() => parseMoveToken(t)).toThrow(CubeStateError);
    },
  );
});

describe('applyMove physical goldens (hand-derived, on SOLVED)', () => {
  const goldens: Record<string, string> = {
    U: 'UUUUUUUUU BBBRRRRRR RRRFFFFFF DDDDDDDDD FFFLLLLLL LLLBBBBBB',
    "U'": 'UUUUUUUUU FFFRRRRRR LLLFFFFFF DDDDDDDDD BBBLLLLLL RRRBBBBBB',
    R: 'UUFUUFUUF RRRRRRRRR FFDFFDFFD DDBDDBDDB LLLLLLLLL UBBUBBUBB',
    F: 'UUUUUULLL URRURRURR FFFFFFFFF RRRDDDDDD LLDLLDLLD BBBBBBBBB',
    D: 'UUUUUUUUU RRRRRRFFF FFFFFFLLL DDDDDDDDD LLLLLLBBB BBBBBBRRR',
    L: 'BUUBUUBUU RRRRRRRRR UFFUFFUFF FDDFDDFDD LLLLLLLLL BBDBBDBBD',
    B: 'RRRUUUUUU RRDRRDRRD FFFFFFFFF DDDDDDLLL ULLULLULL BBBBBBBBB',
    'R U': 'UUUUUUFFF UBBRRRRRR RRRFFDFFD DDBDDBDDB FFDLLLLLL LLLUBBUBB',
    // Inverse of D: L bottom row receives F, F bottom = R, R bottom = B, B bottom = L.
    "D'": 'UUUUUUUUU RRRRRRBBB FFFFFFRRR DDDDDDDDD LLLLLLFFF BBBBBBLLL',
  };
  for (const [seq, expected] of Object.entries(goldens)) {
    it(seq, () => {
      expect(run(SOLVED, seq)).toBe(fs(expected));
    });
  }
  it("D then D' is identity and D' undoes the D golden", () => {
    expect(run(SOLVED, "D D'")).toBe(SOLVED);
    expect(run(fs(goldens.D), "D'")).toBe(SOLVED);
  });
});

describe('differential vs pinned cubie reference', () => {
  it('500 seeded random sequences (seed 0x5eed1234), checked after every move', () => {
    const rnd = mulberry32(SEED);
    let checked = 0;
    for (let n = 0; n < 500; n++) {
      const len = 1 + Math.floor(rnd() * 25);
      let e: FaceletState = SOLVED;
      let r: CubieState = REF_SOLVED;
      const seq: string[] = [];
      for (let i = 0; i < len; i++) {
        const t = ALL_TOKENS[Math.floor(rnd() * 18)];
        seq.push(t);
        e = applyMove(e, t);
        r = refApply(r, t);
        if (e !== toFacelets(r)) {
          throw new Error(`MISMATCH seq=${seq.join(' ')}\n engine=${e}\n ref   =${toFacelets(r)}`);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
  it('each single move on SOLVED equals the reference', () => {
    for (const t of ALL_TOKENS) expect(applyMove(SOLVED, t), t).toBe(toFacelets(refApply(REF_SOLVED, t)));
  });
});

describe('properties', () => {
  const CENTERS = [4, 13, 22, 31, 40, 49];
  const rnd = mulberry32(SEED ^ 0xabcdef);
  const randomState = () => {
    let s: FaceletState = SOLVED;
    for (let i = 0; i < 30; i++) s = applyMove(s, ALL_TOKENS[Math.floor(rnd() * 18)]);
    return s;
  };

  it('centres fixed; nine of each letter', () => {
    for (let n = 0; n < 50; n++) {
      const s = randomState();
      for (const t of ALL_TOKENS) {
        const o = applyMove(s, t);
        expect(CENTERS.map((i) => o[i]).join('')).toBe('URFDLB');
        for (const f of FACES) expect(o.split(f).length - 1).toBe(9);
      }
    }
  });
  it('m then inverse is identity; quarter^4 and half^2 are identity', () => {
    for (let n = 0; n < 30; n++) {
      const s = randomState();
      for (const t of ALL_TOKENS) {
        expect(applyMove(applyMove(s, t), inv(t)), t).toBe(s);
        if (!t.endsWith('2')) {
          let o = s;
          for (let k = 0; k < 4; k++) o = applyMove(o, t);
          expect(o, t).toBe(s);
        } else {
          expect(applyMove(applyMove(s, t), t), t).toBe(s);
        }
      }
    }
  });
  it("(R U R' U')^6 = id", () => {
    let s: FaceletState = SOLVED;
    for (let k = 0; k < 6; k++) s = run(s, "R U R' U'");
    expect(s).toBe(SOLVED);
    expect(run(SOLVED, "R U R' U'")).not.toBe(SOLVED);
  });
  it('(R U) has order 105', () => {
    let s: FaceletState = SOLVED;
    let order = 0;
    do {
      s = run(s, 'R U');
      order++;
    } while (s !== SOLVED && order < 1000);
    expect(order).toBe(105);
  });
});

describe('buildSnapshots / verifySolution', () => {
  const scramble = "R U R' U' F2 D L'".split(' ') as MoveToken[];
  const initial = scramble.reduce((s, m) => applyMove(s, m), SOLVED);
  const solution = [...scramble].reverse().map(inv);

  it('buildSnapshots: length n+1, S[0]=initial, S[i+1]=applyMove(S[i], m[i])', () => {
    const snaps = buildSnapshots(initial, solution);
    expect(snaps).toHaveLength(solution.length + 1);
    expect(snaps[0]).toBe(initial);
    solution.forEach((m, i) => expect(snaps[i + 1]).toBe(applyMove(snaps[i], m)));
    expect(buildSnapshots(initial, [])).toEqual([initial]);
  });
  it('accepts the correct solution', () => {
    const v = verifySolution(initial, solution);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.snapshots).toHaveLength(solution.length + 1);
      expect(v.snapshots[solution.length]).toBe(SOLVED);
    }
  });
  it('rejects a tampered move', () => {
    const bad = [...solution];
    bad[2] = bad[2] === 'F' ? 'B' : 'F';
    expect(verifySolution(initial, bad).ok).toBe(false);
  });
  it('rejects a tampered initial state', () => {
    expect(verifySolution(applyMove(initial, 'U'), solution).ok).toBe(false);
  });
  it('rejects a non-solved ending', () => {
    const v = verifySolution(initial, solution.slice(0, -1));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBeTruthy();
  });
  it('empty moves: ok on SOLVED, fail on scrambled', () => {
    const v = verifySolution(SOLVED, []);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.snapshots).toEqual([SOLVED]);
    expect(verifySolution(initial, []).ok).toBe(false);
  });
  it('scramble state agrees with the reference', () => {
    let r: CubieState = REF_SOLVED;
    for (const m of scramble) r = refApply(r, m);
    expect(initial).toBe(toFacelets(r));
  });
});

describe('legacy agreement (characterization cross-check)', () => {
  const LETTER: Record<string, ColorName> = {
    W: 'white',
    Y: 'yellow',
    G: 'green',
    B: 'blue',
    R: 'red',
    O: 'orange',
  };
  const CENTERS: CenterColors = {
    U: 'white',
    D: 'yellow',
    F: 'green',
    B: 'blue',
    R: 'red',
    L: 'orange',
  };
  const toColors = (g: Record<string, string[]>) =>
    Object.fromEntries(Object.entries(g).map(([f, a]) => [f, a.map((c) => LETTER[c])]));
  const engineFaces = (s: FaceletState) => facesFromState(s, CENTERS);

  it('18 single moves on solved equal frozen legacy faces', () => {
    for (const t of ALL_TOKENS) {
      const frozen = toColors((golden.singleMoves as Record<string, Record<string, string[]>>)[t]);
      expect(engineFaces(applyMove(SOLVED, t)), t).toEqual(frozen);
    }
  });
  it('3 legacy presets: scramble equals frozen scrambled faces; solution solves', () => {
    expect(golden.presets).toHaveLength(3);
    for (const p of golden.presets) {
      const scrambled = (p.scramble as MoveToken[]).reduce((s, m) => applyMove(s, m), SOLVED);
      expect(engineFaces(scrambled), `preset ${p.index}`).toEqual(toColors(p.scrambledFaces));
      expect(verifySolution(scrambled, p.solution as MoveToken[]).ok, `preset ${p.index} solution`).toBe(true);
    }
  });
});

describe('move-presentation parseMove', () => {
  it('equals legacy parseMove for all 18 tokens', () => {
    for (const t of ALL_TOKENS) expect(parseMove(t), t).toEqual(legacyParseMove(t as MoveNotation));
  });
  it('matches golden parsedMoves', () => {
    for (const t of ALL_TOKENS) {
      const d = parseMove(t);
      expect(
        { face: d.face, axis: d.axis, layer: d.layer, angleRad: d.angle, turns: d.turns, clockwise: d.clockwise },
        t,
      ).toEqual((golden.parsedMoves as Record<string, unknown>)[t]);
    }
  });
});
