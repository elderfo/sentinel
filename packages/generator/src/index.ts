/**
 * @sentinel/generator
 *
 * Test generation engine for the Sentinel QA platform.
 * Transforms exploration results into executable test suites.
 */

export type {
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
} from './types.js';

export { loadGeneratorConfig, validateConfig } from './config/index.js';
export { generateAssertions, scoreConfidence, filterByDepth } from './assertions/index.js';

export { generateTestData } from './data/index.js';
export { RealisticDataStrategy, BoundaryDataStrategy } from './data/strategies.js';

export { planTestCases } from './planner/index.js';

export { NoOpAiProvider } from './ai/provider.js';
export { buildEdgeCasePrompt, parseEdgeCaseResponse } from './ai/prompt.js';
export type { EdgeCaseSuggestion } from './ai/prompt.js';
export { generateEdgeCases } from './ai/edge-case-generator.js';
