// Architecture guard: pure layers must not import UI/runtime frameworks or touch DOM globals.
// Passes vacuously for directories that do not exist yet.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '../../src');
const GUARDED = ['engine', 'demo', 'types', 'services'];
const FORBIDDEN_IMPORT =
  /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"](?:react|react-dom|react\/[^'"]*|three|three\/[^'"]*|@react-three\/[^'"]*|zustand|zustand\/[^'"]*|@\/(?:components|features|hooks|stores)(?:\/[^'"]*)?)['"]/;
const DOM_GLOBAL = /(?<![\w.$])(?:window|document|navigator)\./;

function listSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listSources(p);
    return /\.(ts|tsx|js|jsx)$/.test(e.name) ? [p] : [];
  });
}

function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('architecture boundaries', () => {
  it('detects forbidden patterns (guard self-check)', () => {
    expect(FORBIDDEN_IMPORT.test(`import React from 'react';`)).toBe(true);
    expect(FORBIDDEN_IMPORT.test(`import { useStore } from "@/stores/x";`)).toBe(true);
    expect(FORBIDDEN_IMPORT.test(`import * as THREE from 'three';`)).toBe(true);
    expect(FORBIDDEN_IMPORT.test(`import { a } from './local';`)).toBe(false);
    expect(DOM_GLOBAL.test(`window.addEventListener('x', f)`)).toBe(true);
    expect(DOM_GLOBAL.test(`const d = navigator.userAgent`)).toBe(true);
    expect(DOM_GLOBAL.test(`const x = state.document.title`)).toBe(false);
  });

  for (const dir of GUARDED) {
    it(`src/${dir} has no forbidden imports or DOM globals`, () => {
      const root = path.join(SRC, dir);
      if (!fs.existsSync(root)) return;
      const offenders: string[] = [];
      for (const file of listSources(root)) {
        const code = stripComments(fs.readFileSync(file, 'utf8'));
        code.split('\n').forEach((line, i) => {
          if (FORBIDDEN_IMPORT.test(line) || DOM_GLOBAL.test(line)) {
            offenders.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim()}`);
          }
        });
      }
      expect(offenders).toEqual([]);
    });
  }
});
