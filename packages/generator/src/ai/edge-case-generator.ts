import type { TestCase, TestStep, AiProvider, GeneratorConfig, EdgeCaseContext } from '../types.js';
import type { EdgeCaseSuggestion } from './prompt.js';
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
    const edgeCases = suggestions.map((s, i) => suggestionToTestCase(s, context, i));
    return [...testCases, ...edgeCases];
  } catch {
    // AI failures are non-fatal — return original test cases
    return testCases;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function suggestionToTestCase(
  suggestion: EdgeCaseSuggestion,
  context: EdgeCaseContext,
  index: number,
): TestCase {
  const steps: readonly TestStep[] = suggestion.steps.map((s) => ({
    action: 'click' as const,
    selector: s.selector,
    selectorStrategy: 'css' as const,
    description: s.description,
    assertions: [],
  }));

  return {
    id: `edge-case-${String(index)}`,
    name: `[AI] ${suggestion.name}`,
    type: 'edge-case',
    journeyId: 'ai-generated',
    suite: slugify(context.pageTitle),
    setupSteps: [],
    steps,
    teardownSteps: [],
    tags: ['ai-generated'],
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
