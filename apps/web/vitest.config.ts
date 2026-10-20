import { defineConfig, mergeConfig } from 'vitest/config';
import browser from '@lazarus/config/vitest/browser';

export default mergeConfig(
  browser,
  defineConfig({
    test: {
      include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
      setupFiles: ['test/setup.ts'],
    },
  }),
);
