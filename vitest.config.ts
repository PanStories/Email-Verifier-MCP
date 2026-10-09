import { defineConfig } from 'vitest/config';

// Only TS suites run under vitest; tools.contract.test.mjs is a node:test suite
// (run via `node --test`) and must not be picked up here.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
