import path from 'path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // Component tests opt in per file with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
