# Test Execution Framework Design (#7)

## Overview

The `@sentinel/runner` package implements a test execution runtime that runs generated tests, captures results, and produces actionable reports. It sits between the generator (which produces `TestCase`/`TestSuite` structures) and the browser engine (which drives Playwright).

**Architecture**: Layered pipeline with child process workers for parallel execution.

## Design Decisions

| Decision       | Choice                                                 | Rationale                                                             |
| -------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| Execution mode | Interpret `TestCase` JSON directly via `BrowserEngine` | Full control over retries, failure capture, and reporting             |
| Parallelism    | Child processes (`child_process.fork`)                 | Crash isolation, independent restart, true process boundaries         |
| Persistence    | SQLite via `better-sqlite3`                            | Proper querying, concurrent access, schema as specified in #59        |
| HTML reports   | String-based template literals                         | No extra dependency, report is simple enough                          |
| Package name   | `@sentinel/runner`                                     | Matches `sentinel run` CLI command, consistent with other short names |

## Package Structure

```
packages/runner/src/
├── index.ts                  # Public API barrel
├── types.ts                  # All runner domain types
├── config/
│   ├── config.ts             # loadRunnerConfig(), validateRunnerConfig()
│   └── index.ts
├── loader/
│   ├── loader.ts             # loadTestSuites() — reads generator JSON output
│   └── index.ts
├── scheduler/
│   ├── scheduler.ts          # Scheduler — distributes tests to workers, manages queue
│   ├── work-queue.ts         # WorkQueue — ordering with suite dependency awareness
│   └── index.ts
├── worker/
│   ├── worker-process.ts     # Child process entry point — receives test, returns result
│   ├── test-executor.ts      # executeTest() — interprets TestStep via BrowserEngine
│   ├── artifact-collector.ts # Captures screenshots, console logs, network errors
│   └── index.ts
├── reporter/
│   ├── reporter.ts           # Reporter interface
│   ├── json-reporter.ts      # JSON report (versioned schema v1)
│   ├── junit-reporter.ts     # JUnit XML output
│   ├── html-reporter.ts      # Visual HTML summary (self-contained, inline CSS)
│   └── index.ts
├── trends/
│   ├── trend-store.ts        # TrendStore — SQLite persistence, flaky detection
│   ├── migrations.ts         # Schema creation/migration
│   └── index.ts
└── __tests__/
```

## Dependency Graph

```
shared → browser → runner → cli
              ↑        ↑
          analysis   generator
              ↑        ↑
          discovery ───┘
```

Dependencies: `@sentinel/shared`, `@sentinel/browser`, `@sentinel/generator`, `better-sqlite3`

## Domain Types

### Configuration

```typescript
interface RunnerConfig {
  readonly outputDir: string;
  readonly workers: number; // default: 4
  readonly retries: number; // default: 2
  readonly headless: boolean;
  readonly browserType: BrowserType;
  readonly timeout: number; // per-test timeout in ms, default: 30000
  readonly reportFormats: readonly ReportFormat[];
  readonly trendDbPath: string;
  readonly baseUrl?: string;
}

type ReportFormat = 'json' | 'junit' | 'html';
```

### Execution Results

```typescript
type TestStatus = 'passed' | 'failed' | 'skipped' | 'passed-with-retry';

interface TestResult {
  readonly testId: string;
  readonly testName: string;
  readonly suite: string;
  readonly status: TestStatus;
  readonly duration: number;
  readonly retryCount: number;
  readonly error?: TestError;
  readonly artifacts: TestArtifacts;
}

interface TestError {
  readonly message: string;
  readonly stack: string;
  readonly assertionDetails?: AssertionFailure;
  readonly consoleErrors: readonly string[];
  readonly failedNetworkRequests: readonly FailedRequest[];
}

interface AssertionFailure {
  readonly expected: string;
  readonly actual: string;
  readonly selector: string;
  readonly assertionType: AssertionType;
}

interface FailedRequest {
  readonly url: string;
  readonly method: string;
  readonly status: number;
}

interface TestArtifacts {
  readonly screenshotPath?: string;
  readonly logPath?: string;
  readonly artifactDir: string;
}

interface RunResult {
  readonly runId: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly config: RunnerConfig;
  readonly results: readonly TestResult[];
  readonly summary: RunSummary;
}

interface RunSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly passedWithRetry: number;
  readonly duration: number;
}
```

### Worker IPC

```typescript
type WorkerMessage =
  | { type: 'execute'; testCase: TestCase; config: RunnerConfig }
  | { type: 'result'; result: TestResult }
  | { type: 'error'; error: string };
```

### Trends

