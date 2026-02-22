# Test Execution Framework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `@sentinel/runner` — a test execution engine that runs generated tests via child process workers, captures failure artifacts, produces JSON/JUnit/HTML reports, and tracks trends in SQLite.

**Architecture:** Layered pipeline — config/loader → scheduler → child process workers → reporters → trend store. Each layer is independently testable. Child processes provide crash isolation for parallel execution.

**Tech Stack:** TypeScript (strict), Vitest, better-sqlite3, child_process.fork, @sentinel/browser BrowserEngine

**Design doc:** `docs/plans/2026-02-21-execution-framework-design.md`

**Stories:** #55 (CLI entry), #56 (parallel), #57 (failure reports), #58 (report export), #59 (trends), #60 (retries)

---

## Layer 1: Package Scaffolding + Domain Types (Sequential)

### Task 1: Scaffold @sentinel/runner Package

**Files:**

- Create: `packages/runner/package.json`
- Create: `packages/runner/tsconfig.json`
- Create: `packages/runner/vitest.config.ts`
- Create: `packages/runner/src/index.ts`
- Create: `packages/runner/src/types.ts`
- Modify: `tsconfig.build.json` (add runner reference)
- Modify: `tsconfig.json` (add runner path alias)
- Modify: `vitest.config.ts` (add runner alias + project)

**Step 1: Create package.json**

```json
{
  "name": "@sentinel/runner",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc --build",
    "clean": "tsc --build --clean",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@sentinel/shared": "workspace:*",
    "@sentinel/browser": "workspace:*",
    "@sentinel/generator": "workspace:*",
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }, { "path": "../browser" }, { "path": "../generator" }]
}
```

**Step 3: Create vitest.config.ts**

Follow the pattern from `packages/generator/vitest.config.ts`. Include alias for `@sentinel/runner` pointing to own source.

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: '@sentinel/runner',
    environment: 'node',
    reporters: ['default', ['junit', { outputFile: './test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/__tests__/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@sentinel/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@sentinel/browser': resolve(__dirname, '../browser/src/index.ts'),
      '@sentinel/analysis': resolve(__dirname, '../analysis/src/index.ts'),
      '@sentinel/discovery': resolve(__dirname, '../discovery/src/index.ts'),
      '@sentinel/generator': resolve(__dirname, '../generator/src/index.ts'),
      '@sentinel/runner': resolve(__dirname, './src/index.ts'),
    },
  },
});
```

**Step 4: Create stub `src/index.ts`**

```typescript
/**
 * @sentinel/runner
 *
 * Test execution engine for the Sentinel QA platform.
 * Runs generated tests, captures results, and produces reports.
 */

