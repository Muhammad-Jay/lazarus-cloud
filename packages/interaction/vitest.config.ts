import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // No DOM environment. If this package ever reaches for `document`,
    // `localStorage` or a timer, the tests must fail to find them rather than
    // pass because jsdom quietly supplied them (ADR-0014).
    environment: 'node',
  },
});
