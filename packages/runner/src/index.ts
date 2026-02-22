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
