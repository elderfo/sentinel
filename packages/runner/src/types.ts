import type { BrowserType } from '@sentinel/shared';
import type { AssertionType, TestCase } from '@sentinel/generator';

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
