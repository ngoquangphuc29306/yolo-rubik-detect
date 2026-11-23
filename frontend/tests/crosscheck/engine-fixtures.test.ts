// Cross-check 1: TypeScript-generated engine fixtures consumed by the independent Python engine.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyMove, parseMoveToken } from '@/engine/move-engine';
import { SOLVED } from '@/engine/cube-state';
import type { FaceletState, MoveToken } from '@/types/cube';

const FIXTURE_PATH = fileURLToPath(new URL('../../../fixtures/engine/move-sequences.json', import.meta.url));
const SCRAMBLE_A_PATH = fileURLToPath(new URL('../../../fixtures/solve/scramble-a.response.json', import.meta.url));
const SEED = 20261122;
const SEQUENCE_COUNT = 40;
const SEQUENCE_LENGTH = 25;
const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const SUFFIXES = ['', "'", '2'] as const;
const ALL_TOKENS: MoveToken[] = FACES.flatMap((f) => SUFFIXES.map((s) => parseMoveToken(`${f}${s}`)));

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

function generate() {
  const rand = mulberry32(SEED);
  const sequences = [];
  for (let n = 0; n < SEQUENCE_COUNT; n++) {
    const moves: MoveToken[] = [];
    let prevFace = '';
    for (let i = 0; i < SEQUENCE_LENGTH; i++) {
      let face: string;
      do {
        face = FACES[Math.floor(rand() * 6)];
      } while (face === prevFace);
      prevFace = face;
      moves.push(parseMoveToken(face + SUFFIXES[Math.floor(rand() * 3)]));
    }
    const states: FaceletState[] = [SOLVED];
    for (const m of moves) states.push(applyMove(states[states.length - 1], m));
    sequences.push({ moves, states });
  }
  const scrambleA = JSON.parse(readFileSync(SCRAMBLE_A_PATH, 'utf-8')).initialState as FaceletState;
  const singleMoves: Record<string, FaceletState> = {};
  for (const t of ALL_TOKENS) singleMoves[t] = applyMove(scrambleA, t);
  return {
    schema: 'engine-move-sequences/1',
    generator: 'frontend/tests/crosscheck/engine-fixtures.test.ts',
    seed: SEED,
    sequences,
    singleMoves,
  };
}

function readJson() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
}

describe('engine move-sequence fixtures', () => {
  it('matches the generated fixture (UPDATE_ENGINE_FIXTURES=1 rewrites it)', () => {
    if (process.env.UPDATE_ENGINE_FIXTURES === '1') {
      writeFileSync(FIXTURE_PATH, JSON.stringify(generate(), null, 2) + '\n', 'utf-8');
    }
    expect(readJson()).toEqual(generate());
  });

  it('exercises all 18 move tokens', () => {
    const seen = new Set<string>(readJson().sequences.flatMap((s: { moves: string[] }) => s.moves));
    expect([...seen].sort()).toEqual([...ALL_TOKENS].sort());
  });
});
