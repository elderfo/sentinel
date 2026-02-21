import type { EdgeCaseContext, GeneratorConfig } from '../types.js';

export interface EdgeCaseSuggestion {
  readonly name: string;
  readonly steps: readonly {
    readonly action: string;
    readonly selector: string;
    readonly description: string;
  }[];
  readonly expectedOutcome: string;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

export function buildEdgeCasePrompt(context: EdgeCaseContext, config: GeneratorConfig): string {
  if (config.ai?.promptTemplate !== undefined) {
    return config.ai.promptTemplate;
  }

  const lines: string[] = [
    `Page: ${context.pageTitle}`,
    '',
    'Interactive elements:',
    ...context.interactiveElements.map((el) => `- ${el.category}: ${el.node.cssSelector}`),
    '',
    'Form constraints:',
    ...context.formConstraints.map((c) => formatConstraint(c)),
    '',
    'Observed behaviors:',
    ...context.observedBehaviors.map((b) => `- ${b}`),
    '',
    'Existing test names (avoid duplicates):',
    ...context.existingTestNames.map((n) => `- ${n}`),
    '',
    'Respond with a JSON array of edge case suggestions. Each suggestion must have:',
    '- "name": short descriptive name',
    '- "steps": array of { "action", "selector", "description" }',
    '- "expectedOutcome": what should happen',
  ];

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

export function parseEdgeCaseResponse(content: string): readonly EdgeCaseSuggestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isValidSuggestion);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatConstraint(c: EdgeCaseContext['formConstraints'][number]): string {
  const parts: string[] = [];
  if (c.required) parts.push('required: true');
  if (c.pattern !== null) parts.push(`pattern: ${c.pattern}`);
  if (c.min !== null) parts.push(`min: ${c.min}`);
  if (c.max !== null) parts.push(`max: ${c.max}`);
  if (c.minLength !== null) parts.push(`minLength: ${String(c.minLength)}`);
  if (c.maxLength !== null) parts.push(`maxLength: ${String(c.maxLength)}`);
  return `- ${parts.join(', ') || 'none'}`;
}

function isValidSuggestion(value: unknown): value is EdgeCaseSuggestion {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj['name'] !== 'string') return false;
  if (typeof obj['expectedOutcome'] !== 'string') return false;
  if (!Array.isArray(obj['steps'])) return false;
  return true;
}
