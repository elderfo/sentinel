import type { SelectorStrategy } from '@sentinel/analysis';
import type { ActionType } from '@sentinel/discovery';

// ---------------------------------------------------------------------------
// Test classification
// ---------------------------------------------------------------------------

export type TestType = 'happy-path' | 'error-path' | 'edge-case';

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

export type AssertionType =
  | 'visibility'
  | 'text-content'
  | 'url-match'
  | 'element-count'
  | 'attribute-value';

export interface TestAssertion {
  readonly type: AssertionType;
  readonly selector: string;
  readonly selectorStrategy: SelectorStrategy;
  readonly expected: string;
  readonly confidence: number;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Test steps and cases
// ---------------------------------------------------------------------------

export interface TestStep {
  readonly action: ActionType;
  readonly selector: string;
  readonly selectorStrategy: SelectorStrategy;
  readonly description: string;
  readonly inputData?: Record<string, string> | undefined;
  readonly assertions: readonly TestAssertion[];
}

export interface TestCase {
  readonly id: string;
  readonly name: string;
  readonly type: TestType;
  readonly journeyId: string;
  readonly suite: string;
  readonly setupSteps: readonly TestStep[];
  readonly steps: readonly TestStep[];
  readonly teardownSteps: readonly TestStep[];
  readonly tags: readonly string[];
}

// ---------------------------------------------------------------------------
// Test suite and generation output
// ---------------------------------------------------------------------------

export interface TestSuite {
  readonly name: string;
  readonly fileName: string;
  readonly testCases: readonly TestCase[];
}

export interface GenerationResult {
  readonly suites: readonly TestSuite[];
  readonly manifest: TestManifest;
  readonly stats: GenerationStats;
}

export interface TestManifest {
  readonly generatedAt: number;
  readonly files: readonly ManifestEntry[];
}

export interface ManifestEntry {
  readonly fileName: string;
  readonly journeyIds: readonly string[];
  readonly testCount: number;
  readonly checksum: string;
}

export interface GenerationStats {
  readonly totalTests: number;
  readonly happyPathTests: number;
  readonly errorPathTests: number;
  readonly edgeCaseTests: number;
  readonly totalAssertions: number;
  readonly lowConfidenceAssertions: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type AssertionDepth = 'minimal' | 'standard' | 'verbose';
export type DataStrategy = 'realistic' | 'boundary';
export type OutputFormat = 'playwright-ts' | 'json';

export interface AiConfig {
  readonly enabled: boolean;
  readonly maxTokenBudget: number;
  readonly promptTemplate?: string | undefined;
  readonly model?: string | undefined;
}

export interface GeneratorConfig {
  readonly assertionDepth: AssertionDepth;
  readonly dataStrategy: DataStrategy;
  readonly outputFormat: OutputFormat;
  readonly outputDir: string;
  readonly ai?: AiConfig | undefined;
}

// ---------------------------------------------------------------------------
// AI provider
// ---------------------------------------------------------------------------

export interface AiProviderRequest {
  readonly prompt: string;
  readonly maxTokens: number;
}

export interface AiProviderResponse {
  readonly content: string;
  readonly tokensUsed: number;
}

export interface AiProvider {
  readonly name: string;
  readonly complete: (request: AiProviderRequest) => Promise<AiProviderResponse>;
}

// ---------------------------------------------------------------------------
// Edge case generation
// ---------------------------------------------------------------------------

export interface EdgeCaseContext {
  readonly pageTitle: string;
  readonly interactiveElements: readonly import('@sentinel/analysis').InteractiveElement[];
  readonly formConstraints: readonly import('@sentinel/analysis').FieldConstraints[];
  readonly observedBehaviors: readonly string[];
  readonly existingTestNames: readonly string[];
}

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

export interface InvalidInput {
  readonly value: string;
  readonly violatedConstraint: string;
  readonly description: string;
}

export interface DataGeneratorStrategy {
  readonly generateValid: (field: import('@sentinel/analysis').FormField) => string;
  readonly generateInvalid: (
    field: import('@sentinel/analysis').FormField,
  ) => readonly InvalidInput[];
}

// ---------------------------------------------------------------------------
// Test emission
// ---------------------------------------------------------------------------

export interface EmittedFile {
  readonly fileName: string;
  readonly content: string;
  readonly checksum: string;
}

export interface TestEmitter {
  readonly formatName: OutputFormat;
  readonly emit: (suites: readonly TestSuite[]) => Promise<readonly EmittedFile[]>;
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

export type GeneratorErrorCode =
  | 'INVALID_CONFIG'
  | 'EMPTY_EXPLORATION'
  | 'AI_PROVIDER_FAILURE'
  | 'EMISSION_FAILURE'
  | 'UNKNOWN_FORMAT';

export interface GeneratorError {
  readonly code: GeneratorErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
