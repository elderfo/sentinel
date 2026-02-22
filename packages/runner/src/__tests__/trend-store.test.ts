import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TrendStore } from '../trends/trend-store.js';
import type { RunResult, TestStatus } from '../types.js';

const makeRunResult = (
  runId: string,
  results: Array<{
    testId: string;
    testName: string;
    suite: string;
    status: string;
    duration: number;
  }>,
): RunResult => ({
  runId,
  startedAt: Date.now(),
  completedAt: Date.now() + 1000,
  config: {
    outputDir: './output',
    workers: 4,
    retries: 2,
    headless: true,
    browserType: 'chromium',
    timeout: 30000,
    reportFormats: ['json'],
    trendDbPath: ':memory:',
  },
  results: results.map((r) => ({
    testId: r.testId,
    testName: r.testName,
    suite: r.suite,
    status: r.status as TestStatus,
    duration: r.duration,
    retryCount: 0,
    artifacts: { artifactDir: './artifacts' },
  })),
  summary: {
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: 0,
    passedWithRetry: 0,
    duration: 1000,
  },
});

describe('TrendStore', () => {
  let store: TrendStore;

  beforeEach(() => {
    store = new TrendStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('creates tables on construction', () => {
    // If we get here without error, tables were created
    expect(store).toBeDefined();
  });

  it('persistRun inserts a run and its test results', () => {
    const result = makeRunResult('run-1', [
      {
        testId: 'tc-1',
        testName: 'Test 1',
        suite: 'auth',
        status: 'passed',
        duration: 500,
      },
    ]);
    store.persistRun(result);

    const history = store.getRunHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.runId).toBe('run-1');
  });

  it('getTrends returns TrendReport for all tests', () => {
    store.persistRun(
      makeRunResult('run-1', [
        {
          testId: 'tc-1',
          testName: 'Test 1',
          suite: 'auth',
          status: 'passed',
          duration: 500,
        },
        {
          testId: 'tc-2',
          testName: 'Test 2',
          suite: 'auth',
          status: 'failed',
          duration: 1000,
        },
      ]),
    );

    const trends = store.getTrends();
    expect(trends).toHaveLength(2);
    expect(trends.find((t) => t.testId === 'tc-1')?.passRate).toBe(1);
    expect(trends.find((t) => t.testId === 'tc-2')?.passRate).toBe(0);
  });

  it('getTrend returns TrendReport for a specific test', () => {
    store.persistRun(
      makeRunResult('run-1', [
        {
          testId: 'tc-1',
          testName: 'Test 1',
          suite: 'auth',
          status: 'passed',
          duration: 500,
        },
      ]),
    );

    const trend = store.getTrend('tc-1');
    expect(trend).toBeDefined();
    expect(trend?.testId).toBe('tc-1');
    expect(trend?.passRate).toBe(1);
  });

  it('getTrend returns undefined for unknown test', () => {
    expect(store.getTrend('nonexistent')).toBeUndefined();
  });

  it('detects flaky test (fails in 3 of 10 runs)', () => {
    // Run test 10 times: 7 pass, 3 fail = 70% pass rate = flaky (>20% and <80%)
    for (let i = 0; i < 10; i++) {
      const status = i < 7 ? 'passed' : 'failed';
      store.persistRun(
        makeRunResult(`run-${String(i)}`, [
          {
            testId: 'tc-1',
            testName: 'Flaky Test',
            suite: 'auth',
            status,
            duration: 500,
          },
        ]),
      );
    }

    const trend = store.getTrend('tc-1');
    expect(trend?.isFlaky).toBe(true);
    expect(trend?.passRate).toBe(0.7);
  });

  it('does not flag test as flaky if it fails rarely (1 of 10)', () => {
    for (let i = 0; i < 10; i++) {
      const status = i < 9 ? 'passed' : 'failed';
      store.persistRun(
        makeRunResult(`run-${String(i)}`, [
          {
            testId: 'tc-1',
            testName: 'Stable Test',
            suite: 'auth',
            status,
            duration: 500,
          },
        ]),
      );
    }

    const trend = store.getTrend('tc-1');
    expect(trend?.isFlaky).toBe(false);
    expect(trend?.passRate).toBe(0.9);
  });

  it('does not flag test as flaky if it fails frequently (9 of 10)', () => {
    for (let i = 0; i < 10; i++) {
      const status = i < 1 ? 'passed' : 'failed';
      store.persistRun(
        makeRunResult(`run-${String(i)}`, [
          {
            testId: 'tc-1',
            testName: 'Broken Test',
            suite: 'auth',
            status,
            duration: 500,
          },
        ]),
      );
    }

    const trend = store.getTrend('tc-1');
    expect(trend?.isFlaky).toBe(false);
    expect(trend?.passRate).toBe(0.1);
  });

  it('getRunHistory returns the last N runs', () => {
    for (let i = 0; i < 5; i++) {
      store.persistRun(
        makeRunResult(`run-${String(i)}`, [
          {
            testId: 'tc-1',
            testName: 'Test',
            suite: 'auth',
            status: 'passed',
            duration: 500,
          },
        ]),
      );
    }

    const history = store.getRunHistory(3);
    expect(history).toHaveLength(3);
  });

  it('exportCsv returns CSV with correct headers and data', () => {
    store.persistRun(
      makeRunResult('run-1', [
        {
          testId: 'tc-1',
          testName: 'Test 1',
          suite: 'auth',
          status: 'passed',
          duration: 500,
        },
      ]),
    );

    const csv = store.exportCsv();
    const lines = csv.split('\n');
    expect(lines[0]).toBe('test_id,test_name,suite,pass_rate,avg_duration,is_flaky,run_count');
    expect(lines).toHaveLength(2); // header + 1 data row
    expect(lines[1]).toContain('tc-1');
    expect(lines[1]).toContain('Test 1');
    expect(lines[1]).toContain('auth');
  });
});
