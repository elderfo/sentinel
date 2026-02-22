import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { TestSuite, TestCase } from '@sentinel/generator';
import type { RunnerConfig, RunResult, RunnerError, TestResult } from '../types.js';
import { run } from '../orchestrator/run.js';

// ---------------------------------------------------------------------------
// Mock instances (declared before mocks so factories can reference them)
// ---------------------------------------------------------------------------

let mockSchedulerInstance: {
  enqueue: Mock;
  execute: Mock;
};

let mockJsonReporterInstance: { format: string; write: Mock };
let mockJunitReporterInstance: { format: string; write: Mock };
let mockHtmlReporterInstance: { format: string; write: Mock };

let mockTrendStoreInstance: {
  persistRun: Mock;
  close: Mock;
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockValidateRunnerConfig = vi.fn();

vi.mock('../config/index.js', () => ({
  validateRunnerConfig: (...args: unknown[]) => mockValidateRunnerConfig(...args) as unknown,
}));

vi.mock('../scheduler/index.js', () => ({
  Scheduler: vi.fn(function Scheduler() {
    return mockSchedulerInstance;
  }),
}));

vi.mock('../reporter/json-reporter.js', () => ({
  JsonReporter: vi.fn(function JsonReporter() {
    return mockJsonReporterInstance;
  }),
}));

vi.mock('../reporter/junit-reporter.js', () => ({
  JunitReporter: vi.fn(function JunitReporter() {
    return mockJunitReporterInstance;
  }),
}));

vi.mock('../reporter/html-reporter.js', () => ({
  HtmlReporter: vi.fn(function HtmlReporter() {
    return mockHtmlReporterInstance;
  }),
}));

vi.mock('../trends/index.js', () => ({
  TrendStore: vi.fn(function TrendStore() {
    return mockTrendStoreInstance;
  }),
}));

// Re-import mocked constructors for assertion
import { Scheduler } from '../scheduler/index.js';
import { JsonReporter } from '../reporter/json-reporter.js';
import { JunitReporter } from '../reporter/junit-reporter.js';
import { HtmlReporter } from '../reporter/html-reporter.js';
import { TrendStore } from '../trends/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRunnerError(value: RunResult | RunnerError): value is RunnerError {
  return 'code' in value;
}

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc-1',
    name: 'Login test',
    type: 'happy-path',
    journeyId: 'j-1',
    suite: 'auth',
    setupSteps: [],
    steps: [],
    teardownSteps: [],
    tags: [],
    ...overrides,
  };
}

function makeTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    testId: 'tc-1',
    testName: 'Login test',
    suite: 'auth',
    status: 'passed',
    duration: 1500,
    retryCount: 0,
    artifacts: { artifactDir: './output/auth/tc-1' },
    ...overrides,
  };
}

const validConfig: RunnerConfig = {
  outputDir: './output',
  workers: 2,
  retries: 1,
  headless: true,
  browserType: 'chromium',
  timeout: 30_000,
  reportFormats: ['json', 'junit', 'html'],
  trendDbPath: './trends.db',
  baseUrl: 'http://localhost:3000',
};

