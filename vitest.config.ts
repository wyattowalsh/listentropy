import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export const DEFAULT_VITEST_TEST_EXCLUDE = ['tests/e2e/**', 'node_modules/**', 'dist/**', '.worktrees/**'] as const
const PERF_LARGE_FIXTURE_BENCHMARK_TEST = 'src/lib/perf-large-fixture.test.ts' as const

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    minWorkers: 1,
    maxWorkers: '50%',
    exclude: [...DEFAULT_VITEST_TEST_EXCLUDE, PERF_LARGE_FIXTURE_BENCHMARK_TEST],
    testTimeout: 30_000,
    coverage: {
      reporter: ['text', 'lcov', 'json-summary'],
      all: true,
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/types.ts'],
      thresholds: {
        lines: 80,
        branches: 70,
      },
    },
  },
})
