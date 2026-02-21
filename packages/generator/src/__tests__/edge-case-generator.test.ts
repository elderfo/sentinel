import { describe, it, expect } from 'vitest';
import type { DomNode, InteractiveElement, FieldConstraints } from '@sentinel/analysis';
import type {
  AiProvider,
  AiProviderResponse,
  EdgeCaseContext,
  GeneratorConfig,
  TestCase,
} from '@sentinel/generator';
import { generateEdgeCases } from '@sentinel/generator';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeDomNode(overrides: Partial<DomNode> = {}): DomNode {
  return {
    tag: 'button',
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: null,
    isVisible: true,
    xpath: '/html/body/button',
    cssSelector: 'button',
    ...overrides,
  };
}

function makeInteractiveElement(overrides: Partial<InteractiveElement> = {}): InteractiveElement {
  return {
    node: makeDomNode(),
    category: 'button',
    isDisabled: false,
    accessibilityInfo: null,
    ...overrides,
  };
}

function makeFieldConstraints(overrides: Partial<FieldConstraints> = {}): FieldConstraints {
  return {
    required: false,
    pattern: null,
    min: null,
    max: null,
    minLength: null,
    maxLength: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<EdgeCaseContext> = {}): EdgeCaseContext {
  return {
    pageTitle: 'Login Page',
    interactiveElements: [makeInteractiveElement()],
    formConstraints: [makeFieldConstraints({ required: true })],
    observedBehaviors: ['Shows error on invalid password'],
    existingTestNames: ['Login happy path'],
    ...overrides,
  };
}

function makeConfig(overrides: Partial<GeneratorConfig> = {}): GeneratorConfig {
  return {
    assertionDepth: 'standard',
    dataStrategy: 'realistic',
    outputFormat: 'playwright-ts',
    outputDir: './output',
    ...overrides,
  };
}

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'test-1',
    name: 'Existing test',
    type: 'happy-path',
    journeyId: 'journey-1',
    suite: 'login',
    setupSteps: [],
    steps: [],
    teardownSteps: [],
    tags: [],
    ...overrides,
  };
}

const validSuggestions = [
  {
    name: 'Test empty form',
    steps: [
      { action: 'click', selector: '#submit', description: 'Click submit without filling form' },
    ],
    expectedOutcome: 'Shows validation errors',
  },
];

const mockProvider: AiProvider = {
  name: 'mock',
  complete: (): Promise<AiProviderResponse> =>
    Promise.resolve({
      content: JSON.stringify(validSuggestions),
      tokensUsed: 100,
    }),
};

const emptyMockProvider: AiProvider = {
  name: 'empty-mock',
  complete: (): Promise<AiProviderResponse> =>
    Promise.resolve({
      content: '[]',
      tokensUsed: 0,
    }),
};

const throwingProvider: AiProvider = {
  name: 'throwing',
  complete: (): Promise<AiProviderResponse> => Promise.reject(new Error('AI service unavailable')),
};

// ---------------------------------------------------------------------------
// generateEdgeCases
// ---------------------------------------------------------------------------

describe('generateEdgeCases', () => {
  it('returns original test cases unchanged when ai.enabled is false', async () => {
    const existing = [makeTestCase()];
    const config = makeConfig({ ai: { enabled: false, maxTokenBudget: 500 } });
    const result = await generateEdgeCases(existing, makeContext(), mockProvider, config);
    expect(result).toEqual(existing);
  });

  it('returns original test cases unchanged when ai is undefined', async () => {
    const existing = [makeTestCase()];
    const config = makeConfig();
    const result = await generateEdgeCases(existing, makeContext(), mockProvider, config);
    expect(result).toEqual(existing);
  });

  it('returns original plus new edge case test cases from AI response', async () => {
    const existing = [makeTestCase()];
    const config = makeConfig({ ai: { enabled: true, maxTokenBudget: 500 } });
    const result = await generateEdgeCases(existing, makeContext(), mockProvider, config);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(existing[0]);
  });

  it('edge case test cases have type edge-case', async () => {
    const config = makeConfig({ ai: { enabled: true, maxTokenBudget: 500 } });
    const result = await generateEdgeCases([], makeContext(), mockProvider, config);
    expect(result[0]?.type).toBe('edge-case');
  });

  it('edge case test cases have tags containing ai-generated', async () => {
    const config = makeConfig({ ai: { enabled: true, maxTokenBudget: 500 } });
    const result = await generateEdgeCases([], makeContext(), mockProvider, config);
    expect(result[0]?.tags).toContain('ai-generated');
  });

  it('edge case names are prefixed with [AI]', async () => {
    const config = makeConfig({ ai: { enabled: true, maxTokenBudget: 500 } });
    const result = await generateEdgeCases([], makeContext(), mockProvider, config);
    expect(result[0]?.name).toBe('[AI] Test empty form');
  });

  it('returns only original test cases when AI provider returns empty array', async () => {
    const existing = [makeTestCase()];
    const config = makeConfig({ ai: { enabled: true, maxTokenBudget: 500 } });
    const result = await generateEdgeCases(existing, makeContext(), emptyMockProvider, config);
    expect(result).toEqual(existing);
  });

  it('returns only original test cases when AI provider throws error', async () => {
    const existing = [makeTestCase()];
    const config = makeConfig({ ai: { enabled: true, maxTokenBudget: 500 } });
    const result = await generateEdgeCases(existing, makeContext(), throwingProvider, config);
    expect(result).toEqual(existing);
  });
});