export { RUNNER_VERSION } from './types.js';
```

**Step 5: Register in root configs**

Add to `tsconfig.build.json` references array (after generator, before cli):

```json
{ "path": "./packages/runner" }
```

Add to `tsconfig.json` paths:

```json
"@sentinel/runner": ["./packages/runner/src/index.ts"]
```

Add to `vitest.config.ts`:

- Add `'@sentinel/runner': resolve(root, 'packages/runner/src/index.ts')` to aliases
- Add project entry:

```typescript
{
  extends: true,
  test: {
    name: '@sentinel/runner',
    include: ['packages/runner/src/**/*.test.ts'],
  },
}
```

**Step 6: Install dependencies**

Run: `pnpm install`
Expected: Resolves workspace dependencies, installs better-sqlite3

**Step 7: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 8: Commit**

```
feat(runner): scaffold @sentinel/runner package (#7)
```

---

### Task 2: Domain Types

**Files:**

- Create: `packages/runner/src/types.ts`
- Create: `packages/runner/src/__tests__/types.test.ts`

**Step 1: Write `types.ts`**

All domain types from the design doc. Import `BrowserType` from `@sentinel/shared` and `AssertionType` from `@sentinel/generator`.

```typescript
import type { BrowserType } from '@sentinel/shared';
import type { AssertionType } from '@sentinel/generator';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const RUNNER_VERSION = '0.1.0' as const;

export type ReportFormat = 'json' | 'junit' | 'html';

export interface RunnerConfig {
  readonly outputDir: string;
  readonly workers: number;
  readonly retries: number;
  readonly headless: boolean;
  readonly browserType: BrowserType;
  readonly timeout: number;
  readonly reportFormats: readonly ReportFormat[];
  readonly trendDbPath: string;
  readonly baseUrl?: string | undefined;
}

// ---------------------------------------------------------------------------
// Execution results
// ---------------------------------------------------------------------------

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'passed-with-retry';

export interface FailedRequest {
  readonly url: string;
  readonly method: string;
  readonly status: number;
}

export interface AssertionFailure {
  readonly expected: string;
  readonly actual: string;
  readonly selector: string;
  readonly assertionType: AssertionType;
}

export interface TestError {
  readonly message: string;
  readonly stack: string;
  readonly assertionDetails?: AssertionFailure | undefined;
  readonly consoleErrors: readonly string[];
  readonly failedNetworkRequests: readonly FailedRequest[];
}

export interface TestArtifacts {
  readonly screenshotPath?: string | undefined;
  readonly logPath?: string | undefined;
  readonly artifactDir: string;
}

export interface TestResult {
  readonly testId: string;
  readonly testName: string;
  readonly suite: string;
  readonly status: TestStatus;
  readonly duration: number;
  readonly retryCount: number;
  readonly error?: TestError | undefined;
  readonly artifacts: TestArtifacts;
}

export interface RunSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly passedWithRetry: number;
  readonly duration: number;
}

export interface RunResult {
  readonly runId: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly config: RunnerConfig;
  readonly results: readonly TestResult[];
  readonly summary: RunSummary;
}

// ---------------------------------------------------------------------------
// Worker IPC messages
// ---------------------------------------------------------------------------

import type { TestCase } from '@sentinel/generator';

export type WorkerMessage =
  | { readonly type: 'execute'; readonly testCase: TestCase; readonly config: RunnerConfig }
  | { readonly type: 'result'; readonly result: TestResult }
  | { readonly type: 'error'; readonly error: string };

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export interface TrendEntry {
  readonly runId: string;
  readonly timestamp: number;
  readonly testId: string;
  readonly status: TestStatus;
  readonly duration: number;
}

export interface TrendReport {
  readonly testId: string;
  readonly testName: string;
  readonly suite: string;
  readonly passRate: number;
  readonly avgDuration: number;
  readonly isFlaky: boolean;
  readonly runCount: number;
}

// ---------------------------------------------------------------------------
// Reporter interface
// ---------------------------------------------------------------------------

