import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JunitReporter } from '../reporter/junit-reporter.js';
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
    reportFormats: ['junit'],
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

describe('JunitReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has format "junit"', () => {
    const reporter = new JunitReporter();
    expect(reporter.format).toBe('junit');
  });

  it('writes sentinel-report.xml', async () => {
    const reporter = new JunitReporter();
    const filePath = await reporter.write(makeRunResult(), './output');
    expect(filePath).toContain('sentinel-report.xml');
  });

  it('outputs well-formed XML with testsuites root', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JunitReporter();
    await reporter.write(makeRunResult(), './output');

    const xml = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string | undefined;
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<testsuites>');
    expect(xml).toContain('</testsuites>');
  });

  it('groups tests by suite into testsuite elements', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JunitReporter();
    await reporter.write(
      makeRunResult({
        results: [
          {
            testId: 'tc-1',
            testName: 'Test A',
            suite: 'auth',
            status: 'passed',
            duration: 1000,
            retryCount: 0,
            artifacts: { artifactDir: './a' },
          },
          {
            testId: 'tc-2',
            testName: 'Test B',
            suite: 'auth',
            status: 'passed',
            duration: 500,
            retryCount: 0,
            artifacts: { artifactDir: './b' },
          },
          {
            testId: 'tc-3',
            testName: 'Test C',
            suite: 'checkout',
            status: 'passed',
            duration: 800,
            retryCount: 0,
            artifacts: { artifactDir: './c' },
          },
        ],
      }),
      './output',
    );

    const xml = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string | undefined;
    expect(xml).toContain('name="auth"');
    expect(xml).toContain('name="checkout"');
    expect(xml).toContain('tests="2"'); // auth has 2
    expect(xml).toContain('tests="1"'); // checkout has 1
  });

  it('includes failure element for failed tests', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JunitReporter();
    await reporter.write(
      makeRunResult({
        results: [
          {
            testId: 'tc-1',
            testName: 'Failing test',
            suite: 'auth',
            status: 'failed',
            duration: 1000,
            retryCount: 2,
            error: {
              message: 'Expected visible',
              stack: 'Error: Expected visible\n  at test.ts:10',
              consoleErrors: [],
              failedNetworkRequests: [],
            },
            artifacts: { artifactDir: './a' },
          },
        ],
      }),
      './output',
    );

    const xml = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string | undefined;
    expect(xml).toContain('<failure');
    expect(xml).toContain('Expected visible');
    expect(xml).toContain('failures="1"');
  });

  it('includes skipped element for skipped tests', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JunitReporter();
    await reporter.write(
      makeRunResult({
        results: [
          {
            testId: 'tc-1',
            testName: 'Skipped test',
            suite: 'auth',
            status: 'skipped',
            duration: 0,
            retryCount: 0,
            artifacts: { artifactDir: './a' },
          },
        ],
      }),
      './output',
    );

    const xml = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string | undefined;
    expect(xml).toContain('<skipped/>');
    expect(xml).toContain('skipped="1"');
  });

  it('escapes XML special characters', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JunitReporter();
    await reporter.write(
      makeRunResult({
        results: [
          {
            testId: 'tc-1',
            testName: 'Test with <special> & "chars"',
            suite: 'auth',
            status: 'passed',
            duration: 500,
            retryCount: 0,
            artifacts: { artifactDir: './a' },
          },
        ],
      }),
      './output',
    );

    const xml = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string | undefined;
    expect(xml).toContain('&lt;special&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;chars&quot;');
  });

  it('sets time attribute in seconds', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JunitReporter();
    await reporter.write(
      makeRunResult({
        results: [
          {
            testId: 'tc-1',
            testName: 'Test',
            suite: 'auth',
            status: 'passed',
            duration: 1500,
            retryCount: 0,
            artifacts: { artifactDir: './a' },
          },
        ],
      }),
      './output',
    );

    const xml = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string | undefined;
    expect(xml).toContain('time="1.500"');
  });
});