```typescript
interface TrendEntry {
  readonly runId: string;
  readonly timestamp: number;
  readonly testId: string;
  readonly status: TestStatus;
  readonly duration: number;
}

interface TrendReport {
  readonly testId: string;
  readonly passRate: number;
  readonly avgDuration: number;
  readonly isFlaky: boolean;
  readonly runCount: number;
}
```

### Errors

```typescript
type RunnerErrorCode =
  | 'INVALID_CONFIG'
  | 'TARGET_UNREACHABLE'
  | 'NO_TESTS_FOUND'
  | 'WORKER_CRASH'
  | 'TIMEOUT';

interface RunnerError {
  readonly code: RunnerErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
```

## Execution Flow

```
run(suites, config)
  1. validateRunnerConfig(config)
  2. validateTargetReachable(config.baseUrl)
  3. scheduler = new Scheduler(config.workers)
  4. scheduler.enqueue(suites)
  5. scheduler.execute()
     ├── Worker 1: executeTest(case) → TestResult
     ├── Worker 2: executeTest(case) → TestResult
     └── Worker N: ...
  6. results = scheduler.collect()
  7. runResult = buildRunResult(results)
  8. reporters.forEach(r => r.write(runResult))
  9. trendStore.persist(runResult)
  10. return runResult
```

### Worker Lifecycle

Each worker is a child process that:

1. Receives `{ type: 'execute', testCase, config }` via IPC
2. Launches `BrowserEngine` (headless per config)
3. Creates an isolated `BrowserContext`
4. Creates a `Page`
5. Sets up network interception (captures 4xx/5xx requests)
6. Sets up console log capture
7. Iterates through `testCase.setupSteps`, `steps`, and `teardownSteps`:
   - Maps `step.action` to a `BrowserEngine` method (click, type, navigate)
   - Executes the action with `step.selector`
   - Evaluates `step.assertions` against page state
   - On assertion failure: captures screenshot, collects logs, sends error result
8. On success: sends `{ type: 'result', result }` via IPC
9. Closes context and page (engine stays alive for subsequent tests)

### Retry Logic

- On test failure, the scheduler re-enqueues the test (up to `config.retries` times)
- Each retry uses a fresh `BrowserContext`
- If passed on retry: status = `'passed-with-retry'`
- If all retries fail: last failure's artifacts are preserved

### Worker Crash Recovery

- The scheduler detects unexpected process exits via the `'exit'` event
- The failed test is re-queued to another worker (counts as one retry attempt)
- A new worker process is forked to replace the crashed one

## Reporting

### Reporter Interface

```typescript
interface Reporter {
  readonly format: ReportFormat;
  write(result: RunResult, outputDir: string): Promise<string>;
}
```

### JSON Reporter

Writes `sentinel-report.json` with versioned schema (v1). Contains the full `RunResult` structure including all test results, artifact paths, and summary. Machine-readable for CI integration.

### JUnit Reporter

Writes `sentinel-report.xml` in standard JUnit XML format. Each `TestSuite` maps to a `<testsuite>`, each `TestCase` to a `<testcase>`. Failures include assertion message and stack trace. Compatible with GitHub Actions, GitLab CI, and Jenkins.

### HTML Reporter

Writes `sentinel-report.html` — self-contained HTML with inline CSS. Displays pass/fail summary bar, test table with status icons, durations, and expandable failure details. No external dependencies.

## Trend Storage

### SQLite Schema

```sql
CREATE TABLE runs (
  run_id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  total INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL
);

CREATE TABLE test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  test_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  suite TEXT NOT NULL,
  status TEXT NOT NULL,
  duration INTEGER NOT NULL
);

CREATE INDEX idx_test_results_test_id ON test_results(test_id);
```

### Flaky Detection

A test is flagged as flaky if it fails in >20% but <80% of its last 10 runs. Computed via SQL query over `test_results` grouped by `test_id`, ordered by `run_id` descending, limited to 10.

### CSV Export

The trend store exposes an `exportCsv()` method that writes columns: `test_id, test_name, suite, pass_rate, avg_duration, is_flaky, run_count`.

## Error Handling

- `RunnerError` typed errors for expected failures (invalid config, unreachable target, no tests)
- Worker crashes caught via process `'exit'` event, tests re-queued
- Per-test timeouts via `AbortController` — exceeding `config.timeout` kills the test
- `BrowserEngine` errors caught within workers and reported as `TestError` with stack trace

## Testing Strategy

- Unit tests per module with mocked dependencies
- `trend-store.test.ts` uses in-memory SQLite
- `scheduler.test.ts` mocks child process forking
- Integration test (`run.test.ts`) verifies full pipeline with mocked `BrowserEngine`
- 80% coverage threshold consistent with all other packages

## Out of Scope

- CLI integration (`sentinel run` command) — belongs in `@sentinel/cli`
- Video recording — not specified in stories
- Remote trend storage (S3) — mentioned in #59 but deferred to future extension
