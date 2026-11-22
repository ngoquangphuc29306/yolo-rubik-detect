import {existsSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

const frontend = path.resolve(import.meta.dirname, '..', '..');
const repoRoot = path.resolve(frontend, '..');
const read = (p: string): string => readFileSync(p, 'utf8');

const pkg = JSON.parse(read(path.join(frontend, 'package.json'))) as {
  name: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('package.json', () => {
  it('is named rubikvision-frontend', () => {
    expect(pkg.name).toBe('rubikvision-frontend');
  });

  it('declares none of the verified-unused packages', () => {
    const removed = [
      '@google/genai',
      'dotenv',
      'express',
      '@types/express',
      'motion',
      'tsx',
      'autoprefixer',
    ];
    const declared = {...pkg.dependencies, ...pkg.devDependencies};
    for (const name of removed) {
      expect(declared, name).not.toHaveProperty(name);
    }
  });

  it('serves the dev server on loopback only', () => {
    expect(pkg.scripts.dev).toContain('127.0.0.1');
    expect(pkg.scripts.dev).not.toContain('0.0.0.0');
    expect(pkg.scripts.preview).toContain('127.0.0.1');
  });

  it('has a portable clean script', () => {
    expect(pkg.scripts.clean).toBeTruthy();
    expect(pkg.scripts.clean).not.toContain('rm -rf');
    expect(pkg.scripts.clean).toContain('node');
  });
});

describe('vite config', () => {
  it('binds loopback, proxies the backend and drops AI Studio plugins', async () => {
    const mod = (await import('../../vite.config')) as {default: unknown};
    const raw = mod.default;
    const config = (typeof raw === 'function' ? await raw({command: 'serve', mode: 'development'}) : raw) as {
      plugins: Array<{name?: string} | false | null | Array<{name?: string}>>;
      server: {
        host: string;
        port: number;
        strictPort: boolean;
        hmr?: unknown;
        watch?: unknown;
        proxy: Record<string, string | {target: string; ws?: boolean}>;
      };
    };
    expect(config.server.host).toBe('127.0.0.1');
    expect(config.server.port).toBe(5173);
    expect(config.server.strictPort).toBe(true);
    expect(config.server).not.toHaveProperty('hmr');
    expect(config.server).not.toHaveProperty('watch');
    expect(Object.keys(config.server.proxy).sort()).toEqual(['/api', '/health', '/ws']);
    const ws = config.server.proxy['/ws'] as {target: string; ws?: boolean};
    expect(ws.ws).toBe(true);
    expect(ws.target).toBe('ws://127.0.0.1:8000');
    const names = config.plugins.flat().map((p) => (p ? p.name : undefined));
    expect(names).not.toContain('copy-unbundled-src-assets');
  });
});

describe('static project files', () => {
  it('links an existing small favicon', () => {
    expect(read(path.join(frontend, 'index.html'))).toContain(
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    );
    const icon = path.join(frontend, 'public', 'favicon.svg');
    expect(existsSync(icon)).toBe(true);
    expect(statSync(icon).size).toBeLessThan(2048);
  });

  it('has a README without AI Studio text and with the run commands', () => {
    const readme = read(path.join(repoRoot, 'README.md'));
    expect(readme).not.toMatch(/gemini|ai studio/i);
    for (const cmd of ['npm ci', 'npm run dev', 'npm run test', 'npm run lint', 'npm run build']) {
      expect(readme, cmd).toContain(cmd);
    }
  });

  it('has an .env.example without Gemini keys', () => {
    expect(read(path.join(frontend, '.env.example'))).not.toMatch(/GEMINI/);
  });
});
