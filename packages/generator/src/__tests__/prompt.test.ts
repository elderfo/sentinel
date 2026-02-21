import { describe, it, expect } from 'vitest';
import type { DomNode, InteractiveElement, FieldConstraints } from '@sentinel/analysis';
import type { EdgeCaseContext, GeneratorConfig } from '@sentinel/generator';
import { buildEdgeCasePrompt, parseEdgeCaseResponse } from '@sentinel/generator';

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
    interactiveElements: [
      makeInteractiveElement({
        node: makeDomNode({ cssSelector: '#submit-btn' }),
        category: 'button',
      }),
    ],
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

// ---------------------------------------------------------------------------
// buildEdgeCasePrompt
// ---------------------------------------------------------------------------

describe('buildEdgeCasePrompt', () => {
  it('includes page title in the prompt', () => {
    const prompt = buildEdgeCasePrompt(makeContext(), makeConfig());
    expect(prompt).toContain('Login Page');
  });

  it('includes interactive element category descriptions', () => {
    const context = makeContext({
      interactiveElements: [
        makeInteractiveElement({
          node: makeDomNode({ cssSelector: '#email-input' }),
          category: 'form-field',
        }),
        makeInteractiveElement({
          node: makeDomNode({ cssSelector: 'a.nav-link' }),
          category: 'navigation-link',
        }),
      ],
    });
    const prompt = buildEdgeCasePrompt(context, makeConfig());
    expect(prompt).toContain('form-field: #email-input');
    expect(prompt).toContain('navigation-link: a.nav-link');
  });

  it('includes form constraint summaries', () => {
    const context = makeContext({
      formConstraints: [makeFieldConstraints({ required: true, minLength: 3, maxLength: 50 })],
    });
    const prompt = buildEdgeCasePrompt(context, makeConfig());
    expect(prompt).toContain('required: true');
    expect(prompt).toContain('minLength: 3');
    expect(prompt).toContain('maxLength: 50');
  });

  it('includes observed behavior descriptions', () => {
    const context = makeContext({
      observedBehaviors: ['Redirects to dashboard after login', 'Shows spinner during submit'],
    });
    const prompt = buildEdgeCasePrompt(context, makeConfig());
    expect(prompt).toContain('Redirects to dashboard after login');
    expect(prompt).toContain('Shows spinner during submit');
  });

  it('includes existing test names to avoid duplicates', () => {
    const context = makeContext({
      existingTestNames: ['Login happy path', 'Login with invalid email'],
    });
    const prompt = buildEdgeCasePrompt(context, makeConfig());
    expect(prompt).toContain('Login happy path');
    expect(prompt).toContain('Login with invalid email');
  });

  it('uses custom promptTemplate from config when provided', () => {
    const config = makeConfig({
      ai: {
        enabled: true,
        maxTokenBudget: 500,
        promptTemplate: 'Custom prompt: suggest edge cases for {{page}}',
      },
    });
    const prompt = buildEdgeCasePrompt(makeContext(), config);
    expect(prompt).toBe('Custom prompt: suggest edge cases for {{page}}');
  });
});

// ---------------------------------------------------------------------------
// parseEdgeCaseResponse
// ---------------------------------------------------------------------------

describe('parseEdgeCaseResponse', () => {
  it('parses valid JSON array of edge case suggestions', () => {
    const content = JSON.stringify([
      {
        name: 'Empty form submit',
        steps: [{ action: 'click', selector: '#submit', description: 'Click submit' }],
        expectedOutcome: 'Validation errors shown',
      },
    ]);
    const result = parseEdgeCaseResponse(content);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Empty form submit');
    expect(result[0]?.steps).toHaveLength(1);
    expect(result[0]?.expectedOutcome).toBe('Validation errors shown');
  });

  it('returns empty array for malformed JSON', () => {
    const result = parseEdgeCaseResponse('not valid json {{{');
    expect(result).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    const result = parseEdgeCaseResponse('{"name": "not an array"}');
    expect(result).toEqual([]);
  });

  it('validates each suggestion has required fields', () => {
    const content = JSON.stringify([
      {
        name: 'Valid suggestion',
        steps: [{ action: 'click', selector: '#btn', description: 'Click' }],
        expectedOutcome: 'Something happens',
      },
    ]);
    const result = parseEdgeCaseResponse(content);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Valid suggestion');
  });

  it('discards suggestions missing required fields', () => {
    const content = JSON.stringify([
      { name: 'Missing steps and expectedOutcome' },
      {
        name: 'Valid',
        steps: [{ action: 'click', selector: '#x', description: 'Click x' }],
        expectedOutcome: 'Done',
      },
      { steps: [], expectedOutcome: 'Missing name' },
      { name: 'Missing outcome', steps: [] },
    ]);
    const result = parseEdgeCaseResponse(content);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Valid');
  });
});
