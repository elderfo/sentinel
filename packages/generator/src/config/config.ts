import type { GeneratorConfig, GeneratorError } from '../types.js';

const DEFAULTS: GeneratorConfig = {
  assertionDepth: 'standard',
  dataStrategy: 'realistic',
  outputFormat: 'playwright-ts',
  outputDir: './sentinel-tests',
};

const VALID_ASSERTION_DEPTHS = new Set(['minimal', 'standard', 'verbose']);
const VALID_DATA_STRATEGIES = new Set(['realistic', 'boundary']);
const VALID_OUTPUT_FORMATS = new Set(['playwright-ts', 'json']);

export function validateConfig(config: GeneratorConfig): GeneratorError | null {
  const errors: string[] = [];
  if (!VALID_ASSERTION_DEPTHS.has(config.assertionDepth)) {
    errors.push(`Invalid assertionDepth: '${config.assertionDepth}'`);
  }
  if (!VALID_DATA_STRATEGIES.has(config.dataStrategy)) {
    errors.push(`Invalid dataStrategy: '${config.dataStrategy}'`);
  }
  if (!VALID_OUTPUT_FORMATS.has(config.outputFormat)) {
    errors.push(`Invalid outputFormat: '${config.outputFormat}'`);
  }
  if (config.ai !== undefined && config.ai.maxTokenBudget <= 0) {
    errors.push('ai.maxTokenBudget must be positive');
  }
  if (errors.length > 0) {
    return { code: 'INVALID_CONFIG', message: errors.join('; ') };
  }
  return null;
}

export function loadGeneratorConfig(overrides?: Partial<GeneratorConfig>): GeneratorConfig {
  if (overrides === undefined) return DEFAULTS;
  return {
    assertionDepth: overrides.assertionDepth ?? DEFAULTS.assertionDepth,
    dataStrategy: overrides.dataStrategy ?? DEFAULTS.dataStrategy,
    outputFormat: overrides.outputFormat ?? DEFAULTS.outputFormat,
    outputDir: overrides.outputDir ?? DEFAULTS.outputDir,
    ...(overrides.ai !== undefined
      ? {
          ai: {
            enabled: overrides.ai.enabled,
            maxTokenBudget: overrides.ai.maxTokenBudget,
            ...(overrides.ai.promptTemplate !== undefined
              ? { promptTemplate: overrides.ai.promptTemplate }
              : {}),
            ...(overrides.ai.model !== undefined ? { model: overrides.ai.model } : {}),
          },
        }
      : {}),
  };
}
