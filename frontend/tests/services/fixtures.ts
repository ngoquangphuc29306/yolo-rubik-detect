// Loads the shared repo-root fixtures (the same files the backend will load).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../fixtures');

export function loadFixture<T = unknown>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')) as T;
}
export const fixtureText = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
