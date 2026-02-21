# Test Generation Engine Design

**Goal:** Build the test generation pipeline that transforms discovered application models into executable, human-readable test suites — covering happy paths, error paths, and AI-identified edge cases — without human intervention.

**Architecture:** Pipeline of pure functions. Each stage transforms the `ExplorationResult` into progressively richer test representations. AI-powered edge case generation is optional and non-fatal. Output is emitted as Playwright TypeScript or Sentinel-native JSON, formatted with Prettier.

**Tech Stack:** TypeScript strict mode, `@sentinel/discovery` for journeys and graph, `@sentinel/analysis` for DOM diffs/forms/selectors, `prettier` for code formatting, generic LLM client for AI edge cases.

---

## Package Structure

New package: `@sentinel/generator` — depends on `@sentinel/shared`, `@sentinel/analysis`, `@sentinel/discovery`, `prettier`.

```
packages/generator/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts           # Public API barrel
    ├── types.ts           # All generator domain types
    ├── config/
    │   ├── config.ts      # loadGeneratorConfig(), validateConfig()
    │   └── index.ts       # Barrel re-export
    ├── planner/
    │   ├── planner.ts     # planTestCases() — journeys → TestCase outlines
    │   └── index.ts       # Barrel re-export
    ├── data/
    │   ├── data-generator.ts  # generateTestData() — fills form steps with valid/invalid data
    │   ├── strategies.ts      # RealisticDataStrategy, BoundaryDataStrategy
    │   └── index.ts           # Barrel re-export
    ├── assertions/
    │   ├── assertion-generator.ts  # generateAssertions() — DomDiff → TestAssertion[]
    │   ├── confidence.ts           # scoreConfidence() — determinism scoring
    │   └── index.ts                # Barrel re-export
    ├── ai/
    │   ├── edge-case-generator.ts  # generateEdgeCases() — AI-powered edge case suggestions
    │   ├── provider.ts             # AiProvider interface, NoOpAiProvider, LiteLlmProvider
    │   ├── prompt.ts               # buildEdgeCasePrompt(), parseEdgeCaseResponse()
    │   └── index.ts                # Barrel re-export
    ├── emitter/
    │   ├── emitter.ts              # TestEmitter interface
    │   ├── playwright-ts.ts        # PlaywrightTsEmitter — renders Playwright TypeScript
    │   ├── json-emitter.ts         # JsonEmitter — renders Sentinel JSON format
    │   ├── suite-organizer.ts      # groupIntoSuites() — groups TestCases by functional area
    │   └── index.ts                # Barrel re-export
    ├── orchestrator/
    │   ├── generate.ts             # generate() — chains the full pipeline
    │   └── index.ts                # Barrel re-export
    └── __tests__/
        ├── config.test.ts
        ├── planner.test.ts
        ├── data-generator.test.ts
        ├── assertion-generator.test.ts
        ├── confidence.test.ts
        ├── edge-case-generator.test.ts
        ├── prompt.test.ts
        ├── playwright-ts-emitter.test.ts
        ├── json-emitter.test.ts
        ├── suite-organizer.test.ts
        └── generate.test.ts
```

## Pipeline Architecture

```
ExplorationResult + GeneratorConfig
        │
        ▼
   ┌──────────┐
   │  Planner  │  Journey → TestCase outlines (steps, no data, no assertions)
   └─────┬─────┘
         ▼
   ┌──────────┐
   │  DataGen  │  Fills form steps with valid/invalid data from FieldConstraints
   └─────┬─────┘
         ▼
   ┌──────────┐
   │ Asserter  │  Maps DomDiff + state transitions → TestAssertions on each step
   └─────┬─────┘
         ▼
   ┌──────────┐
   │ EdgeCase  │  (optional) Calls AiProvider to suggest additional test cases
   └─────┬─────┘
         ▼
   ┌──────────┐
   │  Emitter  │  Renders TestSuite[] → Playwright TS or JSON, formats with Prettier
   └──────────┘
```

### Stage Signatures

