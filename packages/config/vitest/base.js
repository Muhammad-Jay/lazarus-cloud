import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    isolate: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/vitest.*.ts',
        'tools/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
