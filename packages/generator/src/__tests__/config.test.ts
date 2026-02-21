import { describe, it, expect } from 'vitest';
import { loadGeneratorConfig, validateConfig } from '@sentinel/generator';
import type { GeneratorConfig, GeneratorError } from '@sentinel/generator';

describe('loadGeneratorConfig', () => {
  it('returns default config when called with no arguments', () => {
    const config = loadGeneratorConfig();

    expect(config.assertionDepth).toBe('standard');
    expect(config.dataStrategy).toBe('realistic');
    expect(config.outputFormat).toBe('playwright-ts');
    expect(config.outputDir).toBe('./sentinel-tests');
    expect(config.ai).toBeUndefined();
  });

  it('overrides individual fields while keeping other defaults', () => {
    const config = loadGeneratorConfig({
      assertionDepth: 'verbose',
      outputDir: '/tmp/tests',
    });

    expect(config.assertionDepth).toBe('verbose');
    expect(config.outputDir).toBe('/tmp/tests');
    expect(config.dataStrategy).toBe('realistic');
    expect(config.outputFormat).toBe('playwright-ts');
  });

  it('merges partial AiConfig with defaults', () => {
    const config = loadGeneratorConfig({
      ai: {
        enabled: true,
        maxTokenBudget: 5000,
      },
    });

    expect(config.ai).toBeDefined();
    expect(config.ai?.enabled).toBe(true);
    expect(config.ai?.maxTokenBudget).toBe(5000);
    expect(config.ai?.promptTemplate).toBeUndefined();
    expect(config.ai?.model).toBeUndefined();
  });

  it('handles undefined overrides gracefully', () => {
    const config = loadGeneratorConfig(undefined);

    expect(config.assertionDepth).toBe('standard');
    expect(config.dataStrategy).toBe('realistic');
    expect(config.outputFormat).toBe('playwright-ts');
    expect(config.outputDir).toBe('./sentinel-tests');
  });
});

describe('validateConfig', () => {
  const validConfig: GeneratorConfig = {
    assertionDepth: 'standard',
    dataStrategy: 'realistic',
    outputFormat: 'playwright-ts',
    outputDir: './sentinel-tests',
  };

  it('returns null for valid config', () => {
    const result = validateConfig(validConfig);
    expect(result).toBeNull();
  });

  it('returns GeneratorError with code INVALID_CONFIG when assertionDepth is invalid', () => {
    const config = {
      ...validConfig,
      assertionDepth: 'extreme' as GeneratorConfig['assertionDepth'],
    };
    const result = validateConfig(config);

    expect(result).not.toBeNull();
    expect((result as GeneratorError).code).toBe('INVALID_CONFIG');
    expect((result as GeneratorError).message).toContain('assertionDepth');
  });

  it('returns GeneratorError with code INVALID_CONFIG when dataStrategy is invalid', () => {
    const config = {
      ...validConfig,
      dataStrategy: 'random' as GeneratorConfig['dataStrategy'],
    };
    const result = validateConfig(config);

    expect(result).not.toBeNull();
    expect((result as GeneratorError).code).toBe('INVALID_CONFIG');
    expect((result as GeneratorError).message).toContain('dataStrategy');
  });

  it('returns GeneratorError with code INVALID_CONFIG when outputFormat is invalid', () => {
    const config = {
      ...validConfig,
      outputFormat: 'cypress' as GeneratorConfig['outputFormat'],
    };
    const result = validateConfig(config);

    expect(result).not.toBeNull();
    expect((result as GeneratorError).code).toBe('INVALID_CONFIG');
    expect((result as GeneratorError).message).toContain('outputFormat');
  });

  it('returns GeneratorError with code INVALID_CONFIG when ai.maxTokenBudget is <= 0', () => {
    const config: GeneratorConfig = {
      ...validConfig,
      ai: {
        enabled: true,
        maxTokenBudget: 0,
      },
    };
    const result = validateConfig(config);

    expect(result).not.toBeNull();
    expect((result as GeneratorError).code).toBe('INVALID_CONFIG');
    expect((result as GeneratorError).message).toContain('maxTokenBudget');
  });

  it("joins multiple validation errors into message with '; '", () => {
    const config = {
      ...validConfig,
      assertionDepth: 'bad' as GeneratorConfig['assertionDepth'],
      dataStrategy: 'bad' as GeneratorConfig['dataStrategy'],
    };
    const result = validateConfig(config);

    expect(result).not.toBeNull();
    expect((result as GeneratorError).code).toBe('INVALID_CONFIG');
    expect((result as GeneratorError).message).toContain('; ');
    expect((result as GeneratorError).message).toContain('assertionDepth');
    expect((result as GeneratorError).message).toContain('dataStrategy');
  });

  it('returns null when ai is undefined (optional field)', () => {
    const config: GeneratorConfig = {
      ...validConfig,
      ai: undefined,
    };
    const result = validateConfig(config);
    expect(result).toBeNull();
  });
});