```typescript
// 1. Planner — Story #49
function planTestCases(
  result: ExplorationResult,
  stateGraph: StateTransitionGraph,
  forms: readonly FormModel[],
  config: GeneratorConfig,
): readonly TestCase[];

// 2. DataGenerator — Story #51
function generateTestData(
  testCases: readonly TestCase[],
  forms: readonly FormModel[],
  config: GeneratorConfig,
): readonly TestCase[];

// 3. AssertionGenerator — Story #50
function generateAssertions(
  testCases: readonly TestCase[],
  stateGraph: StateTransitionGraph,
  stabilizedElements: readonly StabilizedElement[],
  config: GeneratorConfig,
): readonly TestCase[];

// 4. EdgeCaseGenerator — Story #52
async function generateEdgeCases(
  testCases: readonly TestCase[],
  context: EdgeCaseContext,
  provider: AiProvider,
  config: GeneratorConfig,
): Promise<readonly TestCase[]>;

// 5. Emitter — Stories #53, #54
async function emitTestSuites(
  testCases: readonly TestCase[],
  config: GeneratorConfig,
): Promise<GenerationResult>;
```

### Orchestrator

```typescript
async function generate(
  explorationResult: ExplorationResult,
  stateGraph: StateTransitionGraph,
  forms: readonly FormModel[],
  stabilizedElements: readonly StabilizedElement[],
  config: GeneratorConfig,
  aiProvider?: AiProvider,
): Promise<GenerationResult>;
```

## Core Types

### Test Case Model

```typescript
type TestType = 'happy-path' | 'error-path' | 'edge-case';
type AssertionType =
  | 'visibility'
  | 'text-content'
  | 'url-match'
  | 'element-count'
  | 'attribute-value';

interface TestAssertion {
  readonly type: AssertionType;
  readonly selector: string;
  readonly selectorStrategy: SelectorStrategy;
  readonly expected: string | number | boolean;
  readonly confidence: number;
  readonly description: string;
}

interface TestStep {
  readonly action: ActionType;
  readonly selector: string;
  readonly selectorStrategy: SelectorStrategy;
  readonly description: string;
  readonly inputData?: Record<string, string>;
  readonly assertions: readonly TestAssertion[];
}

interface TestCase {
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

interface TestSuite {
  readonly name: string;
  readonly fileName: string;
  readonly testCases: readonly TestCase[];
}

interface GenerationResult {
  readonly suites: readonly TestSuite[];
  readonly manifest: TestManifest;
  readonly stats: GenerationStats;
}

interface TestManifest {
  readonly generatedAt: number;
  readonly files: readonly ManifestEntry[];
}

interface ManifestEntry {
  readonly fileName: string;
  readonly journeyIds: readonly string[];
  readonly testCount: number;
  readonly checksum: string;
}

interface GenerationStats {
  readonly totalTests: number;
  readonly happyPathTests: number;
  readonly errorPathTests: number;
  readonly edgeCaseTests: number;
  readonly totalAssertions: number;
  readonly lowConfidenceAssertions: number;
}
```

### Configuration

```typescript
type AssertionDepth = 'minimal' | 'standard' | 'verbose';
type DataStrategy = 'realistic' | 'boundary';
type OutputFormat = 'playwright-ts' | 'json';

interface GeneratorConfig {
  readonly assertionDepth: AssertionDepth;
  readonly dataStrategy: DataStrategy;
  readonly outputFormat: OutputFormat;
  readonly outputDir: string;
  readonly ai?: AiConfig;
}

interface AiConfig {
  readonly enabled: boolean;
  readonly maxTokenBudget: number;
  readonly promptTemplate?: string;
  readonly model?: string;
}
```

Defaults: `assertionDepth: 'standard'`, `dataStrategy: 'realistic'`, `outputFormat: 'playwright-ts'`, `outputDir: './sentinel-tests'`, `ai.enabled: false`, `ai.maxTokenBudget: 100000`.

### AI Provider Interface

```typescript
interface AiProviderRequest {
  readonly prompt: string;
  readonly maxTokens: number;
}

interface AiProviderResponse {
  readonly content: string;
  readonly tokensUsed: number;
}

interface AiProvider {
  readonly name: string;
  complete(request: AiProviderRequest): Promise<AiProviderResponse>;
}

interface EdgeCaseContext {
  readonly pageTitle: string;
  readonly interactiveElements: readonly InteractiveElement[];
  readonly formConstraints: readonly FormModel[];
  readonly observedBehaviors: readonly StateTransition[];
  readonly existingTestNames: readonly string[];
}
```

