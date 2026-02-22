import { describe, it, expect } from 'vitest';
import { loadRunnerConfig, validateRunnerConfig } from '@sentinel/runner';
import type { RunnerConfig, RunnerError } from '@sentinel/runner';

describe('loadRunnerConfig', () => {
  it('returns default config when called with no arguments', () => {
    const config = loadRunnerConfig();
    expect(config.workers).toBe(4);
    expect(config.retries).toBe(2);
    expect(config.headless).toBe(true);
    expect(config.browserType).toBe('chromium');
    expect(config.timeout).toBe(30_000);
    expect(config.reportFormats).toEqual(['json', 'junit', 'html']);
    expect(config.outputDir).toBe('./sentinel-output');
    expect(config.trendDbPath).toBe('./sentinel-trends.db');
    expect(config.baseUrl).toBeUndefined();
  });

  it('overrides individual fields while keeping other defaults', () => {
    const config = loadRunnerConfig({ workers: 8, timeout: 60_000 });
    expect(config.workers).toBe(8);
    expect(config.timeout).toBe(60_000);
    expect(config.retries).toBe(2); // default preserved
    expect(config.headless).toBe(true); // default preserved
  });

  it('handles undefined overrides gracefully', () => {
    const config = loadRunnerConfig(undefined);
    expect(config.workers).toBe(4);
  });

  it('includes baseUrl when provided', () => {
    const config = loadRunnerConfig({ baseUrl: 'http://localhost:3000' });
    expect(config.baseUrl).toBe('http://localhost:3000');
  });
});

describe('validateRunnerConfig', () => {
  const validConfig: RunnerConfig = {
    outputDir: './sentinel-output',
    workers: 4,
    retries: 2,
    headless: true,
    browserType: 'chromium',
    timeout: 30_000,
    reportFormats: ['json', 'junit', 'html'],
    trendDbPath: './sentinel-trends.db',
  };

  it('returns null for valid config', () => {
    expect(validateRunnerConfig(validConfig)).toBeNull();
  });

  it('returns RunnerError when workers <= 0', () => {
    const result = validateRunnerConfig({ ...validConfig, workers: 0 });
    expect(result).not.toBeNull();
    expect((result as RunnerError).code).toBe('INVALID_CONFIG');
    expect((result as RunnerError).message).toContain('workers');
  });

  it('returns RunnerError when retries < 0', () => {
    const result = validateRunnerConfig({ ...validConfig, retries: -1 });
    expect(result).not.toBeNull();
    expect((result as RunnerError).code).toBe('INVALID_CONFIG');
    expect((result as RunnerError).message).toContain('retries');
  });

  it('returns RunnerError when timeout <= 0', () => {
    const result = validateRunnerConfig({ ...validConfig, timeout: 0 });
    expect(result).not.toBeNull();
    expect((result as RunnerError).code).toBe('INVALID_CONFIG');
    expect((result as RunnerError).message).toContain('timeout');
  });

  it('returns RunnerError when outputDir is empty', () => {
    const result = validateRunnerConfig({ ...validConfig, outputDir: '' });
    expect(result).not.toBeNull();
    expect((result as RunnerError).code).toBe('INVALID_CONFIG');
    expect((result as RunnerError).message).toContain('outputDir');
  });

  it('returns RunnerError for invalid browserType', () => {
    const result = validateRunnerConfig({
      ...validConfig,
      browserType: 'safari' as RunnerConfig['browserType'],
    });
    expect(result).not.toBeNull();
    expect((result as RunnerError).code).toBe('INVALID_CONFIG');
    expect((result as RunnerError).message).toContain('browserType');
  });

  it('returns RunnerError for invalid reportFormat', () => {
    const result = validateRunnerConfig({
      ...validConfig,
      reportFormats: ['json', 'csv' as never],
    });
    expect(result).not.toBeNull();
    expect((result as RunnerError).code).toBe('INVALID_CONFIG');
    expect((result as RunnerError).message).toContain('reportFormat');
  });

  it('joins multiple validation errors with "; "', () => {
    const result = validateRunnerConfig({
      ...validConfig,
      workers: 0,
      timeout: -1,
    });
    expect(result).not.toBeNull();
    expect((result as RunnerError).message).toContain('; ');
    expect((result as RunnerError).message).toContain('workers');
    expect((result as RunnerError).message).toContain('timeout');
  });

  it('allows retries of 0 (no retries)', () => {
    const result = validateRunnerConfig({ ...validConfig, retries: 0 });
    expect(result).toBeNull();
  });
});
