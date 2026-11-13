import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'test/**/*.spec.ts',
      'test/**/*.int-spec.ts',
      'test/**/*.e2e-spec.ts',
      'src/**/*.spec.ts',
    ],
    fileParallelism: false,
  },
});
