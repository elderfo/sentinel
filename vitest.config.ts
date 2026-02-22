import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = __dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@sentinel/shared': resolve(root, 'packages/shared/src/index.ts'),
      '@sentinel/core': resolve(root, 'packages/core/src/index.ts'),
      '@sentinel/cli': resolve(root, 'packages/cli/src/index.ts'),
      '@sentinel/web': resolve(root, 'packages/web/src/index.ts'),
      '@sentinel/browser': resolve(root, 'packages/browser/src/index.ts'),
      '@sentinel/analysis': resolve(root, 'packages/analysis/src/index.ts'),
      '@sentinel/discovery': resolve(root, 'packages/discovery/src/index.ts'),
      '@sentinel/generator': resolve(root, 'packages/generator/src/index.ts'),
      '@sentinel/runner': resolve(root, 'packages/runner/src/index.ts'),
    },
  },
  test: {
    reporters: ['default', ['junit', { outputFile: './test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['node_modules', '**/dist/**', '**/*.test.ts', '**/__tests__/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: '@sentinel/shared',
          include: ['packages/shared/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: '@sentinel/core',
          include: ['packages/core/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: '@sentinel/cli',
          include: ['packages/cli/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: '@sentinel/web',
          include: ['packages/web/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: '@sentinel/browser',
          include: ['packages/browser/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: '@sentinel/analysis',
          include: ['packages/analysis/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: '@sentinel/discovery',
          include: ['packages/discovery/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: '@sentinel/generator',
          include: ['packages/generator/src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: '@sentinel/runner',
          include: ['packages/runner/src/**/*.test.ts'],
        },
      },
    ],
  },
});
