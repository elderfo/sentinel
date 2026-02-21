# Test Generation Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `@sentinel/generator` — a pipeline that transforms `ExplorationResult` into executable Playwright TypeScript test suites with assertions, covering happy paths, error paths, and AI-identified edge cases.

**Architecture:** Pipeline of pure functions (Planner → DataGen → Asserter → EdgeCase → Emitter). Each stage transforms `TestCase[]` into richer representations. AI stage is optional and non-fatal. Output is Playwright TS or JSON, formatted with Prettier.

**Tech Stack:** TypeScript strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Vitest 4, `prettier` for code formatting, generic LLM client for AI edge cases.

**Design doc:** `docs/plans/2026-02-21-test-generation-design.md`

---

## Parallelization Strategy

```
Layer 1 (sequential):         Task 1          — scaffolding + types
Layer 2 (parallel worktrees): Tasks 2, 3, 4   — config, data-generator, confidence
Layer 3 (parallel worktrees): Tasks 5, 6      — planner, assertion-generator
Layer 4 (parallel worktrees): Tasks 7, 8      — ai provider + edge cases, suite-organizer
Layer 5 (parallel worktrees): Tasks 9, 10     — playwright-ts emitter, json emitter
Layer 6 (sequential):         Task 11          — orchestrator (generate)
Integration:                  Task 12          — barrel exports, CLAUDE.md update
```

Task 1 must complete first on the feature branch. Each subsequent layer branches from the feature branch after the previous layer merges.

---

### Task 1: Package Scaffolding + Domain Types

**Files:**

- Create: `packages/generator/package.json`
- Create: `packages/generator/tsconfig.json`
- Create: `packages/generator/vitest.config.ts`
- Create: `packages/generator/src/types.ts`
- Create: `packages/generator/src/index.ts`
- Create: `packages/generator/src/__tests__/types.test.ts`
- Modify: `tsconfig.json` (add `@sentinel/generator` path alias)
- Modify: `tsconfig.build.json` (add `generator` reference)
- Modify: `vitest.config.ts` (add `@sentinel/generator` project + alias)

**Step 1: Create `packages/generator/package.json`**

```json
{
  "name": "@sentinel/generator",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc --build",
    "clean": "tsc --build --clean",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@sentinel/shared": "workspace:*",
    "@sentinel/analysis": "workspace:*",
    "@sentinel/discovery": "workspace:*",
    "prettier": "^3.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create `packages/generator/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }, { "path": "../analysis" }, { "path": "../discovery" }]
}
```

**Step 3: Create `packages/generator/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: '@sentinel/generator',
    environment: 'node',
    reporters: ['default', ['junit', { outputFile: './test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/__tests__/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@sentinel/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@sentinel/browser': resolve(__dirname, '../browser/src/index.ts'),
      '@sentinel/analysis': resolve(__dirname, '../analysis/src/index.ts'),
      '@sentinel/discovery': resolve(__dirname, '../discovery/src/index.ts'),
      '@sentinel/generator': resolve(__dirname, './src/index.ts'),
    },
  },
});
```

**Step 4: Create `packages/generator/src/types.ts`**

All domain types for the generator package. Uses types from `@sentinel/analysis` (`SelectorStrategy`) and `@sentinel/discovery` (`ActionType`).

```typescript
import type { SelectorStrategy } from '@sentinel/analysis';
import type { ActionType } from '@sentinel/discovery';

// ---------------------------------------------------------------------------
// Test case model
// ---------------------------------------------------------------------------

export type TestType = 'happy-path' | 'error-path' | 'edge-case';

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
  readonly expected: string | number | boolean;
  readonly confidence: number;
  readonly description: string;
}

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
// Test suite model
// ---------------------------------------------------------------------------

export interface TestSuite {
  readonly name: string;
  readonly fileName: string;
  readonly testCases: readonly TestCase[];
}

// ---------------------------------------------------------------------------
// Generation result
// ---------------------------------------------------------------------------

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
  complete(request: AiProviderRequest): Promise<AiProviderResponse>;
}

// ---------------------------------------------------------------------------
// Edge case context (fed to AI prompt)
// ---------------------------------------------------------------------------

export interface EdgeCaseContext {
  readonly pageTitle: string;
  readonly interactiveElements: readonly import('@sentinel/analysis').InteractiveElement[];
  readonly formConstraints: readonly import('@sentinel/analysis').FormModel[];
  readonly observedBehaviors: readonly import('@sentinel/analysis').StateTransition[];
  readonly existingTestNames: readonly string[];
}

// ---------------------------------------------------------------------------
// Data generator
// ---------------------------------------------------------------------------

export interface InvalidInput {
  readonly value: string;
  readonly violatedConstraint: string;
  readonly description: string;
}