Ships with `LiteLlmProvider` (generic LLM client) and `NoOpAiProvider` (testing/disabled). See #122 for BYOM story.

### Data Generation

```typescript
interface DataGenerator {
  generateValid(field: FormField): string;
  generateInvalid(field: FormField): readonly InvalidInput[];
}

interface InvalidInput {
  readonly value: string;
  readonly violatedConstraint: string;
  readonly description: string;
}
```

Two strategies: `RealisticDataStrategy` (contextual plausible data) and `BoundaryDataStrategy` (min/max boundary values).

## Selector Priority

Uses `StabilityAnalysis` from `@sentinel/analysis`. Priority order:

1. `data-testid` — highest stability
2. `aria-label` / accessible name — semantic
3. CSS selector — fallback
4. XPath — last resort

## Assertion Mapping

| DomDiff Change                  | Assertion Type                | Example                    |
| ------------------------------- | ----------------------------- | -------------------------- |
| Element added with visible text | `visibility` + `text-content` | Success message appears    |
| Element removed                 | `visibility` (negated)        | Loading spinner disappears |
| Text content changed            | `text-content`                | Counter updates to 5       |
| Attribute changed               | `attribute-value`             | Button becomes disabled    |
| URL changed                     | `url-match`                   | Redirects to /dashboard    |
| Element count changed           | `element-count`               | Cart shows 3 items         |

### Confidence Scoring

- **1.0** — Deterministic: URL changes, element added/removed, attribute toggled
- **0.7-0.9** — Likely deterministic: static-looking text content
- **0.3-0.6** — Possibly dynamic: text with numbers, dates, random patterns
- **Below 0.5** — Flagged with `// LOW CONFIDENCE` comment

Filtering by `assertionDepth`: `minimal` (>= 0.8), `standard` (>= 0.5), `verbose` (all).

## Suite Organization

Grouping strategy:

1. By journey type: `authentication` → `auth.spec.ts`
2. By URL path segment: `/checkout/*` → `checkout.spec.ts`
3. Fallback: entry node page title slugified

Test naming: human-readable from `UserJourney.name`. Edge case tests prefixed with `[AI]`.

### Manifest

`sentinel-test-manifest.json` maps files to journey IDs. Re-generation overwrites only affected files by comparing journey checksums.

## Error Handling

```typescript
type GeneratorErrorCode =
  | 'INVALID_CONFIG'
  | 'EMPTY_EXPLORATION'
  | 'NO_JOURNEYS'
  | 'AI_PROVIDER_FAILURE'
  | 'AI_BUDGET_EXCEEDED'
  | 'AI_RESPONSE_MALFORMED'
  | 'EMIT_FAILURE'
  | 'FORMAT_FAILURE';

interface GeneratorError {
  readonly code: GeneratorErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
```

- AI failures are non-fatal — pipeline continues without edge cases
- Empty exploration produces `NO_JOURNEYS` error
- Prettier failures fall back to unformatted output with warning
- Config validation fails fast with `INVALID_CONFIG`

## Story Mapping

| Story                      | Pipeline Stage    | Key Files                                                                           |
| -------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| #49 — Journey test cases   | Planner           | `planner/planner.ts`                                                                |
| #50 — Assertion generation | Asserter          | `assertions/assertion-generator.ts`, `assertions/confidence.ts`                     |
| #51 — Happy/error paths    | DataGenerator     | `data/data-generator.ts`, `data/strategies.ts`                                      |
| #52 — AI edge cases        | EdgeCaseGenerator | `ai/edge-case-generator.ts`, `ai/provider.ts`, `ai/prompt.ts`                       |
| #53 — Suite organization   | Emitter           | `emitter/suite-organizer.ts`, `emitter/playwright-ts.ts`, `emitter/json-emitter.ts` |
| #54 — Configuration        | Config            | `config/config.ts`                                                                  |
| #122 — BYOM                | AI Provider       | `ai/provider.ts` (interface)                                                        |
