import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@lazarus/config/vitest';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['test/**/*.test.ts'],
    },
  }),
);