export interface DataGeneratorStrategy {
  generateValid(field: import('@sentinel/analysis').FormField): string;
  generateInvalid(field: import('@sentinel/analysis').FormField): readonly InvalidInput[];
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

export interface EmittedFile {
  readonly fileName: string;
  readonly content: string;
  readonly checksum: string;
}

export interface TestEmitter {
  readonly formatName: OutputFormat;
  emit(suites: readonly TestSuite[]): Promise<readonly EmittedFile[]>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type GeneratorErrorCode =
  | 'INVALID_CONFIG'
  | 'EMPTY_EXPLORATION'
  | 'NO_JOURNEYS'
  | 'AI_PROVIDER_FAILURE'
  | 'AI_BUDGET_EXCEEDED'
  | 'AI_RESPONSE_MALFORMED'
  | 'EMIT_FAILURE'
  | 'FORMAT_FAILURE';

export interface GeneratorError {
  readonly code: GeneratorErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
```

**Step 5: Create `packages/generator/src/index.ts`**

Minimal barrel — just re-exports types for now. Each task will add module exports.

```typescript
// Types
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
```

**Step 6: Create `packages/generator/src/__tests__/types.test.ts`**

Structural type tests to verify all types are importable and correctly shaped.

```typescript
import { describe, it, expectTypeOf } from 'vitest';
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
  AiProvider,
  AiProviderRequest,
  AiProviderResponse,
  EdgeCaseContext,
  InvalidInput,
  DataGeneratorStrategy,
  EmittedFile,
  TestEmitter,
  GeneratorErrorCode,
  GeneratorError,
} from '@sentinel/generator';

describe('generator types', () => {
  it('TestType is a union of three values', () => {
    expectTypeOf<TestType>().toMatchTypeOf<'happy-path' | 'error-path' | 'edge-case'>();
  });

  it('AssertionType is a union of five values', () => {
    expectTypeOf<AssertionType>().toMatchTypeOf<
      'visibility' | 'text-content' | 'url-match' | 'element-count' | 'attribute-value'
    >();
  });

  it('TestAssertion has required fields', () => {
    expectTypeOf<TestAssertion>().toHaveProperty('type');
    expectTypeOf<TestAssertion>().toHaveProperty('selector');
    expectTypeOf<TestAssertion>().toHaveProperty('selectorStrategy');
    expectTypeOf<TestAssertion>().toHaveProperty('expected');
    expectTypeOf<TestAssertion>().toHaveProperty('confidence');
    expectTypeOf<TestAssertion>().toHaveProperty('description');
  });

  it('TestStep has required fields', () => {
    expectTypeOf<TestStep>().toHaveProperty('action');
    expectTypeOf<TestStep>().toHaveProperty('selector');
    expectTypeOf<TestStep>().toHaveProperty('selectorStrategy');
    expectTypeOf<TestStep>().toHaveProperty('description');
    expectTypeOf<TestStep>().toHaveProperty('assertions');
  });

  it('TestCase has required fields', () => {
    expectTypeOf<TestCase>().toHaveProperty('id');
    expectTypeOf<TestCase>().toHaveProperty('name');
    expectTypeOf<TestCase>().toHaveProperty('type');
    expectTypeOf<TestCase>().toHaveProperty('journeyId');
    expectTypeOf<TestCase>().toHaveProperty('suite');
    expectTypeOf<TestCase>().toHaveProperty('setupSteps');
    expectTypeOf<TestCase>().toHaveProperty('steps');
    expectTypeOf<TestCase>().toHaveProperty('teardownSteps');
    expectTypeOf<TestCase>().toHaveProperty('tags');
  });

  it('TestSuite has required fields', () => {
    expectTypeOf<TestSuite>().toHaveProperty('name');
    expectTypeOf<TestSuite>().toHaveProperty('fileName');
    expectTypeOf<TestSuite>().toHaveProperty('testCases');
  });

  it('GenerationResult has required fields', () => {
    expectTypeOf<GenerationResult>().toHaveProperty('suites');
    expectTypeOf<GenerationResult>().toHaveProperty('manifest');
    expectTypeOf<GenerationResult>().toHaveProperty('stats');
  });

  it('GeneratorConfig has required fields', () => {
    expectTypeOf<GeneratorConfig>().toHaveProperty('assertionDepth');
    expectTypeOf<GeneratorConfig>().toHaveProperty('dataStrategy');
    expectTypeOf<GeneratorConfig>().toHaveProperty('outputFormat');
    expectTypeOf<GeneratorConfig>().toHaveProperty('outputDir');
  });

  it('AiProvider has name and complete method', () => {
    expectTypeOf<AiProvider>().toHaveProperty('name');
    expectTypeOf<AiProvider>().toHaveProperty('complete');
  });

  it('GeneratorErrorCode is a union of error codes', () => {
    expectTypeOf<GeneratorErrorCode>().toMatchTypeOf<
      | 'INVALID_CONFIG'
      | 'EMPTY_EXPLORATION'
      | 'NO_JOURNEYS'
      | 'AI_PROVIDER_FAILURE'
      | 'AI_BUDGET_EXCEEDED'
      | 'AI_RESPONSE_MALFORMED'
      | 'EMIT_FAILURE'
      | 'FORMAT_FAILURE'
    >();
  });
});
```

**Step 7: Add path alias to root `tsconfig.json`**

Add `"@sentinel/generator": ["./packages/generator/src/index.ts"]` to `compilerOptions.paths`.

**Step 8: Add reference to `tsconfig.build.json`**

Add `{ "path": "./packages/generator" }` after the discovery reference and before cli.

**Step 9: Add project + alias to root `vitest.config.ts`**

Add `'@sentinel/generator': resolve(root, 'packages/generator/src/index.ts')` to aliases.
Add `{ extends: true, test: { name: '@sentinel/generator', include: ['packages/generator/src/**/*.test.ts'] } }` to projects array.

**Step 10: Run `pnpm install` to link the workspace package**

Run: `pnpm install`

**Step 11: Run tests to verify scaffolding**

Run: `pnpm exec vitest run --project @sentinel/generator`
Expected: All type tests PASS

**Step 12: Commit**

```
feat(generator): scaffold package with domain types (#6)
```

---

### Task 2: Configuration Module

**Files:**

- Create: `packages/generator/src/config/config.ts`
- Create: `packages/generator/src/config/index.ts`
- Create: `packages/generator/src/__tests__/config.test.ts`
- Modify: `packages/generator/src/index.ts` (add config exports)

**Step 1: Write `packages/generator/src/__tests__/config.test.ts`**

Tests for `loadGeneratorConfig()` and `validateConfig()`:

- Returns defaults when no overrides provided
- Overrides individual fields
- Validates `assertionDepth` accepts only `'minimal' | 'standard' | 'verbose'`
- Validates `dataStrategy` accepts only `'realistic' | 'boundary'`
- Validates `outputFormat` accepts only `'playwright-ts' | 'json'`
- Validates `ai.maxTokenBudget` must be positive
- Returns `GeneratorError` with code `'INVALID_CONFIG'` on invalid fields
- Merges partial `AiConfig` with defaults

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- config`
Expected: FAIL — modules not found

**Step 3: Implement `packages/generator/src/config/config.ts`**

```typescript
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
    return {
      code: 'INVALID_CONFIG',
      message: errors.join('; '),
    };
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
```

**Step 4: Create `packages/generator/src/config/index.ts`**

```typescript
export { loadGeneratorConfig, validateConfig } from './config.js';
```

**Step 5: Add config exports to `packages/generator/src/index.ts`**

```typescript
export { loadGeneratorConfig, validateConfig } from './config/index.js';
```

**Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run --project @sentinel/generator -- config`
Expected: PASS

**Step 7: Commit**

```
feat(generator): add configuration module (#54)
```

---

### Task 3: Data Generator + Strategies

**Files:**

- Create: `packages/generator/src/data/strategies.ts`
- Create: `packages/generator/src/data/data-generator.ts`
- Create: `packages/generator/src/data/index.ts`
- Create: `packages/generator/src/__tests__/data-generator.test.ts`
- Modify: `packages/generator/src/index.ts` (add data exports)

**Step 1: Write `packages/generator/src/__tests__/data-generator.test.ts`**

Tests for `RealisticDataStrategy` and `BoundaryDataStrategy`:

- `RealisticDataStrategy.generateValid()`:
  - Returns valid email for `inputType: 'email'`
  - Returns valid phone for `inputType: 'tel'`
  - Returns valid date string for `inputType: 'date'`
  - Returns string matching `pattern` constraint when present
  - Returns string within `minLength`/`maxLength` bounds
  - Returns number within `min`/`max` for `inputType: 'number'`
  - Returns `'P@ssw0rd123!'` for `inputType: 'password'`
  - Returns generic text for `inputType: 'text'` with no constraints
- `RealisticDataStrategy.generateInvalid()`:
  - Returns empty string for `required: true` with `violatedConstraint: 'required'`
  - Returns string shorter than `minLength` with `violatedConstraint: 'minLength'`
  - Returns string longer than `maxLength` with `violatedConstraint: 'maxLength'`
  - Returns value below `min` with `violatedConstraint: 'min'`
  - Returns value above `max` with `violatedConstraint: 'max'`
  - Returns empty array when field has no constraints
- `BoundaryDataStrategy.generateValid()`:
  - Returns exact `minLength` chars for text fields
  - Returns exact `min` for number fields
  - Returns shortest valid email for email fields
- `BoundaryDataStrategy.generateInvalid()`:
  - Same constraint violations as realistic strategy
- `generateTestData()`:
  - Populates `inputData` on form-submit steps matching form fields
  - Creates error-path clones with one invalid field each
  - Leaves non-form steps unchanged

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- data-generator`
Expected: FAIL

**Step 3: Implement `packages/generator/src/data/strategies.ts`**

Implement `RealisticDataStrategy` and `BoundaryDataStrategy` classes implementing `DataGeneratorStrategy`. Each has `generateValid(field: FormField): string` and `generateInvalid(field: FormField): readonly InvalidInput[]`.

**Step 4: Implement `packages/generator/src/data/data-generator.ts`**

```typescript
import type { FormModel } from '@sentinel/analysis';
import type { TestCase, GeneratorConfig, DataGeneratorStrategy } from '../types.js';
import { RealisticDataStrategy, BoundaryDataStrategy } from './strategies.js';

export function generateTestData(
  testCases: readonly TestCase[],
  forms: readonly FormModel[],
  config: GeneratorConfig,
): readonly TestCase[] {
  const strategy: DataGeneratorStrategy =
    config.dataStrategy === 'boundary' ? new BoundaryDataStrategy() : new RealisticDataStrategy();

  // For each happy-path test case with form-submit steps, populate inputData
  // For each form, generate error-path test cases (one per constraint violation)
  // Return combined array: original happy paths with data + new error paths
}
```

**Step 5: Create barrel and update index**

**Step 6: Run tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- data-generator`
Expected: PASS

**Step 7: Commit**

```
feat(generator): add data generation with realistic and boundary strategies (#51)
```

---

### Task 4: Confidence Scoring

**Files:**

- Create: `packages/generator/src/assertions/confidence.ts`
- Create: `packages/generator/src/__tests__/confidence.test.ts`

**Step 1: Write `packages/generator/src/__tests__/confidence.test.ts`**

Tests for `scoreConfidence()`:

- Returns `1.0` for URL changes (pre/post state URLs differ)
- Returns `1.0` for element added/removed in DomDiff
- Returns `1.0` for attribute toggle (e.g. `disabled` flip)
- Returns `0.8` for text content change that looks static (no digits, no timestamps)
- Returns `0.5` for text content containing numbers
- Returns `0.3` for text content matching timestamp/date patterns
- Returns `0.3` for text content matching UUID/random-id patterns

Tests for `filterByDepth()`:

- `'minimal'` filters to confidence >= 0.8
- `'standard'` filters to confidence >= 0.5
- `'verbose'` returns all assertions

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- confidence`
Expected: FAIL

**Step 3: Implement `packages/generator/src/assertions/confidence.ts`**

```typescript
import type { AssertionDepth, TestAssertion } from '../types.js';
import type { DomDiff, StateTransition } from '@sentinel/analysis';

export function scoreConfidence(transition: StateTransition): number {
  // URL change → 1.0
  // DomDiff added/removed → 1.0
  // Attribute toggle → 1.0
  // Static text change → 0.8
  // Text with numbers → 0.5
  // Text with timestamps/UUIDs → 0.3
}

export function filterByDepth(
  assertions: readonly TestAssertion[],
  depth: AssertionDepth,
): readonly TestAssertion[] {
  const thresholds: Record<AssertionDepth, number> = {
    minimal: 0.8,
    standard: 0.5,
    verbose: 0,
  };
  const threshold = thresholds[depth];
  return assertions.filter((a) => a.confidence >= threshold);
}
```

**Step 4: Run tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- confidence`
Expected: PASS

**Step 5: Commit**

```
feat(generator): add confidence scoring for assertions (#50)
```

---

### Task 5: Test Planner (Journey → TestCase)

**Files:**

- Create: `packages/generator/src/planner/planner.ts`
- Create: `packages/generator/src/planner/index.ts`
- Create: `packages/generator/src/__tests__/planner.test.ts`
- Modify: `packages/generator/src/index.ts` (add planner exports)

**Step 1: Write `packages/generator/src/__tests__/planner.test.ts`**

Build fixture data: an `ExplorationResult` with a graph containing 3 nodes (login page, dashboard, settings), 3 edges, and 2 journeys (authentication, content-navigation). A `StateTransitionGraph` with matching state transitions. A `FormModel[]` with a login form.

Tests for `planTestCases()`:

- Creates one `TestCase` per `UserJourney`
- Test case `name` is derived from `UserJourney.name`
- Test case `type` is `'happy-path'`
- Test case `journeyId` matches the journey's `id`
- Test case `steps` count matches journey `steps.length`
- Each step's `action` matches the `AppEdge.actionType`
- Each step's `selector` matches the `AppEdge.selector`
- `setupSteps` include navigation to entry node when entry != start URL
- `setupSteps` are empty when entry IS the start URL
- `teardownSteps` are empty for content-navigation journeys
- `suite` is derived from journey type (e.g. `'authentication'` → `'auth'`)
- Returns empty array when `ExplorationResult.journeys` is empty

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- planner`
Expected: FAIL

**Step 3: Implement `packages/generator/src/planner/planner.ts`**

```typescript
import type { ExplorationResult, UserJourney } from '@sentinel/discovery';
import type { StateTransitionGraph, FormModel } from '@sentinel/analysis';
import type { TestCase, TestStep, GeneratorConfig } from '../types.js';

export function planTestCases(
  result: ExplorationResult,
  stateGraph: StateTransitionGraph,
  forms: readonly FormModel[],
  config: GeneratorConfig,
): readonly TestCase[] {
  return result.journeys.map((journey) => journeyToTestCase(journey, result, stateGraph, forms));
}

function journeyToTestCase(
  journey: UserJourney,
  result: ExplorationResult,
  stateGraph: StateTransitionGraph,
  forms: readonly FormModel[],
): TestCase {
  // Map journey steps (AppEdge[]) → TestStep[]
  // Derive suite name from journey type
  // Generate setup steps (navigate to entry)
  // Generate teardown steps (empty for content-navigation)
  // Use StabilityAnalysis recommended selectors when available
}
```

**Step 4: Create barrel and update index**

**Step 5: Run tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- planner`
Expected: PASS

**Step 6: Commit**

```
feat(generator): add test planner for journey-to-testcase mapping (#49)
```

---

### Task 6: Assertion Generator

**Files:**

- Create: `packages/generator/src/assertions/assertion-generator.ts`
- Create: `packages/generator/src/assertions/index.ts`
- Create: `packages/generator/src/__tests__/assertion-generator.test.ts`
- Modify: `packages/generator/src/index.ts` (add assertion exports)

**Step 1: Write `packages/generator/src/__tests__/assertion-generator.test.ts`**

Build fixture data: `TestCase[]` from planner output, `StateTransitionGraph` with DOM diffs, `StabilizedElement[]` with selector candidates.

Tests for `generateAssertions()`:

- Adds `visibility` assertion when DomDiff has an added visible element
- Adds `visibility` (negated, `expected: false`) when DomDiff has a removed element
- Adds `text-content` assertion when DomDiff has a text modification
- Adds `attribute-value` assertion when DomDiff has an attribute change
- Adds `url-match` assertion when pre/post state URLs differ
- Adds `element-count` assertion when element count changes in DomDiff
- Uses `recommendedSelector` from `StabilizedElement` when element matches
- Falls back to `cssSelector` from `DomNode` when no stability analysis available
- Respects `assertionDepth: 'minimal'` — only high-confidence assertions
- Respects `assertionDepth: 'verbose'` — all assertions
- Adds `description` explaining each assertion origin
- Sets `confidence` using `scoreConfidence()` from the confidence module
- Returns test cases unchanged when no state transitions match

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- assertion-generator`
Expected: FAIL

**Step 3: Implement `packages/generator/src/assertions/assertion-generator.ts`**

```typescript
import type { StateTransitionGraph, StabilizedElement, DomDiff } from '@sentinel/analysis';
import type { TestCase, TestAssertion, GeneratorConfig } from '../types.js';
import { scoreConfidence, filterByDepth } from './confidence.js';

export function generateAssertions(
  testCases: readonly TestCase[],
  stateGraph: StateTransitionGraph,
  stabilizedElements: readonly StabilizedElement[],
  config: GeneratorConfig,
): readonly TestCase[] {
  // For each test case, find matching state transitions
  // For each transition's DomDiff, generate assertions
  // Apply confidence scoring
  // Filter by assertionDepth
  // Attach assertions to the corresponding step
}
```

**Step 4: Create barrel and update index**

**Step 5: Run tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- assertion-generator`
Expected: PASS

**Step 6: Commit**

```
feat(generator): add assertion generator from DOM diffs (#50)
```

---

### Task 7: AI Provider + Edge Case Generator

**Files:**

- Create: `packages/generator/src/ai/provider.ts`
- Create: `packages/generator/src/ai/prompt.ts`
- Create: `packages/generator/src/ai/edge-case-generator.ts`
- Create: `packages/generator/src/ai/index.ts`
- Create: `packages/generator/src/__tests__/prompt.test.ts`
- Create: `packages/generator/src/__tests__/edge-case-generator.test.ts`
- Modify: `packages/generator/src/index.ts` (add ai exports)

**Step 1: Write `packages/generator/src/__tests__/prompt.test.ts`**

Tests for `buildEdgeCasePrompt()`:

- Includes page title in prompt
- Includes interactive element descriptions
- Includes form constraint summaries
- Includes observed behavior descriptions
- Includes existing test names to avoid duplicates
- Uses custom `promptTemplate` from config when provided
- Stays within `maxTokens` parameter

Tests for `parseEdgeCaseResponse()`:

- Parses valid JSON array of edge case suggestions
- Returns empty array for malformed JSON
- Returns empty array for non-array JSON
- Validates each suggestion has required fields (description, steps, expectedOutcome)
- Discards suggestions missing required fields
- Truncates suggestions exceeding configured limit

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- prompt`
Expected: FAIL

**Step 3: Implement `packages/generator/src/ai/prompt.ts`**

Build the prompt template and response parser.

**Step 4: Implement `packages/generator/src/ai/provider.ts`**

```typescript
import type { AiProvider, AiProviderRequest, AiProviderResponse } from '../types.js';

export class NoOpAiProvider implements AiProvider {
  readonly name = 'no-op';
  async complete(_request: AiProviderRequest): Promise<AiProviderResponse> {
    return { content: '[]', tokensUsed: 0 };
  }
}
```

Note: `LiteLlmProvider` is deferred to a follow-up — the generic LLM client dependency needs user input on which package to use. The `NoOpAiProvider` and `AiProvider` interface are sufficient for all tests and for the pipeline to function with AI disabled.

**Step 5: Write `packages/generator/src/__tests__/edge-case-generator.test.ts`**

Tests for `generateEdgeCases()`:

- Returns original test cases + new edge case test cases from AI response
- Edge case test cases have `type: 'edge-case'`
- Edge case test cases have `tags` containing `'ai-generated'`
- Returns only original test cases when AI provider returns empty array
- Returns only original test cases when AI provider throws (non-fatal)
- Tracks token usage and stops when `maxTokenBudget` exceeded
- Returns `GeneratorError` info in result when budget exceeded (but still returns test cases)

**Step 6: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- edge-case-generator`
Expected: FAIL

**Step 7: Implement `packages/generator/src/ai/edge-case-generator.ts`**

```typescript
import type { TestCase, AiProvider, GeneratorConfig, EdgeCaseContext } from '../types.js';
import { buildEdgeCasePrompt, parseEdgeCaseResponse } from './prompt.js';

export async function generateEdgeCases(
  testCases: readonly TestCase[],
  context: EdgeCaseContext,
  provider: AiProvider,
  config: GeneratorConfig,
): Promise<readonly TestCase[]> {
  if (config.ai?.enabled !== true) return testCases;

  try {
    const prompt = buildEdgeCasePrompt(context, config);
    const response = await provider.complete({
      prompt,
      maxTokens: config.ai.maxTokenBudget,
    });
    const suggestions = parseEdgeCaseResponse(response.content);
    const edgeCases = suggestions.map((s) => suggestionToTestCase(s, context));
    return [...testCases, ...edgeCases];
  } catch {
    // AI failures are non-fatal — return original test cases
    return testCases;
  }
}
```

**Step 8: Create barrel and update index**

**Step 9: Run all AI tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- prompt edge-case-generator`
Expected: PASS

**Step 10: Commit**

```
feat(generator): add AI provider interface and edge case generator (#52)
```

---

### Task 8: Suite Organizer

**Files:**

- Create: `packages/generator/src/emitter/suite-organizer.ts`
- Create: `packages/generator/src/__tests__/suite-organizer.test.ts`

**Step 1: Write `packages/generator/src/__tests__/suite-organizer.test.ts`**

Tests for `groupIntoSuites()`:

- Groups test cases with `suite: 'auth'` into `auth.spec.ts`
- Groups test cases with `suite: 'checkout'` into `checkout.spec.ts`
- Multiple test cases in same suite appear in same `TestSuite`
- Suite `name` is title-cased from the suite slug
- Suite `fileName` is `<slug>.spec.ts`
- Test cases with same suite but different types are in the same suite
- Edge case tests have `[AI]` prefix in their name
- Empty input returns empty array

Tests for `slugifySuiteName()`:

- Converts `'Authentication Flow'` → `'authentication-flow'`
- Converts `'Checkout Page'` → `'checkout-page'`
- Strips special characters
- Converts spaces to hyphens
- Lowercases everything

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- suite-organizer`
Expected: FAIL

**Step 3: Implement `packages/generator/src/emitter/suite-organizer.ts`**

```typescript
import type { TestCase, TestSuite } from '../types.js';

export function groupIntoSuites(testCases: readonly TestCase[]): readonly TestSuite[] {
  const groups = new Map<string, TestCase[]>();
  for (const tc of testCases) {
    const key = tc.suite;
    const existing = groups.get(key) ?? [];
    existing.push(tc);
    groups.set(key, existing);
  }

  return [...groups.entries()].map(([slug, cases]) => ({
    name: titleCase(slug),
    fileName: `${slug}.spec.ts`,
    testCases: cases,
  }));
}

export function slugifySuiteName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
```

**Step 4: Run tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- suite-organizer`
Expected: PASS

**Step 5: Commit**

```
feat(generator): add suite organizer for test grouping (#53)
```

---

### Task 9: Playwright TypeScript Emitter

**Files:**

- Create: `packages/generator/src/emitter/playwright-ts.ts`
- Create: `packages/generator/src/emitter/emitter.ts`
- Create: `packages/generator/src/emitter/index.ts`
- Create: `packages/generator/src/__tests__/playwright-ts-emitter.test.ts`
- Modify: `packages/generator/src/index.ts` (add emitter exports)

**Step 1: Write `packages/generator/src/__tests__/playwright-ts-emitter.test.ts`**

Tests for `PlaywrightTsEmitter.emit()`:

- Generated code starts with `import { test, expect } from '@playwright/test';`
- Contains `test.describe('<suite name>', () => {` block
- Contains `test('<test name>', async ({ page }) => {` for each test case
- Generates `await page.goto('<url>')` for navigation setup steps
- Generates `await page.click('<selector>')` for click actions
- Generates `await page.fill('<selector>', '<value>')` for form-submit with inputData
- Generates `await expect(page.locator('<selector>')).toBeVisible()` for visibility assertions
- Generates `await expect(page.locator('<selector>')).toHaveText('<text>')` for text-content assertions
- Generates `await expect(page).toHaveURL('<url>')` for url-match assertions
- Adds `// LOW CONFIDENCE` comment for assertions with confidence < 0.5
- Adds `// Observed: <description>` comment for each assertion
- Output is formatted with Prettier (valid TypeScript, consistent indentation)
- Returns `EmittedFile` with `fileName`, `content`, and `checksum`
- Checksum is a SHA-256 hex hash of the content

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- playwright-ts-emitter`
Expected: FAIL

**Step 3: Implement `packages/generator/src/emitter/emitter.ts`**

```typescript
export type { TestEmitter, EmittedFile } from '../types.js';
```

**Step 4: Implement `packages/generator/src/emitter/playwright-ts.ts`**

```typescript
import { createHash } from 'node:crypto';
import { format } from 'prettier';
import type {
  TestSuite,
  EmittedFile,
  TestEmitter,
  OutputFormat,
  TestCase,
  TestStep,
  TestAssertion,
} from '../types.js';

export class PlaywrightTsEmitter implements TestEmitter {
  readonly formatName: OutputFormat = 'playwright-ts';

  async emit(suites: readonly TestSuite[]): Promise<readonly EmittedFile[]> {
    const files: EmittedFile[] = [];
    for (const suite of suites) {
      const raw = this.renderSuite(suite);
      let content: string;
      try {
        content = await format(raw, {
          parser: 'typescript',
          singleQuote: true,
          semi: true,
          tabWidth: 2,
          trailingComma: 'all',
        });
      } catch {
        content = raw; // Prettier failure fallback
      }
      const checksum = createHash('sha256').update(content).digest('hex');
      files.push({ fileName: suite.fileName, content, checksum });
    }
    return files;
  }

  private renderSuite(suite: TestSuite): string {
    /* ... */
  }
  private renderTestCase(tc: TestCase): string {
    /* ... */
  }
  private renderStep(step: TestStep): string {
    /* ... */
  }
  private renderAssertion(assertion: TestAssertion): string {
    /* ... */
  }
}
```

**Step 5: Create barrel and update index**

**Step 6: Run tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- playwright-ts-emitter`
Expected: PASS

**Step 7: Commit**

```
feat(generator): add Playwright TypeScript emitter (#53)
```

---

### Task 10: JSON Emitter

**Files:**

- Create: `packages/generator/src/emitter/json-emitter.ts`
- Create: `packages/generator/src/__tests__/json-emitter.test.ts`
- Modify: `packages/generator/src/emitter/index.ts` (add JSON emitter export)

**Step 1: Write `packages/generator/src/__tests__/json-emitter.test.ts`**

Tests for `JsonEmitter.emit()`:

- Output is valid JSON
- JSON structure contains `suites` array matching input
- Each suite has `name`, `fileName`, `testCases`
- Test cases retain all fields (id, name, type, steps, assertions, etc.)
- Returns `EmittedFile` with `fileName` ending in `.json`
- Checksum is a SHA-256 hex hash of the content

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- json-emitter`
Expected: FAIL

**Step 3: Implement `packages/generator/src/emitter/json-emitter.ts`**

```typescript
import { createHash } from 'node:crypto';
import type { TestSuite, EmittedFile, TestEmitter, OutputFormat } from '../types.js';

export class JsonEmitter implements TestEmitter {
  readonly formatName: OutputFormat = 'json';

  async emit(suites: readonly TestSuite[]): Promise<readonly EmittedFile[]> {
    const content = JSON.stringify({ suites }, null, 2);
    const checksum = createHash('sha256').update(content).digest('hex');
    return [{ fileName: 'sentinel-tests.json', content, checksum }];
  }
}
```

**Step 4: Update barrel**

**Step 5: Run tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- json-emitter`
Expected: PASS

**Step 6: Commit**

```
feat(generator): add JSON emitter (#54)
```

---

### Task 11: Orchestrator (`generate()`)

**Files:**

- Create: `packages/generator/src/orchestrator/generate.ts`
- Create: `packages/generator/src/orchestrator/index.ts`
- Create: `packages/generator/src/__tests__/generate.test.ts`
- Modify: `packages/generator/src/index.ts` (add orchestrator exports)

**Step 1: Write `packages/generator/src/__tests__/generate.test.ts`**

Integration test with realistic fixture data. Build a complete `ExplorationResult` with graph, journeys, a `StateTransitionGraph` with diffs, `FormModel[]`, `StabilizedElement[]`.

Tests for `generate()`:

- Returns `GenerationResult` with `suites`, `manifest`, `stats`
- `stats.totalTests` equals sum of happy + error + edge case tests
- `stats.happyPathTests` matches number of journeys
- `stats.errorPathTests` matches number of form constraint violations
- `manifest.files` lists all emitted files
- `manifest.generatedAt` is a timestamp
- Each `ManifestEntry.journeyIds` contains the journey IDs for that suite
- Generated suites contain valid test cases with assertions
- Works with `outputFormat: 'playwright-ts'`
- Works with `outputFormat: 'json'`
- Returns `GeneratorError` with `'NO_JOURNEYS'` when exploration has no journeys
- Works without AI provider (edge cases skipped)
- Works with `NoOpAiProvider` (no edge cases added)
- Config validation errors are returned before processing

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run --project @sentinel/generator -- generate`
Expected: FAIL

**Step 3: Implement `packages/generator/src/orchestrator/generate.ts`**

```typescript
import type { ExplorationResult } from '@sentinel/discovery';
import type { StateTransitionGraph, FormModel, StabilizedElement } from '@sentinel/analysis';
import type {
  GeneratorConfig,
  AiProvider,
  GenerationResult,
  GeneratorError,
  TestManifest,
  GenerationStats,
} from '../types.js';
import { validateConfig } from '../config/index.js';
import { planTestCases } from '../planner/index.js';
import { generateTestData } from '../data/index.js';
import { generateAssertions } from '../assertions/index.js';
import { generateEdgeCases } from '../ai/index.js';
import { groupIntoSuites } from '../emitter/suite-organizer.js';
import { PlaywrightTsEmitter } from '../emitter/playwright-ts.js';
import { JsonEmitter } from '../emitter/json-emitter.js';

export async function generate(
  explorationResult: ExplorationResult,
  stateGraph: StateTransitionGraph,
  forms: readonly FormModel[],
  stabilizedElements: readonly StabilizedElement[],
  config: GeneratorConfig,
  aiProvider?: AiProvider,
): Promise<GenerationResult | GeneratorError> {
  // 1. Validate config
  const configError = validateConfig(config);
  if (configError !== null) return configError;

  // 2. Check for journeys
  if (explorationResult.journeys.length === 0) {
    return { code: 'NO_JOURNEYS', message: 'Exploration produced no user journeys' };
  }

  // 3. Plan
  let testCases = planTestCases(explorationResult, stateGraph, forms, config);

  // 4. Generate data
  testCases = generateTestData(testCases, forms, config);

  // 5. Generate assertions
  testCases = generateAssertions(testCases, stateGraph, stabilizedElements, config);

  // 6. Generate edge cases (optional)
  if (aiProvider !== undefined) {
    const context = buildEdgeCaseContext(explorationResult, forms, stateGraph, testCases);
    testCases = await generateEdgeCases(testCases, context, aiProvider, config);
  }

  // 7. Organize into suites
  const suites = groupIntoSuites(testCases);

  // 8. Emit
  const emitter = config.outputFormat === 'json' ? new JsonEmitter() : new PlaywrightTsEmitter();
  const files = await emitter.emit(suites);

  // 9. Build manifest and stats
  const manifest: TestManifest = {
    generatedAt: Date.now(),
    files: files.map((f) => ({
      fileName: f.fileName,
      journeyIds: suites
        .filter((s) => s.fileName === f.fileName)
        .flatMap((s) => s.testCases.map((tc) => tc.journeyId)),
      testCount: suites
        .filter((s) => s.fileName === f.fileName)
        .reduce((sum, s) => sum + s.testCases.length, 0),
      checksum: f.checksum,
    })),
  };

  const stats: GenerationStats = {
    totalTests: testCases.length,
    happyPathTests: testCases.filter((tc) => tc.type === 'happy-path').length,
    errorPathTests: testCases.filter((tc) => tc.type === 'error-path').length,
    edgeCaseTests: testCases.filter((tc) => tc.type === 'edge-case').length,
    totalAssertions: testCases.reduce(
      (sum, tc) => sum + tc.steps.reduce((s, step) => s + step.assertions.length, 0),
      0,
    ),
    lowConfidenceAssertions: testCases.reduce(
      (sum, tc) =>
        sum +
        tc.steps.reduce(
          (s, step) => s + step.assertions.filter((a) => a.confidence < 0.5).length,
          0,
        ),
      0,
    ),
  };

  return { suites, manifest, stats };
}
```

**Step 4: Create barrel and update index**

**Step 5: Run tests**

Run: `pnpm exec vitest run --project @sentinel/generator -- generate`
Expected: PASS

**Step 6: Run full test suite**

Run: `pnpm exec vitest run --project @sentinel/generator`
Expected: ALL PASS

**Step 7: Commit**

```
feat(generator): add pipeline orchestrator (#6)
```

---

### Task 12: Integration — Barrel Exports + CLAUDE.md

**Files:**

- Modify: `packages/generator/src/index.ts` (final barrel with all exports)
- Modify: `CLAUDE.md` (add generator package to directory structure)

**Step 1: Finalize `packages/generator/src/index.ts`**

Ensure all public API is exported:

```typescript
// Types
export type {} from /* all types from types.ts */ './types.js';

// Config
export { loadGeneratorConfig, validateConfig } from './config/index.js';

// Planner
export { planTestCases } from './planner/index.js';

// Data generation
export { generateTestData } from './data/index.js';
export { RealisticDataStrategy, BoundaryDataStrategy } from './data/strategies.js';

// Assertions
export { generateAssertions } from './assertions/index.js';
export { scoreConfidence, filterByDepth } from './assertions/confidence.js';

// AI
export { generateEdgeCases } from './ai/index.js';
export { NoOpAiProvider } from './ai/provider.js';
export { buildEdgeCasePrompt, parseEdgeCaseResponse } from './ai/prompt.js';

// Emitter
export { PlaywrightTsEmitter } from './emitter/playwright-ts.js';
export { JsonEmitter } from './emitter/json-emitter.js';
export { groupIntoSuites, slugifySuiteName } from './emitter/suite-organizer.js';

// Orchestrator
export { generate } from './orchestrator/index.js';
```

**Step 2: Update `CLAUDE.md`**

Add the `generator` package to the annotated directory structure:

```
│   ├── generator/        # @sentinel/generator — test generation pipeline (depends on shared + analysis + discovery)
│   │   └── src/
│   │       ├── index.ts          # Public API: types, config, planner, data, assertions, ai, emitter, orchestrator
│   │       ├── types.ts          # All generator domain types: TestCase, TestSuite, GeneratorConfig, AiProvider, etc.
│   │       ├── config/
│   │       │   ├── config.ts     # loadGeneratorConfig(), validateConfig()
│   │       │   └── index.ts      # Barrel re-export for config/
│   │       ├── planner/
│   │       │   ├── planner.ts    # planTestCases() — journeys → TestCase outlines
│   │       │   └── index.ts      # Barrel re-export for planner/
│   │       ├── data/
│   │       │   ├── data-generator.ts  # generateTestData() — fills form steps with valid/invalid data
│   │       │   ├── strategies.ts      # RealisticDataStrategy, BoundaryDataStrategy
│   │       │   └── index.ts           # Barrel re-export for data/
│   │       ├── assertions/
│   │       │   ├── assertion-generator.ts  # generateAssertions() — DomDiff → assertions
│   │       │   ├── confidence.ts           # scoreConfidence(), filterByDepth()
│   │       │   └── index.ts               # Barrel re-export for assertions/
│   │       ├── ai/
│   │       │   ├── edge-case-generator.ts  # generateEdgeCases() — AI edge case suggestions
│   │       │   ├── provider.ts             # AiProvider interface, NoOpAiProvider
│   │       │   ├── prompt.ts               # buildEdgeCasePrompt(), parseEdgeCaseResponse()
│   │       │   └── index.ts               # Barrel re-export for ai/
│   │       ├── emitter/
│   │       │   ├── emitter.ts              # TestEmitter interface re-export
│   │       │   ├── playwright-ts.ts        # PlaywrightTsEmitter — Playwright TypeScript output
│   │       │   ├── json-emitter.ts         # JsonEmitter — Sentinel JSON output
│   │       │   ├── suite-organizer.ts      # groupIntoSuites(), slugifySuiteName()
│   │       │   └── index.ts               # Barrel re-export for emitter/
│   │       ├── orchestrator/
│   │       │   ├── generate.ts             # generate() — full pipeline orchestrator
│   │       │   └── index.ts               # Barrel re-export for orchestrator/
│   │       └── __tests__/
│   │           ├── types.test.ts                  # Type structural tests
│   │           ├── config.test.ts                 # Config validation unit tests
│   │           ├── data-generator.test.ts         # Data generation unit tests
│   │           ├── confidence.test.ts             # Confidence scoring unit tests
│   │           ├── planner.test.ts                # Test planner unit tests
│   │           ├── assertion-generator.test.ts    # Assertion generator unit tests
│   │           ├── prompt.test.ts                 # AI prompt construction/parsing unit tests
│   │           ├── edge-case-generator.test.ts    # Edge case generator unit tests
│   │           ├── suite-organizer.test.ts        # Suite organizer unit tests
│   │           ├── playwright-ts-emitter.test.ts  # Playwright TS emitter unit tests
│   │           ├── json-emitter.test.ts           # JSON emitter unit tests
│   │           └── generate.test.ts               # Pipeline orchestrator integration test
```

**Step 3: Run full workspace typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Run full workspace tests**

Run: `pnpm test`
Expected: ALL PASS

**Step 5: Run lint and format**

Run: `pnpm lint`
Run: `pnpm format`
Expected: PASS

**Step 6: Commit**

```
feat(generator): finalize barrel exports and update CLAUDE.md (#6)
```