function makeSuite(overrides: Partial<TestSuite> = {}): TestSuite {
  return {
    name: 'auth-suite',
    fileName: 'auth-suite.test.ts',
    testCases: [makeTestCase()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockValidateRunnerConfig.mockReturnValue(null);

  mockSchedulerInstance = {
    enqueue: vi.fn(),
    execute: vi.fn().mockResolvedValue([
      makeTestResult({ testId: 'tc-1', status: 'passed', duration: 1000 }),
      makeTestResult({ testId: 'tc-2', status: 'failed', duration: 2000 }),
      makeTestResult({ testId: 'tc-3', status: 'skipped', duration: 0 }),
      makeTestResult({
        testId: 'tc-4',
        status: 'passed-with-retry',
        duration: 3000,
      }),
    ]),
  };

  mockJsonReporterInstance = {
    format: 'json',
    write: vi.fn().mockResolvedValue('./output/sentinel-report.json'),
  };

  mockJunitReporterInstance = {
    format: 'junit',
    write: vi.fn().mockResolvedValue('./output/sentinel-report.xml'),
  };

  mockHtmlReporterInstance = {
    format: 'html',
    write: vi.fn().mockResolvedValue('./output/sentinel-report.html'),
  };

  mockTrendStoreInstance = {
    persistRun: vi.fn(),
    close: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('run', () => {
  it('returns RunnerError with INVALID_CONFIG for invalid config', async () => {
    const configError: RunnerError = {
      code: 'INVALID_CONFIG',
      message: 'workers must be positive',
    };
    mockValidateRunnerConfig.mockReturnValue(configError);

    const result = await run(validConfig, [makeSuite()]);

    expect(isRunnerError(result)).toBe(true);
    expect(result).toHaveProperty('code', 'INVALID_CONFIG');
    expect(result).toHaveProperty('message', 'workers must be positive');
  });

  it('returns RunnerError with NO_TESTS_FOUND when suites array is empty', async () => {
    const result = await run(validConfig, []);

    expect(isRunnerError(result)).toBe(true);
    expect(result).toHaveProperty('code', 'NO_TESTS_FOUND');
    expect(result).toHaveProperty('message', 'No test suites provided');
  });

  it('returns RunnerError with NO_TESTS_FOUND when all suites have zero test cases', async () => {
    const emptySuite: TestSuite = {
      name: 'empty',
      fileName: 'empty.test.ts',
      testCases: [],
    };

    const result = await run(validConfig, [emptySuite]);

    expect(isRunnerError(result)).toBe(true);
    expect(result).toHaveProperty('code', 'NO_TESTS_FOUND');
    expect(result).toHaveProperty('message', 'No test suites provided');
  });

  it('executes the full pipeline: scheduler -> collect results -> build summary -> write reports -> persist trends', async () => {
    const suites = [makeSuite()];
    const result = await run(validConfig, suites);

    // Scheduler was created and used
    expect(Scheduler).toHaveBeenCalledWith(validConfig);
    expect(mockSchedulerInstance.enqueue).toHaveBeenCalledWith(suites);
    expect(mockSchedulerInstance.execute).toHaveBeenCalled();

    // Reporters were created and invoked
    expect(JsonReporter).toHaveBeenCalled();
    expect(JunitReporter).toHaveBeenCalled();
    expect(HtmlReporter).toHaveBeenCalled();
    expect(mockJsonReporterInstance.write).toHaveBeenCalled();
    expect(mockJunitReporterInstance.write).toHaveBeenCalled();
    expect(mockHtmlReporterInstance.write).toHaveBeenCalled();

    // TrendStore was created, used, and closed
    expect(TrendStore).toHaveBeenCalledWith(validConfig.trendDbPath);
    expect(mockTrendStoreInstance.persistRun).toHaveBeenCalled();
    expect(mockTrendStoreInstance.close).toHaveBeenCalled();

    // Result is a valid RunResult
    expect(isRunnerError(result)).toBe(false);
  });

  it('returns RunResult with correct summary counts', async () => {
    const result = await run(validConfig, [makeSuite()]);

    expect(isRunnerError(result)).toBe(false);
    if (isRunnerError(result)) return;

    expect(result.summary.total).toBe(4);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.passedWithRetry).toBe(1);
  });

  it('generates reports for all configured formats', async () => {
    const result = await run(validConfig, [makeSuite()]);

    expect(isRunnerError(result)).toBe(false);
    if (isRunnerError(result)) return;

    // All three reporters should have been called with the result and outputDir
    expect(mockJsonReporterInstance.write).toHaveBeenCalledWith(result, validConfig.outputDir);
    expect(mockJunitReporterInstance.write).toHaveBeenCalledWith(result, validConfig.outputDir);
    expect(mockHtmlReporterInstance.write).toHaveBeenCalledWith(result, validConfig.outputDir);
  });

  it('only creates reporters for configured formats', async () => {
    const jsonOnlyConfig: RunnerConfig = {
      ...validConfig,
      reportFormats: ['json'],
    };

    await run(jsonOnlyConfig, [makeSuite()]);

    expect(JsonReporter).toHaveBeenCalled();
    expect(JunitReporter).not.toHaveBeenCalled();
    expect(HtmlReporter).not.toHaveBeenCalled();
  });

  it('persists results to trend store', async () => {
    const result = await run(validConfig, [makeSuite()]);

    expect(isRunnerError(result)).toBe(false);
    if (isRunnerError(result)) return;

    expect(TrendStore).toHaveBeenCalledWith(validConfig.trendDbPath);
    expect(mockTrendStoreInstance.persistRun).toHaveBeenCalledWith(result);
    expect(mockTrendStoreInstance.close).toHaveBeenCalled();
  });

  it('runId is a UUID', async () => {
    const result = await run(validConfig, [makeSuite()]);

    expect(isRunnerError(result)).toBe(false);
    if (isRunnerError(result)) return;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(result.runId).toMatch(uuidRegex);
  });

  it('startedAt and completedAt are timestamps', async () => {
    const before = Date.now();
    const result = await run(validConfig, [makeSuite()]);
    const after = Date.now();

    expect(isRunnerError(result)).toBe(false);
    if (isRunnerError(result)) return;

    expect(result.startedAt).toBeGreaterThanOrEqual(before);
    expect(result.startedAt).toBeLessThanOrEqual(after);
    expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt);
    expect(result.completedAt).toBeLessThanOrEqual(after);
  });

  it('summary duration is completedAt minus startedAt', async () => {
    const result = await run(validConfig, [makeSuite()]);

    expect(isRunnerError(result)).toBe(false);
    if (isRunnerError(result)) return;

    expect(result.summary.duration).toBe(result.completedAt - result.startedAt);
  });

  it('attaches the config to the RunResult', async () => {
    const result = await run(validConfig, [makeSuite()]);

    expect(isRunnerError(result)).toBe(false);
    if (isRunnerError(result)) return;

    expect(result.config).toBe(validConfig);
  });

  it('attaches results from the scheduler to the RunResult', async () => {
    const result = await run(validConfig, [makeSuite()]);

    expect(isRunnerError(result)).toBe(false);
    if (isRunnerError(result)) return;

    expect(result.results).toHaveLength(4);
    expect(result.results[0]?.testId).toBe('tc-1');
    expect(result.results[1]?.testId).toBe('tc-2');
    expect(result.results[2]?.testId).toBe('tc-3');
    expect(result.results[3]?.testId).toBe('tc-4');
  });

  it('does not schedule or report when config is invalid', async () => {
    mockValidateRunnerConfig.mockReturnValue({
      code: 'INVALID_CONFIG',
      message: 'bad',
    });

    await run(validConfig, [makeSuite()]);

    expect(Scheduler).not.toHaveBeenCalled();
    expect(JsonReporter).not.toHaveBeenCalled();
    expect(TrendStore).not.toHaveBeenCalled();
  });

  it('does not schedule or report when no tests found', async () => {
    await run(validConfig, []);

    expect(Scheduler).not.toHaveBeenCalled();
    expect(JsonReporter).not.toHaveBeenCalled();
    expect(TrendStore).not.toHaveBeenCalled();
  });
});
