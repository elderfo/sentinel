import { randomUUID } from 'node:crypto';
import type { TestSuite } from '@sentinel/generator';
import type {
  RunnerConfig,
  RunResult,
  RunnerError,
  RunSummary,
  TestResult,
  Reporter,
  ReportFormat,
} from '../types.js';
import { validateRunnerConfig } from '../config/index.js';
import { Scheduler } from '../scheduler/index.js';
import { JsonReporter } from '../reporter/json-reporter.js';
import { JunitReporter } from '../reporter/junit-reporter.js';
import { HtmlReporter } from '../reporter/html-reporter.js';
import { TrendStore } from '../trends/index.js';

function buildSummary(
  results: readonly TestResult[],
  startedAt: number,
  completedAt: number,
): RunSummary {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let passedWithRetry = 0;

  for (const r of results) {
    switch (r.status) {
      case 'passed':
        passed++;
        break;
      case 'failed':
        failed++;
        break;
      case 'skipped':
        skipped++;
        break;
      case 'passed-with-retry':
        passedWithRetry++;
        break;
    }
  }

  return {
    total: results.length,
    passed,
    failed,
    skipped,
    passedWithRetry,
    duration: completedAt - startedAt,
  };
}

function createReporter(format: ReportFormat): Reporter {
  switch (format) {
    case 'json':
      return new JsonReporter();
    case 'junit':
      return new JunitReporter();
    case 'html':
      return new HtmlReporter();
  }
}

function hasTestCases(suites: readonly TestSuite[]): boolean {
  return suites.some((s) => s.testCases.length > 0);
}

export async function run(
  config: RunnerConfig,
  suites: readonly TestSuite[],
): Promise<RunResult | RunnerError> {
  // 1. Validate config
  const validationError = validateRunnerConfig(config);
  if (validationError !== null) {
    return validationError;
  }

  // 2. Check suites are non-empty
  if (suites.length === 0 || !hasTestCases(suites)) {
    return { code: 'NO_TESTS_FOUND', message: 'No test suites provided' };
  }

  // 3. Create Scheduler, enqueue suites, execute
  const startedAt = Date.now();
  const scheduler = new Scheduler(config);
  scheduler.enqueue(suites);
  const results: readonly TestResult[] = await scheduler.execute();
  const completedAt = Date.now();

  // 4. Build RunSummary from results
  const summary = buildSummary(results, startedAt, completedAt);

  // 5. Build RunResult
  const runResult: RunResult = {
    runId: randomUUID(),
    startedAt,
    completedAt,
    config,
    results,
    summary,
  };

  // 6. Create reporters based on config.reportFormats and write all reports
  const reporters = config.reportFormats.map(createReporter);
  await Promise.all(reporters.map((reporter) => reporter.write(runResult, config.outputDir)));

  // 7. Persist to TrendStore
  const trendStore = new TrendStore(config.trendDbPath);
  trendStore.persistRun(runResult);
  trendStore.close();

  // 8. Return RunResult
  return runResult;
}
