import { describe, it, expect, expectTypeOf } from 'vitest';
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
  FailedRequest,
  AssertionFailure,
  TestArtifacts,
  RunnerErrorCode,
} from '@sentinel/runner';
import { RUNNER_VERSION } from '@sentinel/runner';

describe('Runner types', () => {
  it('RUNNER_VERSION is defined', () => {
    expect(RUNNER_VERSION).toBe('0.1.0');
  });

  it('TestStatus covers all expected values', () => {
    const statuses: TestStatus[] = ['passed', 'failed', 'skipped', 'passed-with-retry'];
    expect(statuses).toHaveLength(4);
  });

  it('ReportFormat covers all expected values', () => {
    const formats: ReportFormat[] = ['json', 'junit', 'html'];
    expect(formats).toHaveLength(3);
  });

  it('RunnerErrorCode covers all expected values', () => {
    const codes: RunnerErrorCode[] = [
      'INVALID_CONFIG',
      'TARGET_UNREACHABLE',
      'NO_TESTS_FOUND',
      'WORKER_CRASH',
      'TIMEOUT',
    ];
    expect(codes).toHaveLength(5);
  });

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

  it('RunnerConfig is structurally valid', () => {
    const config: RunnerConfig = {
      outputDir: './output',
      workers: 4,
      retries: 2,
      headless: true,
      browserType: 'chromium',
      timeout: 30000,
      reportFormats: ['json', 'junit', 'html'],
      trendDbPath: './trends.db',
    };
    expect(config.workers).toBe(4);
    expectTypeOf(config.reportFormats).toEqualTypeOf<readonly ReportFormat[]>();
  });

  it('RunnerConfig supports optional baseUrl', () => {
    const config: RunnerConfig = {
      outputDir: './output',
      workers: 4,
      retries: 2,
      headless: true,
      browserType: 'chromium',
      timeout: 30000,
      reportFormats: ['json'],
      trendDbPath: './trends.db',
      baseUrl: 'http://localhost:3000',
    };
    expect(config.baseUrl).toBe('http://localhost:3000');
  });

  it('FailedRequest is structurally valid', () => {
    const req: FailedRequest = { url: '/api/data', method: 'GET', status: 500 };
    expectTypeOf(req.url).toBeString();
    expectTypeOf(req.method).toBeString();
    expectTypeOf(req.status).toBeNumber();
  });

  it('AssertionFailure is structurally valid', () => {
    const failure: AssertionFailure = {
      expected: 'visible',
      actual: 'hidden',
      selector: '#btn',
      assertionType: 'visibility',
    };
    expectTypeOf(failure.expected).toBeString();
    expectTypeOf(failure.assertionType).toExtend<string>();
  });

  it('TestError is structurally valid', () => {
    const error: TestError = {
      message: 'Assertion failed',
      stack: 'Error: ...',
      consoleErrors: ['Uncaught TypeError'],
      failedNetworkRequests: [{ url: '/api', method: 'POST', status: 500 }],
    };
    expectTypeOf(error.consoleErrors).toEqualTypeOf<readonly string[]>();
    expectTypeOf(error.failedNetworkRequests).toEqualTypeOf<readonly FailedRequest[]>();
    expectTypeOf(error.assertionDetails).toEqualTypeOf<AssertionFailure | undefined>();
  });

  it('TestArtifacts is structurally valid', () => {
    const artifacts: TestArtifacts = { artifactDir: './artifacts/test-1' };
    expectTypeOf(artifacts.screenshotPath).toEqualTypeOf<string | undefined>();
    expectTypeOf(artifacts.logPath).toEqualTypeOf<string | undefined>();
    expectTypeOf(artifacts.artifactDir).toBeString();
  });

  it('TestResult has required fields', () => {
    expectTypeOf<TestResult>().toHaveProperty('testId');
    expectTypeOf<TestResult>().toHaveProperty('status');
    expectTypeOf<TestResult>().toHaveProperty('duration');
    expectTypeOf<TestResult>().toHaveProperty('retryCount');
    expectTypeOf<TestResult>().toHaveProperty('artifacts');
  });

  it('TestResult is structurally valid', () => {
    const result: TestResult = {
      testId: 'tc-1',
      testName: 'Login test',
      suite: 'auth',
      status: 'passed',
      duration: 1500,
      retryCount: 0,
      artifacts: { artifactDir: './artifacts/tc-1' },
    };
    expect(result.status).toBe('passed');
    expectTypeOf(result.error).toEqualTypeOf<TestError | undefined>();
  });

  it('RunSummary is structurally valid', () => {
    const summary: RunSummary = {
      total: 10,
      passed: 8,
      failed: 1,
      skipped: 0,
      passedWithRetry: 1,
      duration: 5000,
    };
    expect(summary.total).toBe(10);
  });

  it('RunResult contains results array and summary', () => {
    expectTypeOf<RunResult>().toHaveProperty('runId');
    expectTypeOf<RunResult>().toHaveProperty('results');
    expectTypeOf<RunResult>().toHaveProperty('summary');
    expectTypeOf<RunResult>().toHaveProperty('config');
  });

  it('WorkerMessage is a discriminated union on type', () => {
    expectTypeOf<WorkerMessage>().toExtend<{ readonly type: string }>();
  });

  it('Reporter interface has format and write', () => {
    expectTypeOf<Reporter>().toHaveProperty('format');
    expectTypeOf<Reporter>().toHaveProperty('write');
  });

  it('RunnerError has code and message', () => {
    const error: RunnerError = { code: 'INVALID_CONFIG', message: 'Bad config' };
    expectTypeOf(error.code).toEqualTypeOf<RunnerErrorCode>();
    expectTypeOf(error.message).toBeString();
    expectTypeOf(error.cause).toEqualTypeOf<unknown>();
  });

  it('RunnerError supports optional cause', () => {
    const error: RunnerError = {
      code: 'WORKER_CRASH',
      message: 'Process exited',
      cause: new Error('segfault'),
    };
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('TrendEntry is structurally valid', () => {
    const entry: TrendEntry = {
      runId: 'run-1',
      timestamp: Date.now(),
      testId: 'tc-1',
      status: 'passed',
      duration: 1000,
    };
    expectTypeOf(entry.runId).toBeString();
    expectTypeOf(entry.status).toEqualTypeOf<TestStatus>();
  });

  it('TrendReport has flaky detection field', () => {
    expectTypeOf<TrendReport>().toHaveProperty('isFlaky');
    expectTypeOf<TrendReport>().toHaveProperty('passRate');
    expectTypeOf<TrendReport>().toHaveProperty('testId');
    expectTypeOf<TrendReport>().toHaveProperty('testName');
    expectTypeOf<TrendReport>().toHaveProperty('suite');
    expectTypeOf<TrendReport>().toHaveProperty('avgDuration');
    expectTypeOf<TrendReport>().toHaveProperty('runCount');
  });
});
