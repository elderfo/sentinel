/**
 * @sentinel/runner
 *
 * Test execution engine for the Sentinel QA platform.
 * Runs generated tests, captures results, and produces reports.
 */

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

export { loadRunnerConfig, validateRunnerConfig } from './config/index.js';

export { loadTestSuites } from './loader/index.js';

// Reporters
export { JsonReporter } from './reporter/json-reporter.js';
export { JunitReporter } from './reporter/junit-reporter.js';
export { HtmlReporter } from './reporter/html-reporter.js';

// Trends
export { TrendStore } from './trends/index.js';

// Orchestrator
export { run } from './orchestrator/index.js';
