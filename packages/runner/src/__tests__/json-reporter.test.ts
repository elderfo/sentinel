import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsonReporter } from '../reporter/json-reporter.js';
import type { RunResult } from '../types.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const makeRunResult = (): RunResult => ({
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
    reportFormats: ['json'],
    trendDbPath: './trends.db',
  },
  results: [
    {
      testId: 'tc-1',
      testName: 'Login test',
      suite: 'auth',
      status: 'passed',
      duration: 500,
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
});

describe('JsonReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has format "json"', () => {
    const reporter = new JsonReporter();
    expect(reporter.format).toBe('json');
  });

  it('creates output directory', async () => {
    const { mkdir } = await import('node:fs/promises');
    const reporter = new JsonReporter();
    await reporter.write(makeRunResult(), './output');
    expect(mkdir).toHaveBeenCalledWith('./output', { recursive: true });
  });

  it('writes sentinel-report.json to output directory', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JsonReporter();
    const filePath = await reporter.write(makeRunResult(), './output');

    expect(filePath).toContain('sentinel-report.json');
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('sentinel-report.json'),
      expect.any(String),
      'utf-8',
    );
  });

  it('includes schemaVersion in output', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JsonReporter();
    await reporter.write(makeRunResult(), './output');

    const writtenContent = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent) as Record<string, unknown>;
    expect(parsed['schemaVersion']).toBe('1.0');
  });

  it('includes runId, startedAt, completedAt, summary, results', async () => {
    const { writeFile } = await import('node:fs/promises');
    const reporter = new JsonReporter();
    await reporter.write(makeRunResult(), './output');

    const writtenContent = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    const parsed = JSON.parse(writtenContent) as Record<string, unknown>;
    expect(parsed['runId']).toBe('run-1');
    expect(parsed['startedAt']).toBe(1000);
    expect(parsed['completedAt']).toBe(2000);
    expect(parsed['summary']).toBeDefined();
    expect(parsed['results']).toBeDefined();
  });

  it('returns the file path', async () => {
    const reporter = new JsonReporter();
    const filePath = await reporter.write(makeRunResult(), '/tmp/reports');
    expect(filePath).toContain('sentinel-report.json');
  });
});