export interface Reporter {
  readonly format: ReportFormat;
  write(result: RunResult, outputDir: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type RunnerErrorCode =
  | 'INVALID_CONFIG'
  | 'TARGET_UNREACHABLE'
  | 'NO_TESTS_FOUND'
  | 'WORKER_CRASH'
  | 'TIMEOUT';

export interface RunnerError {
  readonly code: RunnerErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
```

**Step 2: Write the type structural tests**

Follow the pattern from `packages/generator/src/__tests__/types.test.ts`. Verify shapes are assignable.

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type {
  RunnerConfig,
  TestResult,
  TestError,
  RunResult,
  RunSummary,
  WorkerMessage,
  TrendEntry,
  TrendReport,
  Reporter,
  RunnerError,
  TestStatus,
  ReportFormat,
} from '@sentinel/runner';

describe('Runner types', () => {
  it('RunnerConfig has required fields', () => {
    expectTypeOf<RunnerConfig>().toHaveProperty('outputDir');
    expectTypeOf<RunnerConfig>().toHaveProperty('workers');
    expectTypeOf<RunnerConfig>().toHaveProperty('retries');
    expectTypeOf<RunnerConfig>().toHaveProperty('headless');
    expectTypeOf<RunnerConfig>().toHaveProperty('browserType');
    expectTypeOf<RunnerConfig>().toHaveProperty('timeout');
    expectTypeOf<RunnerConfig>().toHaveProperty('reportFormats');
    expectTypeOf<RunnerConfig>().toHaveProperty('trendDbPath');
  });

  it('TestResult has required fields', () => {
    expectTypeOf<TestResult>().toHaveProperty('testId');
    expectTypeOf<TestResult>().toHaveProperty('status');
    expectTypeOf<TestResult>().toHaveProperty('duration');
    expectTypeOf<TestResult>().toHaveProperty('retryCount');
    expectTypeOf<TestResult>().toHaveProperty('artifacts');
  });

  it('TestStatus is a union of known statuses', () => {
    expectTypeOf<'passed'>().toMatchTypeOf<TestStatus>();
    expectTypeOf<'failed'>().toMatchTypeOf<TestStatus>();
    expectTypeOf<'skipped'>().toMatchTypeOf<TestStatus>();
    expectTypeOf<'passed-with-retry'>().toMatchTypeOf<TestStatus>();
  });

  it('ReportFormat is a union of known formats', () => {
    expectTypeOf<'json'>().toMatchTypeOf<ReportFormat>();
    expectTypeOf<'junit'>().toMatchTypeOf<ReportFormat>();
    expectTypeOf<'html'>().toMatchTypeOf<ReportFormat>();
  });

  it('RunResult contains results array and summary', () => {
    expectTypeOf<RunResult>().toHaveProperty('runId');
    expectTypeOf<RunResult>().toHaveProperty('results');
    expectTypeOf<RunResult>().toHaveProperty('summary');
  });

  it('WorkerMessage is a discriminated union on type', () => {
    expectTypeOf<WorkerMessage>().toMatchTypeOf<{ readonly type: string }>();
  });

  it('Reporter interface has format and write', () => {
    expectTypeOf<Reporter>().toHaveProperty('format');
    expectTypeOf<Reporter>().toHaveProperty('write');
  });

  it('RunnerError has code and message', () => {
    expectTypeOf<RunnerError>().toHaveProperty('code');
    expectTypeOf<RunnerError>().toHaveProperty('message');
  });

  it('TrendReport has flaky detection field', () => {
    expectTypeOf<TrendReport>().toHaveProperty('isFlaky');
    expectTypeOf<TrendReport>().toHaveProperty('passRate');
  });
});
```

**Step 3: Run tests**

Run: `pnpm exec vitest run --project @sentinel/runner`
Expected: All type tests pass

**Step 4: Update barrel exports in `src/index.ts`**

Export all types from `types.ts`.

**Step 5: Commit**

```
feat(runner): add domain types (#7)
```

---

## Layer 2: Independent Modules (Parallel)

All tasks in this layer depend only on types and can be implemented in parallel.

### Task 3: Config Module

**Files:**

- Create: `packages/runner/src/config/config.ts`
- Create: `packages/runner/src/config/index.ts`
- Create: `packages/runner/src/__tests__/config.test.ts`

**Step 1: Write failing tests**

Test `loadRunnerConfig()` returns defaults, overrides work, and `validateRunnerConfig()` catches invalid values.

Key test cases:

- Returns defaults when called with no args (workers=4, retries=2, headless=true, timeout=30000, etc.)
- Overrides individual fields
- Validates workers > 0
- Validates retries >= 0
- Validates timeout > 0
- Validates reportFormats contains only valid formats
- Validates outputDir is non-empty
- Returns null for valid config
- Returns `RunnerError` with `INVALID_CONFIG` for invalid config

Follow exact pattern from `packages/generator/src/__tests__/config.test.ts`.

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/runner`
Expected: FAIL — module not found

**Step 3: Implement `config.ts`**

```typescript
import type { RunnerConfig, RunnerError, ReportFormat } from '../types.js';

const DEFAULTS: RunnerConfig = {
  outputDir: './sentinel-output',
  workers: 4,
  retries: 2,
  headless: true,
  browserType: 'chromium',
  timeout: 30_000,
  reportFormats: ['json', 'junit', 'html'],
  trendDbPath: './sentinel-trends.db',
};

const VALID_REPORT_FORMATS = new Set<ReportFormat>(['json', 'junit', 'html']);
const VALID_BROWSER_TYPES = new Set(['chromium', 'firefox', 'webkit']);

export function validateRunnerConfig(config: RunnerConfig): RunnerError | null {
  const errors: string[] = [];
  if (config.workers <= 0) errors.push('workers must be positive');
  if (config.retries < 0) errors.push('retries must be non-negative');
  if (config.timeout <= 0) errors.push('timeout must be positive');
  if (config.outputDir === '') errors.push('outputDir must be non-empty');
  if (!VALID_BROWSER_TYPES.has(config.browserType)) {
    errors.push(`Invalid browserType: '${config.browserType}'`);
  }
  for (const fmt of config.reportFormats) {
    if (!VALID_REPORT_FORMATS.has(fmt)) {
      errors.push(`Invalid reportFormat: '${fmt}'`);
    }
  }
  if (errors.length > 0) {
    return { code: 'INVALID_CONFIG', message: errors.join('; ') };
  }
  return null;
}

export function loadRunnerConfig(overrides?: Partial<RunnerConfig>): RunnerConfig {
  if (overrides === undefined) return DEFAULTS;
  return {
    outputDir: overrides.outputDir ?? DEFAULTS.outputDir,
    workers: overrides.workers ?? DEFAULTS.workers,
    retries: overrides.retries ?? DEFAULTS.retries,
    headless: overrides.headless ?? DEFAULTS.headless,
    browserType: overrides.browserType ?? DEFAULTS.browserType,
    timeout: overrides.timeout ?? DEFAULTS.timeout,
    reportFormats: overrides.reportFormats ?? DEFAULTS.reportFormats,
    trendDbPath: overrides.trendDbPath ?? DEFAULTS.trendDbPath,
    ...(overrides.baseUrl !== undefined ? { baseUrl: overrides.baseUrl } : {}),
  };
}
```

**Step 4: Create barrel `config/index.ts`**

```typescript
export { loadRunnerConfig, validateRunnerConfig } from './config.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run --project @sentinel/runner`
Expected: PASS

**Step 6: Commit**

```
feat(runner): add config module (#7)
```

---

### Task 4: Loader Module

**Files:**

- Create: `packages/runner/src/loader/loader.ts`
- Create: `packages/runner/src/loader/index.ts`
- Create: `packages/runner/src/__tests__/loader.test.ts`

**Step 1: Write failing tests**

Test `loadTestSuites()` which reads JSON test files from a directory and parses them into `TestSuite[]`.

Key test cases:

- Returns empty array when directory has no JSON files
- Parses a valid JSON file into TestSuite
- Loads multiple JSON files from directory
- Returns `RunnerError` with `NO_TESTS_FOUND` when directory doesn't exist
- Skips non-JSON files in the directory
- Returns `RunnerError` when JSON is malformed

Use `vi.mock('node:fs/promises')` to mock filesystem access.

**Step 2: Run tests to verify they fail**

**Step 3: Implement `loader.ts`**

The loader reads `*.json` files from the generator's output directory, parses each as a `TestSuite` (array of `TestCase`), and returns the aggregated suites.

Import `TestSuite` from `@sentinel/generator`. Use `readdir` and `readFile` from `node:fs/promises`. Validate that the parsed JSON matches the expected shape (has `name`, `fileName`, `testCases` array).

**Step 4: Create barrel `loader/index.ts`**

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```
feat(runner): add test suite loader (#7)
```

---

### Task 5: Work Queue

**Files:**

- Create: `packages/runner/src/scheduler/work-queue.ts`
- Create: `packages/runner/src/__tests__/work-queue.test.ts`

**Step 1: Write failing tests**

Test `WorkQueue` class:

- `enqueue()` adds items
- `dequeue()` returns items in FIFO order
- `size` returns current queue length
- `isEmpty` returns true when empty
- `requeue()` adds an item back to the front (for retries)
- Handles enqueueing entire suites, flattening to individual test cases
- Preserves suite ordering for tests within the same suite

**Step 2: Run tests to verify they fail**

**Step 3: Implement `work-queue.ts`**

Simple queue backed by an array. `enqueue` pushes to the end, `dequeue` shifts from the front, `requeue` unshifts to the front.

```typescript
import type { TestCase } from '@sentinel/generator';

export class WorkQueue {
  private readonly items: TestCase[] = [];

  enqueue(testCase: TestCase): void {
    this.items.push(testCase);
  }

  enqueueSuite(testCases: readonly TestCase[]): void {
    for (const tc of testCases) {
      this.items.push(tc);
    }
  }

  dequeue(): TestCase | undefined {
    return this.items.shift();
  }

  requeue(testCase: TestCase): void {
    this.items.unshift(testCase);
  }

  get size(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }
}
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
feat(runner): add work queue (#7)
```

---

### Task 6: Artifact Collector

**Files:**

- Create: `packages/runner/src/worker/artifact-collector.ts`
- Create: `packages/runner/src/__tests__/artifact-collector.test.ts`

**Step 1: Write failing tests**

Test `ArtifactCollector`:

- `captureScreenshot()` calls `engine.screenshot()` and writes to per-test artifact dir
- `captureConsoleLogs()` writes console errors to a log file
- `captureNetworkErrors()` filters and returns 4xx/5xx requests
- `createArtifactDir()` creates the per-test subdirectory
- Returns `TestArtifacts` with correct paths

Mock `BrowserEngine`, mock `node:fs/promises`.

**Step 2: Run tests to verify they fail**

**Step 3: Implement `artifact-collector.ts`**

The collector takes a `BrowserEngine`, `PageHandle`, and test metadata. It:

- Creates `<outputDir>/<suiteName>/<testId>/` directory
- Captures a screenshot via `engine.screenshot()` and writes it to the artifact dir
- Writes console errors to `console.log` in the artifact dir
- Returns `TestArtifacts` with the paths

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
feat(runner): add artifact collector (#7)
```

---

### Task 7: JSON Reporter

**Files:**

- Create: `packages/runner/src/reporter/json-reporter.ts`
- Create: `packages/runner/src/__tests__/json-reporter.test.ts`

**Step 1: Write failing tests**

Test `JsonReporter`:

- Implements `Reporter` interface with `format: 'json'`
- `write()` creates `sentinel-report.json` in outputDir
- JSON content includes schema version field (`"schemaVersion": "1.0"`)
- JSON content includes `runId`, `startedAt`, `completedAt`, `summary`, `results`
- Returns the file path

Mock `node:fs/promises`.

**Step 2: Run tests to verify they fail**

**Step 3: Implement `json-reporter.ts`**

```typescript
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Reporter, RunResult } from '../types.js';

export class JsonReporter implements Reporter {
  readonly format = 'json' as const;

  async write(result: RunResult, outputDir: string): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const filePath = join(outputDir, 'sentinel-report.json');
    const report = {
      schemaVersion: '1.0',
      ...result,
    };
    await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    return filePath;
  }
}
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
feat(runner): add JSON reporter (#7)
```

---

### Task 8: JUnit Reporter

**Files:**

- Create: `packages/runner/src/reporter/junit-reporter.ts`
- Create: `packages/runner/src/__tests__/junit-reporter.test.ts`

**Step 1: Write failing tests**

Test `JunitReporter`:

- Implements `Reporter` with `format: 'junit'`
- `write()` creates `sentinel-report.xml` in outputDir
- XML contains `<testsuites>` root with `<testsuite>` per suite
- Each test is a `<testcase>` with `name`, `classname`, `time` attributes
- Failed tests have `<failure>` child with message and stack trace
- Skipped tests have `<skipped>` child
- XML is well-formed (parse with a simple regex check or string match for key elements)

**Step 2: Run tests to verify they fail**

**Step 3: Implement `junit-reporter.ts`**

Build XML string using template literals. Escape XML special characters (`<`, `>`, `&`, `"`, `'`). Group results by suite name.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
feat(runner): add JUnit XML reporter (#7)
```

---

### Task 9: HTML Reporter

**Files:**

- Create: `packages/runner/src/reporter/html-reporter.ts`
- Create: `packages/runner/src/__tests__/html-reporter.test.ts`

**Step 1: Write failing tests**

Test `HtmlReporter`:

- Implements `Reporter` with `format: 'html'`
- `write()` creates `sentinel-report.html` in outputDir
- HTML is self-contained (inline CSS, no external deps)
- Contains pass/fail summary counts
- Contains a table row per test with name, status, duration
- Failed tests show error message
- Returns file path

**Step 2: Run tests to verify they fail**

**Step 3: Implement `html-reporter.ts`**

Build HTML string with template literals. Include inline CSS for styling. Summary bar at top showing pass/fail/skip counts. Table with test results.

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
feat(runner): add HTML reporter (#7)
```

---

### Task 10: Reporter Barrel

**Files:**

- Create: `packages/runner/src/reporter/reporter.ts` (convenience re-export of Reporter type)
- Create: `packages/runner/src/reporter/index.ts`

**Step 1: Create barrel export**

```typescript
export { JsonReporter } from './json-reporter.js';
export { JunitReporter } from './junit-reporter.js';
export { HtmlReporter } from './html-reporter.js';
```

**Step 2: Commit**

```
feat(runner): add reporter barrel exports (#7)
```

---

### Task 11: Trend Store — Schema & Migrations

**Files:**

- Create: `packages/runner/src/trends/migrations.ts`
- Create: `packages/runner/src/trends/trend-store.ts`
- Create: `packages/runner/src/trends/index.ts`
- Create: `packages/runner/src/__tests__/trend-store.test.ts`

**Step 1: Write failing tests**

Test `TrendStore`:

- `constructor` creates tables if they don't exist (use in-memory SQLite `:memory:`)
- `persistRun()` inserts a run and its test results
- `getTrends()` returns `TrendReport[]` for all tests
- `getTrend(testId)` returns `TrendReport` for a specific test
- Flaky detection: test that fails in 3 of 10 runs is `isFlaky: true`
- Flaky detection: test that fails in 1 of 10 runs is `isFlaky: false`
- Flaky detection: test that fails in 9 of 10 runs is `isFlaky: false`
- `getRunHistory(limit)` returns the last N runs
- `exportCsv()` returns CSV string with correct headers and data

**Step 2: Run tests to verify they fail**

**Step 3: Implement `migrations.ts`**

```typescript
import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      total INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      failed INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(run_id),
      test_id TEXT NOT NULL,
      test_name TEXT NOT NULL,
      suite TEXT NOT NULL,
      status TEXT NOT NULL,
      duration INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id);
  `);
}
```

**Step 4: Implement `trend-store.ts`**

The TrendStore class wraps better-sqlite3. Constructor opens the DB and runs migrations. Methods: `persistRun(RunResult)`, `getTrends(limit)`, `getTrend(testId, limit)`, `getRunHistory(limit)`, `exportCsv()`, `close()`.

Flaky detection: a test is flaky if its failure rate across the last N runs is >20% and <80%.

**Step 5: Create barrel `trends/index.ts`**

**Step 6: Run tests, verify pass**

**Step 7: Commit**

```
feat(runner): add SQLite trend store with flaky detection (#7)
```

---

## Layer 3: Modules Depending on Layer 2 (Sequential)

### Task 12: Test Executor

**Files:**

- Create: `packages/runner/src/worker/test-executor.ts`
- Create: `packages/runner/src/__tests__/test-executor.test.ts`

**Step 1: Write failing tests**

Test `executeTest()`:

- Navigates to baseUrl if provided
- Executes setup steps, then test steps, then teardown steps
- Maps `click` action to `engine.click()`
- Maps `form-submit` action to `engine.click()` (submit button)
- Maps `navigation` action to `engine.navigate()`
- Evaluates assertions: `visibility` checks `waitForSelector`, `text-content` checks `evaluate`
- Returns `TestResult` with `status: 'passed'` when all steps succeed
- Returns `TestResult` with `status: 'failed'` and `TestError` when an assertion fails
- Captures artifacts on failure via `ArtifactCollector`
- Respects timeout config

Mock `BrowserEngine` and `ArtifactCollector`.

**Step 2: Run tests to verify they fail**

**Step 3: Implement `test-executor.ts`**

The executor takes a `TestCase`, `RunnerConfig`, `BrowserEngine`, `BrowserContextHandle`, `PageHandle`, and `ArtifactCollector`. It iterates through all steps, calling the appropriate engine methods, evaluating assertions, and capturing artifacts on failure.

Key function signature:

```typescript
import type { TestCase } from '@sentinel/generator';
import type { BrowserEngine, BrowserContextHandle, PageHandle } from '@sentinel/browser';
import type { RunnerConfig, TestResult, FailedRequest } from '../types.js';
import type { ArtifactCollector } from './artifact-collector.js';

export async function executeTest(
  testCase: TestCase,
  config: RunnerConfig,
  engine: BrowserEngine,
  contextHandle: BrowserContextHandle,
  pageHandle: PageHandle,
  artifactCollector: ArtifactCollector,
  consoleErrors: string[],
  failedRequests: FailedRequest[],
): Promise<TestResult>;
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```
feat(runner): add test executor (#7)
```

---

### Task 13: Worker Process

**Files:**

- Create: `packages/runner/src/worker/worker-process.ts`
- Create: `packages/runner/src/worker/index.ts`
- Create: `packages/runner/src/__tests__/worker-process.test.ts`

**Step 1: Write failing tests**

Test `handleWorkerMessage()` (the function that processes IPC messages in the child process):

- On `{ type: 'execute' }` message: launches engine, creates context/page, sets up interceptors, calls `executeTest()`, sends result back
- On engine launch failure: sends `{ type: 'error' }` message back
- Captures console errors via response interceptor
- Captures 4xx/5xx network requests
- Closes context and page after test completes

Mock `PlaywrightBrowserEngine` from `@sentinel/browser`, mock `process.send`.

**Step 2: Run tests to verify they fail**

**Step 3: Implement `worker-process.ts`**

This is the child process entry point. It listens for IPC messages from the parent, processes them, and sends results back.

The file exports a `handleWorkerMessage()` function for testability, and has a top-level `process.on('message', ...)` listener that calls it.

**Step 4: Create barrel `worker/index.ts`**

Export `executeTest` and `ArtifactCollector` (not `worker-process.ts` — that's a standalone entry point).

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```
feat(runner): add worker process (#7)
```

---

## Layer 4: Scheduler (Depends on Layer 3)

### Task 14: Scheduler

**Files:**

- Create: `packages/runner/src/scheduler/scheduler.ts`
- Create: `packages/runner/src/scheduler/index.ts`
- Create: `packages/runner/src/__tests__/scheduler.test.ts`

**Step 1: Write failing tests**

Test `Scheduler`:

- `constructor(config)` sets the number of workers from config
- `enqueue(suites)` adds all test cases to the work queue
- `execute()` forks child processes and distributes work
- Sends `{ type: 'execute' }` messages to workers via IPC
- Collects `{ type: 'result' }` messages from workers
- On worker crash (process exit): re-queues the test, forks a replacement worker
- On test failure with retries remaining: re-enqueues with incremented attempt count
- On test failure after max retries: keeps the result as failed
- Test that passes on retry gets `status: 'passed-with-retry'`
- `execute()` resolves with all `TestResult[]` after queue is drained

Mock `child_process.fork` to return mock `ChildProcess` objects with simulated IPC. Use `vi.mock('node:child_process')`.

**Step 2: Run tests to verify they fail**

**Step 3: Implement `scheduler.ts`**

The Scheduler:

- Maintains a pool of N child processes forked from `worker-process.ts`
- Uses `WorkQueue` to manage test case distribution
- Tracks which worker is processing which test (Map of pid → TestCase)
- Listens for IPC `message` events and process `exit` events
- Implements retry logic: on failure, check if attempt count < config.retries, if so re-enqueue
- Returns a Promise that resolves with all results when the queue is drained and all workers idle

```typescript
import { fork } from 'node:child_process';
import type { TestSuite } from '@sentinel/generator';
import type { RunnerConfig, TestResult } from '../types.js';
import { WorkQueue } from './work-queue.js';

export class Scheduler {
  // ...
}
```

**Step 4: Create barrel `scheduler/index.ts`**

```typescript
export { Scheduler } from './scheduler.js';
export { WorkQueue } from './work-queue.js';
```

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```
feat(runner): add scheduler with parallel execution (#7)
```

---

## Layer 5: Orchestrator + Integration (Sequential)

### Task 15: Run Orchestrator

**Files:**

- Create: `packages/runner/src/orchestrator/run.ts`
- Create: `packages/runner/src/orchestrator/index.ts`
- Create: `packages/runner/src/__tests__/run.test.ts`

**Step 1: Write failing tests**

Test `run()`:

- Returns `RunnerError` with `INVALID_CONFIG` for invalid config
- Returns `RunnerError` with `NO_TESTS_FOUND` when suites are empty
- Executes pipeline: scheduler -> collect results -> build summary -> write reports -> persist trends
- Returns `RunResult` with correct summary counts
- Generates reports for all configured formats
- Persists results to trend store
- `runId` is a UUID
- `startedAt` and `completedAt` are timestamps

Mock `Scheduler`, mock reporters, mock `TrendStore`.

**Step 2: Run tests to verify they fail**

**Step 3: Implement `run.ts`**

The orchestrator:

1. Validates config
2. Checks suites are non-empty
3. Creates Scheduler, enqueues suites, executes
4. Builds RunSummary from results
5. Creates reporters based on config.reportFormats
6. Writes all reports
7. Persists to TrendStore
8. Returns RunResult

**Step 4: Create barrel `orchestrator/index.ts`**

```typescript
export { run } from './run.js';
```

**Step 5: Run tests, verify pass**

**Step 6: Commit**

```
feat(runner): add run orchestrator (#7)
```

---

### Task 16: Final Barrel Exports & Root Config Updates

**Files:**

- Modify: `packages/runner/src/index.ts` (full public API)
- Modify: `CLAUDE.md` (add runner to directory structure)

**Step 1: Update `src/index.ts` with all exports**

```typescript
/**
 * @sentinel/runner
 *
 * Test execution engine for the Sentinel QA platform.
 * Runs generated tests, captures results, and produces reports.
 */

// Types
export type {
  RunnerConfig,
  ReportFormat,
  TestStatus,
  TestResult,
  TestError,
  AssertionFailure,
  FailedRequest,
  TestArtifacts,
  RunResult,
  RunSummary,
  WorkerMessage,
  TrendEntry,
  TrendReport,
  Reporter,
  RunnerErrorCode,
  RunnerError,
} from './types.js';

export { RUNNER_VERSION } from './types.js';

// Config
export { loadRunnerConfig, validateRunnerConfig } from './config/index.js';

// Loader
export { loadTestSuites } from './loader/index.js';

// Reporters
export { JsonReporter } from './reporter/json-reporter.js';
export { JunitReporter } from './reporter/junit-reporter.js';
export { HtmlReporter } from './reporter/html-reporter.js';

// Trends
export { TrendStore } from './trends/index.js';

// Orchestrator
export { run } from './orchestrator/index.js';
```

**Step 2: Update `CLAUDE.md`** — add `runner/` package to the annotated directory structure, following the pattern of other packages.

**Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass across all packages

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 6: Commit**

```
feat(runner): add public API exports and update docs (#7)
```

---

## Parallelization Summary

```
Layer 1 (sequential):  Task 1 -> Task 2
Layer 2 (parallel):    Tasks 3, 4, 5, 6, 7, 8, 9, 10, 11
Layer 3 (sequential):  Task 12 -> Task 13
Layer 4 (sequential):  Task 14
Layer 5 (sequential):  Task 15 -> Task 16
```

Dependencies:

- Layer 2 depends on Layer 1 (needs types and package structure)
- Layer 3 depends on Task 6 (artifact collector) from Layer 2
- Layer 4 depends on Tasks 5 (work queue) and 13 (worker process)
- Layer 5 depends on everything above
