// Architecture guard: pure layers must not import UI/runtime frameworks or touch DOM globals, and nothing under
// src/ or tests/ may reach the retired legacy engine or bridge store again.
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
    String.raw`|@\/store(?:\/[^'"]*)?` + // the retired store/ directory (now stores/)
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
    return /\.([cm]?[tj]sx?)$/.test(e.name) ? [p] : [];
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

const TESTS = path.resolve(import.meta.dirname, '..');
/** Any quoted or template-literal module specifier (import, require, dynamic import, vi.mock), incl. subpaths, naming the retired modules. */
const LEGACY_SPECIFIER = /['"`](?:[^'"`]*\/)?(?:cubeEngine|useRubikStore)(?:\/[^'"`]*)?(?:\.[cm]?[tj]sx?)?['"`]/;

/** Lists files under `roots` that mention a retired module specifier; `exclude` skips this guard's own file. */
function scanLegacy(roots: readonly string[], exclude: readonly string[] = []): string[] {
  const skip = new Set(exclude.map((f) => path.resolve(f)));
  const offenders: string[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const file of listSources(root)) {
      if (skip.has(path.resolve(file))) continue;
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (LEGACY_SPECIFIER.test(line)) offenders.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
        });
    }
  }
  return offenders;
}

// stores/ and hooks/ sit below the UI: they must not import features/ or components/ (absolute or relative).
// Deliberately NOT forbidden: stores importing hooks (demo-session legitimately uses hooks/useSolveSession runSolve).
const UP_LAYERS = ['stores', 'hooks'];
const UI_IMPORT = /['"`](?:@\/|(?:\.\.?\/)+)(?:features|components)(?:\/[^'"`]*)?['"`]/;
// The pure (React-free) scan machine lives in features/scanner; useLiveScan is its only hook consumer.
const PURE_FEATURE_IMPORT = /['"`]@\/features\/scanner\/live-scan-machine['"`]/;

function scanUpward(srcRoot: string, layers: readonly string[] = UP_LAYERS): string[] {
  const offenders: string[] = [];
  for (const dir of layers) {
    const root = path.join(srcRoot, dir);
    if (!fs.existsSync(root)) continue;
    for (const file of listSources(root)) {
      stripComments(fs.readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          if (UI_IMPORT.test(line) && !(file.endsWith('useLiveScan.ts') && PURE_FEATURE_IMPORT.test(line))) offenders.push(`${path.relative(srcRoot, file)}:${i + 1}: ${line.trim()}`);
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

  it('legacy-module guard recognises every import spelling (self-check)', () => {
    for (const bad of [
      `import { a } from '@/lib/cubeEngine';`,
      `import { b } from "@/store/useRubikStore";`,
      `import { c } from '../lib/cubeEngine';`,
      `import { d } from './cubeEngine.ts';`,
      `const e = await import('../../src/store/useRubikStore');`,
      `vi.mock('@/lib/cubeEngine', () => ({}));`,
      `const f = require("./useRubikStore.js");`,
      `import { g } from '@/lib/cubeEngine/x';`,
      'const h = await import(`../lib/cubeEngine`);',
      `import { i } from './useRubikStore.mts';`,
    ]) {
      expect(LEGACY_SPECIFIER.test(bad), bad).toBe(true);
    }
    for (const ok of [
      `import { a } from '@/engine/move-engine';`,
      `import { b } from '@/stores/demo-session';`,
      `import { c } from './cubeEngineAdapter';`,
      `import { e } from './useRubikStoreHelpers';`,
      `import { d } from '@/lib/colors';`,
    ]) {
      expect(LEGACY_SPECIFIER.test(ok), ok).toBe(false);
    }
  });

  it('scanLegacy() reports offenders in a fixture src/tests tree and honours the exclusion', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-guard-'));
    tmpDirs.push(tmp);
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.mkdirSync(path.join(tmp, 'tests'));
    fs.writeFileSync(path.join(tmp, 'src', 'bad.ts'), `import { x } from '@/lib/cubeEngine';\nexport const ok = 1;\n`);
    fs.writeFileSync(path.join(tmp, 'tests', 'bad.test.ts'), `import { s } from '@/store/useRubikStore';\n`);
    fs.writeFileSync(path.join(tmp, 'tests', 'self.test.ts'), `const p = '@/lib/cubeEngine';\n`);
    fs.writeFileSync(path.join(tmp, 'src', 'good.ts'), `import { y } from '@/stores/session-store';\n`);
    fs.writeFileSync(path.join(tmp, 'src', 'sub.ts'), `import { z } from '@/lib/cubeEngine/x';\n`);
    fs.writeFileSync(path.join(tmp, 'src', 'tpl.ts'), 'const m = await import(`../lib/cubeEngine`);\n');
    fs.writeFileSync(path.join(tmp, 'src', 'esm.mjs'), `import { a } from './useRubikStore.mjs';\n`);
    fs.writeFileSync(path.join(tmp, 'src', 'cjs.cjs'), `const a = require('../store/useRubikStore');\n`);
    fs.writeFileSync(path.join(tmp, 'src', 'ts.mts'), `export { a } from "./cubeEngine.mts";\n`);
    fs.writeFileSync(path.join(tmp, 'tests', 'mock.test.ts'), `vi.mock('@/lib/cubeEngine', () => ({}));\n`);

    const offenders = scanLegacy([path.join(tmp, 'src'), path.join(tmp, 'tests')], [path.join(tmp, 'tests', 'self.test.ts')]);
    const files = offenders.map((o) => o.split(':')[0]).sort();
    expect(files).toEqual(['bad.test.ts', 'bad.ts', 'cjs.cjs', 'esm.mjs', 'mock.test.ts', 'sub.ts', 'tpl.ts', 'ts.mts']);
    expect(offenders.some((o) => o.startsWith('bad.ts:1'))).toBe(true);
    expect(offenders.some((o) => o.startsWith('bad.test.ts:1'))).toBe(true);
  });

  it('no file under src/ or tests/ imports the retired legacy engine or bridge store', () => {
    expect(scanLegacy([SRC, TESTS], [import.meta.filename])).toEqual([]);
  });

  it('upward-import guard recognises UI imports from stores/hooks (self-check)', () => {
    for (const bad of [
      `import { A } from '@/features/scanner/X';`,
      `import { B } from "@/components/Cube";`,
      `import { C } from '../features/a';`,
      `import { D } from '../../components/ui/button';`,
      'const e = await import(`@/components/x`);',
    ]) {
      expect(UI_IMPORT.test(bad), bad).toBe(true);
    }
    for (const ok of [
      `import { a } from '@/hooks/useSolveSession';`,
      `import { b } from '@/stores/cube-store';`,
      `import { c } from './componentsList';`,
      `import { d } from '@/lib/utils';`,
    ]) {
      expect(UI_IMPORT.test(ok), ok).toBe(false);
    }
  });

  it('scanUpward() reports UI imports in a fixture tree and allows stores -> hooks', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'upward-guard-'));
    tmpDirs.push(tmp);
    fs.mkdirSync(path.join(tmp, 'stores'));
    fs.mkdirSync(path.join(tmp, 'hooks'));
    fs.writeFileSync(path.join(tmp, 'stores', 'bad.ts'), `import { A } from '@/features/x';\nexport const a = 1;\n`);
    fs.writeFileSync(path.join(tmp, 'hooks', 'bad.ts'), `import { B } from '../components/y';\n`);
    fs.writeFileSync(path.join(tmp, 'hooks', 'comment.ts'), `// import { C } from '@/components/z';\n`);
    fs.writeFileSync(path.join(tmp, 'stores', 'ok.ts'), `import { run } from '@/hooks/useSolveSession';\n`);
    const offenders = scanUpward(tmp);
    expect(offenders).toHaveLength(2);
    expect(offenders.some((o) => o.includes('bad.ts:1') && o.startsWith('stores'))).toBe(true);
    expect(offenders.some((o) => o.includes('bad.ts:1') && o.startsWith('hooks'))).toBe(true);
  });

  it('Demo code never references the WebSocket scan transport', () => {
    const files = [
      ...listSources(path.join(SRC, 'demo')),
      path.join(SRC, 'features', 'scanner', 'DemoViewport.tsx'),
      path.join(SRC, 'features', 'scanner', 'useDemoScanScript.ts'),
    ].filter((f) => fs.existsSync(f));
    expect(files.length).toBeGreaterThan(3);
    expect(files.filter((f) => fs.readFileSync(f, 'utf8').includes('WebSocketScanTransport'))).toEqual([]);
  });

  for (const dir of UP_LAYERS) {
    it(`src/${dir} does not import features/ or components/`, () => {
      expect(scanUpward(SRC, [dir])).toEqual([]);
    });
  }
});
