import type { RunnerConfig, RunnerError, ReportFormat } from '../types.js';

const DEFAULTS: RunnerConfig = {
  outputDir: './sentinel-output',
  workers: 4,
  retries: 2,
  headless: true,
  browserType: 'chromium',
  timeout: 30_000,
  reportFormats: ['json', 'junit', 'html'],
  trendDbPath: './sentinel-trends.db',
};

const VALID_REPORT_FORMATS = new Set<ReportFormat>(['json', 'junit', 'html']);
const VALID_BROWSER_TYPES = new Set(['chromium', 'firefox', 'webkit']);

export function validateRunnerConfig(config: RunnerConfig): RunnerError | null {
  const errors: string[] = [];
  if (config.workers <= 0) errors.push('workers must be positive');
  if (config.retries < 0) errors.push('retries must be non-negative');
  if (config.timeout <= 0) errors.push('timeout must be positive');
  if (config.outputDir === '') errors.push('outputDir must be non-empty');
  if (!VALID_BROWSER_TYPES.has(config.browserType)) {
    errors.push(`Invalid browserType: '${config.browserType}'`);
  }
  for (const fmt of config.reportFormats) {
    if (!VALID_REPORT_FORMATS.has(fmt)) {
      errors.push(`Invalid reportFormat: '${fmt}'`);
    }
  }
  if (errors.length > 0) {
    return { code: 'INVALID_CONFIG', message: errors.join('; ') };
  }
  return null;
}

export function loadRunnerConfig(overrides?: Partial<RunnerConfig>): RunnerConfig {
  if (overrides === undefined) return DEFAULTS;
  return {
    outputDir: overrides.outputDir ?? DEFAULTS.outputDir,
    workers: overrides.workers ?? DEFAULTS.workers,
    retries: overrides.retries ?? DEFAULTS.retries,
    headless: overrides.headless ?? DEFAULTS.headless,
    browserType: overrides.browserType ?? DEFAULTS.browserType,
    timeout: overrides.timeout ?? DEFAULTS.timeout,
    reportFormats: overrides.reportFormats ?? DEFAULTS.reportFormats,
    trendDbPath: overrides.trendDbPath ?? DEFAULTS.trendDbPath,
    ...(overrides.baseUrl !== undefined ? { baseUrl: overrides.baseUrl } : {}),
  };
}
