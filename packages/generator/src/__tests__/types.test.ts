import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  TestType,
  AssertionType,
  TestAssertion,
  TestStep,
  TestCase,
  TestSuite,
  GenerationResult,
  TestManifest,
  ManifestEntry,
  GenerationStats,
  AssertionDepth,
  DataStrategy,
  OutputFormat,
  AiConfig,
  GeneratorConfig,
  AiProviderRequest,
  AiProviderResponse,
  AiProvider,
  EdgeCaseContext,
  InvalidInput,
  DataGeneratorStrategy,
  EmittedFile,
  TestEmitter,
  GeneratorErrorCode,
  GeneratorError,
} from '@sentinel/generator';
import type { SelectorStrategy } from '@sentinel/analysis';
import type { ActionType } from '@sentinel/discovery';

describe('generator types', () => {
  // -------------------------------------------------------------------------
  // Type aliases
  // -------------------------------------------------------------------------

  it('TestType covers all expected values', () => {
    const types: TestType[] = ['happy-path', 'error-path', 'edge-case'];
    expect(types).toHaveLength(3);
  });

  it('AssertionType covers all expected values', () => {
    const types: AssertionType[] = [
      'visibility',
      'text-content',
      'url-match',
      'element-count',
      'attribute-value',
    ];
    expect(types).toHaveLength(5);
  });

  it('AssertionDepth covers all expected values', () => {
    const depths: AssertionDepth[] = ['minimal', 'standard', 'verbose'];
    expect(depths).toHaveLength(3);
  });

  it('DataStrategy covers all expected values', () => {
    const strategies: DataStrategy[] = ['realistic', 'boundary'];
    expect(strategies).toHaveLength(2);
  });

  it('OutputFormat covers all expected values', () => {
    const formats: OutputFormat[] = ['playwright-ts', 'json'];
    expect(formats).toHaveLength(2);
  });

  it('GeneratorErrorCode covers all expected values', () => {
    const codes: GeneratorErrorCode[] = [
      'INVALID_CONFIG',
      'EMPTY_EXPLORATION',
      'AI_PROVIDER_FAILURE',
      'EMISSION_FAILURE',
      'UNKNOWN_FORMAT',
    ];
    expect(codes).toHaveLength(5);
  });

  // -------------------------------------------------------------------------
  // TestAssertion
  // -------------------------------------------------------------------------

  it('TestAssertion is structurally valid', () => {
    const assertion: TestAssertion = {
      type: 'visibility',
      selector: '#submit-btn',
      selectorStrategy: 'id',
      expected: 'true',
      confidence: 0.95,
      description: 'Submit button should be visible',
    };
    expect(assertion.type).toBe('visibility');
    expectTypeOf(assertion.type).toEqualTypeOf<AssertionType>();
    expectTypeOf(assertion.selectorStrategy).toEqualTypeOf<SelectorStrategy>();
    expectTypeOf(assertion.confidence).toBeNumber();
  });

  // -------------------------------------------------------------------------
  // TestStep
  // -------------------------------------------------------------------------

  it('TestStep is structurally valid without optional fields', () => {
    const step: TestStep = {
      action: 'click',
      selector: '#submit-btn',
      selectorStrategy: 'id',
      description: 'Click submit button',
      assertions: [],
    };
    expect(step.action).toBe('click');
    expectTypeOf(step.action).toEqualTypeOf<ActionType>();
    expectTypeOf(step.selectorStrategy).toEqualTypeOf<SelectorStrategy>();
    expectTypeOf(step.assertions).toEqualTypeOf<readonly TestAssertion[]>();
  });

  it('TestStep supports optional inputData', () => {
    const step: TestStep = {
      action: 'form-submit',
      selector: '#login-form',
      selectorStrategy: 'css',
      description: 'Submit login form',
      inputData: { username: 'admin', password: 'secret' },
      assertions: [
        {
          type: 'url-match',
          selector: '',
          selectorStrategy: 'css',
          expected: '/dashboard',
          confidence: 0.9,
          description: 'Should redirect to dashboard',
        },
      ],
    };
    expect(step.inputData).toBeDefined();
    expectTypeOf(step.inputData).toEqualTypeOf<Record<string, string> | undefined>();
  });

  // -------------------------------------------------------------------------
  // TestCase
  // -------------------------------------------------------------------------

  it('TestCase is structurally valid', () => {
    const testCase: TestCase = {
      id: 'tc-001',
      name: 'Login happy path',
      type: 'happy-path',
      journeyId: 'journey-auth',
      suite: 'authentication',
      setupSteps: [],
      steps: [
        {
          action: 'click',
          selector: '#login-btn',
          selectorStrategy: 'id',
          description: 'Click login',
          assertions: [],
        },
      ],
      teardownSteps: [],
      tags: ['auth', 'smoke'],
    };
    expect(testCase.id).toBe('tc-001');
    expectTypeOf(testCase.type).toEqualTypeOf<TestType>();
    expectTypeOf(testCase.setupSteps).toEqualTypeOf<readonly TestStep[]>();
    expectTypeOf(testCase.steps).toEqualTypeOf<readonly TestStep[]>();
    expectTypeOf(testCase.teardownSteps).toEqualTypeOf<readonly TestStep[]>();
    expectTypeOf(testCase.tags).toEqualTypeOf<readonly string[]>();
  });

  // -------------------------------------------------------------------------
  // TestSuite
  // -------------------------------------------------------------------------

  it('TestSuite is structurally valid', () => {
    const suite: TestSuite = {
      name: 'Authentication',
      fileName: 'authentication.spec.ts',
      testCases: [],
    };
    expect(suite.name).toBe('Authentication');
    expectTypeOf(suite.testCases).toEqualTypeOf<readonly TestCase[]>();
  });

  // -------------------------------------------------------------------------
  // GenerationResult
  // -------------------------------------------------------------------------

  it('GenerationResult is structurally valid', () => {
    const result: GenerationResult = {
      suites: [],
      manifest: {
        generatedAt: Date.now(),
        files: [],
      },
      stats: {
        totalTests: 0,
        happyPathTests: 0,
        errorPathTests: 0,
        edgeCaseTests: 0,
        totalAssertions: 0,
        lowConfidenceAssertions: 0,
      },
    };
    expectTypeOf(result.suites).toEqualTypeOf<readonly TestSuite[]>();
    expectTypeOf(result.manifest).toEqualTypeOf<TestManifest>();
    expectTypeOf(result.stats).toEqualTypeOf<GenerationStats>();
  });

  // -------------------------------------------------------------------------
  // TestManifest and ManifestEntry
  // -------------------------------------------------------------------------

  it('TestManifest is structurally valid', () => {
    const manifest: TestManifest = {
      generatedAt: 1700000000000,
      files: [
        {
          fileName: 'auth.spec.ts',
          journeyIds: ['j-1'],
          testCount: 5,
          checksum: 'abc123',
        },
      ],
    };
    expect(manifest.files).toHaveLength(1);
    expectTypeOf(manifest.generatedAt).toBeNumber();
    expectTypeOf(manifest.files).toEqualTypeOf<readonly ManifestEntry[]>();
  });

  it('ManifestEntry is structurally valid', () => {
    const entry: ManifestEntry = {
      fileName: 'auth.spec.ts',
      journeyIds: ['j-1', 'j-2'],
      testCount: 3,
      checksum: 'sha256-abc',
    };
    expectTypeOf(entry.fileName).toBeString();
    expectTypeOf(entry.journeyIds).toEqualTypeOf<readonly string[]>();
    expectTypeOf(entry.testCount).toBeNumber();
    expectTypeOf(entry.checksum).toBeString();
  });

  // -------------------------------------------------------------------------
  // GenerationStats
  // -------------------------------------------------------------------------

  it('GenerationStats is structurally valid', () => {
    const stats: GenerationStats = {
      totalTests: 10,
      happyPathTests: 5,
      errorPathTests: 3,
      edgeCaseTests: 2,
      totalAssertions: 30,
      lowConfidenceAssertions: 4,
    };
    expect(stats.totalTests).toBe(10);
    expectTypeOf(stats.totalTests).toBeNumber();
    expectTypeOf(stats.happyPathTests).toBeNumber();
    expectTypeOf(stats.errorPathTests).toBeNumber();
    expectTypeOf(stats.edgeCaseTests).toBeNumber();
    expectTypeOf(stats.totalAssertions).toBeNumber();
    expectTypeOf(stats.lowConfidenceAssertions).toBeNumber();
  });

  // -------------------------------------------------------------------------
  // AiConfig
  // -------------------------------------------------------------------------

  it('AiConfig is structurally valid with required fields only', () => {
    const config: AiConfig = {
      enabled: true,
      maxTokenBudget: 10000,
    };
    expect(config.enabled).toBe(true);
    expectTypeOf(config.enabled).toBeBoolean();
    expectTypeOf(config.maxTokenBudget).toBeNumber();
    expectTypeOf(config.promptTemplate).toEqualTypeOf<string | undefined>();
    expectTypeOf(config.model).toEqualTypeOf<string | undefined>();
  });

  it('AiConfig supports optional fields', () => {
    const config: AiConfig = {
      enabled: true,
      maxTokenBudget: 5000,
      promptTemplate: 'Generate edge cases for {{context}}',
      model: 'gpt-4',
    };
    expect(config.promptTemplate).toBeDefined();
    expect(config.model).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // GeneratorConfig
  // -------------------------------------------------------------------------

  it('GeneratorConfig is structurally valid with required fields only', () => {
    const config: GeneratorConfig = {
      assertionDepth: 'standard',
      dataStrategy: 'realistic',
      outputFormat: 'playwright-ts',
      outputDir: './generated-tests',
    };
    expect(config.assertionDepth).toBe('standard');
    expectTypeOf(config.assertionDepth).toEqualTypeOf<AssertionDepth>();
    expectTypeOf(config.dataStrategy).toEqualTypeOf<DataStrategy>();
    expectTypeOf(config.outputFormat).toEqualTypeOf<OutputFormat>();
    expectTypeOf(config.outputDir).toBeString();
    expectTypeOf(config.ai).toEqualTypeOf<AiConfig | undefined>();
  });

  it('GeneratorConfig supports optional ai config', () => {
    const config: GeneratorConfig = {
      assertionDepth: 'verbose',
      dataStrategy: 'boundary',
      outputFormat: 'json',
      outputDir: './output',
      ai: {
        enabled: true,
        maxTokenBudget: 5000,
      },
    };
    expect(config.ai).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // AI provider types
  // -------------------------------------------------------------------------

  it('AiProviderRequest is structurally valid', () => {
    const request: AiProviderRequest = {
      prompt: 'Generate edge case test',
      maxTokens: 1000,
    };
    expectTypeOf(request.prompt).toBeString();
    expectTypeOf(request.maxTokens).toBeNumber();
  });

  it('AiProviderResponse is structurally valid', () => {
    const response: AiProviderResponse = {
      content: 'test("edge case", () => { ... })',
      tokensUsed: 150,
    };
    expectTypeOf(response.content).toBeString();
    expectTypeOf(response.tokensUsed).toBeNumber();
  });

  it('AiProvider has name and complete method', () => {
    const provider: AiProvider = {
      name: 'test-provider',
      complete: () => Promise.resolve({ content: 'generated', tokensUsed: 10 }),
    };
    expect(provider.name).toBe('test-provider');
    expectTypeOf(provider.name).toBeString();
    expectTypeOf(provider.complete).toBeFunction();
    expectTypeOf(provider.complete).toEqualTypeOf<
      (request: AiProviderRequest) => Promise<AiProviderResponse>
    >();
  });

  // -------------------------------------------------------------------------
  // EdgeCaseContext
  // -------------------------------------------------------------------------

  it('EdgeCaseContext is structurally valid', () => {
    const context: EdgeCaseContext = {
      pageTitle: 'Login Page',
      interactiveElements: [],
      formConstraints: [],
      observedBehaviors: ['form-validation-error'],
      existingTestNames: ['login-happy-path'],
    };
    expect(context.pageTitle).toBe('Login Page');
    expectTypeOf(context.pageTitle).toBeString();
    expectTypeOf(context.observedBehaviors).toEqualTypeOf<readonly string[]>();
    expectTypeOf(context.existingTestNames).toEqualTypeOf<readonly string[]>();
  });

  // -------------------------------------------------------------------------
  // InvalidInput
  // -------------------------------------------------------------------------

  it('InvalidInput is structurally valid', () => {
    const input: InvalidInput = {
      value: '',
      violatedConstraint: 'required',
      description: 'Empty value violates required constraint',
    };
    expectTypeOf(input.value).toBeString();
    expectTypeOf(input.violatedConstraint).toBeString();
    expectTypeOf(input.description).toBeString();
  });

  // -------------------------------------------------------------------------
  // DataGeneratorStrategy
  // -------------------------------------------------------------------------

  it('DataGeneratorStrategy has generateValid and generateInvalid', () => {
    const strategy: DataGeneratorStrategy = {
      generateValid: () => 'valid-value',
      generateInvalid: () => [
        { value: '', violatedConstraint: 'required', description: 'Empty value' },
      ],
    };
    expectTypeOf(strategy.generateValid).toBeFunction();
    expectTypeOf(strategy.generateInvalid).toBeFunction();
  });

  // -------------------------------------------------------------------------
  // EmittedFile
  // -------------------------------------------------------------------------

  it('EmittedFile is structurally valid', () => {
    const file: EmittedFile = {
      fileName: 'auth.spec.ts',
      content: 'test code',
      checksum: 'sha256-abc',
    };
    expectTypeOf(file.fileName).toBeString();
    expectTypeOf(file.content).toBeString();
    expectTypeOf(file.checksum).toBeString();
  });

  // -------------------------------------------------------------------------
  // TestEmitter
  // -------------------------------------------------------------------------

  it('TestEmitter has formatName and emit method', () => {
    const emitter: TestEmitter = {
      formatName: 'playwright-ts',
      emit: () => Promise.resolve([]),
    };
    expect(emitter.formatName).toBe('playwright-ts');
    expectTypeOf(emitter.formatName).toEqualTypeOf<OutputFormat>();
    expectTypeOf(emitter.emit).toBeFunction();
    expectTypeOf(emitter.emit).toEqualTypeOf<
      (suites: readonly TestSuite[]) => Promise<readonly EmittedFile[]>
    >();
  });

  // -------------------------------------------------------------------------
  // GeneratorError
  // -------------------------------------------------------------------------

  it('GeneratorError is structurally valid without cause', () => {
    const error: GeneratorError = {
      code: 'INVALID_CONFIG',
      message: 'Missing required configuration',
    };
    expect(error.code).toBe('INVALID_CONFIG');
    expectTypeOf(error.code).toEqualTypeOf<GeneratorErrorCode>();
    expectTypeOf(error.message).toBeString();
    expectTypeOf(error.cause).toEqualTypeOf<unknown>();
  });

  it('GeneratorError supports optional cause', () => {
    const error: GeneratorError = {
      code: 'AI_PROVIDER_FAILURE',
      message: 'Provider timed out',
      cause: new Error('timeout'),
    };
    expect(error.cause).toBeInstanceOf(Error);
  });
});
