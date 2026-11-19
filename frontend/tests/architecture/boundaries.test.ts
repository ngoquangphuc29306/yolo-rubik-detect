// Architecture guard: pure layers must not import UI/runtime frameworks or touch DOM globals.
// Passes vacuously for directories that do not exist yet.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SRC = path.resolve(import.meta.dirname, '../../src');
const GUARDED = ['engine', 'demo', 'types', 'services'];
const UPPER = 'components|features|hooks|stores';
const FORBIDDEN_IMPORT = new RegExp(
  String.raw`(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"](?:react|react-dom|react\/[^'"]*|three|three\/[^'"]*|@react-three\/[^'"]*|zustand|zustand\/[^'"]*` +
    String.raw`|@\/(?:${UPPER})(?:\/[^'"]*)?` +
    String.raw`|@\/store(?:\/[^'"]*)?` + // legacy store path
    String.raw`|(?:\.\.?\/)+(?:${UPPER}|store)(?:\/[^'"]*)?)['"]`,
);
const DOM_GLOBAL = new RegExp(
  String.raw`(?<![\w.$])(?:window|document|navigator|globalThis|self)\.` +
    String.raw`|(?<![\w.$])(?:localStorage|sessionStorage|requestAnimationFrame)\b` +
    String.raw`|typeof\s+window\b`,
);

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

/** Scans every guarded layer under `srcRoot`; returns `layer/file:line: text` offenders. */
function scan(srcRoot: string, layers: readonly string[] = GUARDED): string[] {
  const offenders: string[] = [];
  for (const dir of layers) {
    const root = path.join(srcRoot, dir);
    if (!fs.existsSync(root)) continue;
    for (const file of listSources(root)) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      code.split('\n').forEach((line, i) => {
        if (FORBIDDEN_IMPORT.test(line) || DOM_GLOBAL.test(line)) {
          offenders.push(`${path.relative(srcRoot, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
  return offenders;
}

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('architecture boundaries', () => {
  it('detects forbidden patterns (guard self-check)', () => {
    for (const bad of [
      `import React from 'react';`,
      `import { useStore } from "@/stores/x";`,
      `import * as THREE from 'three';`,
      `import { s } from '@/store/useRubikStore';`,
      `import { s } from '../stores/session-store';`,
      `import { C } from '../../components/Cube';`,
      `import { h } from './hooks/useX';`,
      `const m = await import('../features/a');`,
    ]) {
      expect(FORBIDDEN_IMPORT.test(bad), bad).toBe(true);
    }
    for (const ok of [
      `import { a } from './local';`,
      `import { b } from '../types/cube';`,
      `import { c } from './facelet-geometry';`,
      `import { d } from '@/engine/cube-state';`,
    ]) {
      expect(FORBIDDEN_IMPORT.test(ok), ok).toBe(false);
    }
    for (const bad of [
      `window.addEventListener('x', f)`,
      `const d = navigator.userAgent`,
      `globalThis.foo = 1`,
      `self.postMessage(1)`,
      `localStorage.getItem('k')`,
      `sessionStorage.clear()`,
      `requestAnimationFrame(loop)`,
      `if (typeof window !== 'undefined') {}`,
    ]) {
      expect(DOM_GLOBAL.test(bad), bad).toBe(true);
    }
    for (const ok of [`const x = state.document.title`, `const myself.x = 1`, `const t = this.self.x`]) {
      expect(DOM_GLOBAL.test(ok), ok).toBe(false);
    }
  });

  it('scan() reports violations in a temporary fixture tree', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-guard-'));
    tmpDirs.push(tmp);
    fs.mkdirSync(path.join(tmp, 'engine'));
    fs.mkdirSync(path.join(tmp, 'types'));
    fs.writeFileSync(
      path.join(tmp, 'engine', 'bad.ts'),
      [
        `import { x } from '../stores/session-store';`,
        `export const t = () => requestAnimationFrame(() => {});`,
        `// window.alert('comment only')`,
        `export const ok = 1;`,
      ].join('\n'),
    );
    fs.writeFileSync(path.join(tmp, 'types', 'good.ts'), `export type A = 1;\n`);

    const offenders = scan(tmp);
    expect(offenders).toHaveLength(2);
    expect(offenders[0]).toContain(path.join('engine', 'bad.ts') + ':1');
    expect(offenders[1]).toContain('bad.ts:2');
  });

  for (const dir of GUARDED) {
    it(`src/${dir} has no forbidden imports or DOM globals`, () => {
      expect(scan(SRC, [dir])).toEqual([]);
    });
  }
});
