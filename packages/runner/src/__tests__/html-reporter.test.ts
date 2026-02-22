import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HtmlReporter } from '../reporter/html-reporter.js';
import type { RunResult } from '../types.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const makeRunResult = (overrides?: Partial<RunResult>): RunResult => ({
  runId: 'run-1',
  startedAt: 1000,
  completedAt: 2000,
  config: {
    outputDir: './output',
    workers: 4,
    retries: 2,
    headless: true,
    browserType: 'chromium',
    timeout: 30000,
    reportFormats: ['html'],
    trendDbPath: './trends.db',
  },
  results: [
    {
      testId: 'tc-1',
      testName: 'Login test',
      suite: 'auth',
      status: 'passed',
      duration: 1500,
      retryCount: 0,
      artifacts: { artifactDir: './artifacts/tc-1' },
    },
  ],
  summary: {
    total: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    passedWithRetry: 0,
    duration: 1000,
  },
  ...overrides,
});

describe('HtmlReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has format "html"', () => {
    expect(new HtmlReporter().format).toBe('html');
  });

  it('writes sentinel-report.html', async () => {
    const reporter = new HtmlReporter();
    const filePath = await reporter.write(makeRunResult(), './output');
    expect(filePath).toContain('sentinel-report.html');
  });

  it('produces self-contained HTML with inline CSS', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new HtmlReporter();
    await reporter.write(makeRunResult(), './output');

    const html = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
    // No external CSS/JS links
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script src=');
  });

  it('displays summary counts', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new HtmlReporter();
    await reporter.write(
      makeRunResult({
        summary: {
          total: 10,
          passed: 7,
          failed: 2,
          skipped: 1,
          passedWithRetry: 0,
          duration: 5000,
        },
      }),
      './output',
    );

    const html = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(html).toContain('Total: 10');
    expect(html).toContain('Passed: 7');
    expect(html).toContain('Failed: 2');
    expect(html).toContain('Skipped: 1');
  });

  it('includes test name, suite, status, and duration per row', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new HtmlReporter();
    await reporter.write(makeRunResult(), './output');

    const html = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(html).toContain('Login test');
    expect(html).toContain('auth');
    expect(html).toContain('PASS');
    expect(html).toContain('1.50s');
  });

  it('shows error message for failed tests', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new HtmlReporter();
    await reporter.write(
      makeRunResult({
        results: [
          {
            testId: 'tc-1',
            testName: 'Failing test',
            suite: 'auth',
            status: 'failed',
            duration: 1000,
            retryCount: 0,
            error: {
              message: 'Expected element to be visible',
              stack: 'Error: Expected element to be visible',
              consoleErrors: [],
              failedNetworkRequests: [],
            },
            artifacts: { artifactDir: './a' },
          },
        ],
      }),
      './output',
    );

    const html = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(html).toContain('FAIL');
    expect(html).toContain('Expected element to be visible');
  });

  it('returns file path', async () => {
    const reporter = new HtmlReporter();
    const path = await reporter.write(makeRunResult(), '/tmp/reports');
    expect(path).toContain('sentinel-report.html');
  });
});
