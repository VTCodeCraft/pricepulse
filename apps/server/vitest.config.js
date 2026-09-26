import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // db.test.js and api.test.js share one test database, so test files run one after another.
    fileParallelism: false,
  },
});
