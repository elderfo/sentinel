import { describe, it, expect } from 'vitest';
import type { StateTransition, DomDiff, PageState, DomNode } from '@sentinel/analysis';
import type { TestAssertion } from '@sentinel/generator';
import { scoreConfidence, filterByDepth } from '@sentinel/generator';

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

function makePageState(overrides: Partial<PageState> = {}): PageState {
  return {
    id: 'state-1',
    url: 'https://example.com',
    domHash: 'hash-1',
    modalIndicators: [],
    timestamp: 1000,
    ...overrides,
  };
}

function makeDomNode(overrides: Partial<DomNode> = {}): DomNode {
  return {
    tag: 'div',
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: null,
    isVisible: true,
    xpath: '/html/body/div',
    cssSelector: 'div',
    ...overrides,
  };
}

function makeTransition(overrides: Partial<StateTransition> = {}): StateTransition {
  return {
    action: 'click',
    preState: makePageState(),
    postState: makePageState({ id: 'state-2', domHash: 'hash-2' }),
    domDiff: { added: [], removed: [], modified: [] },
    ...overrides,
  };
}

function makeAssertion(overrides: Partial<TestAssertion> = {}): TestAssertion {
  return {
    type: 'visibility',
    selector: '#btn',
    selectorStrategy: 'id',
    expected: 'true',
    confidence: 0.5,
    description: 'test assertion',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scoreConfidence
// ---------------------------------------------------------------------------

describe('scoreConfidence', () => {
  it('returns 1.0 when pre/post state URLs differ', () => {
    const transition = makeTransition({
      preState: makePageState({ url: 'https://example.com/page-a' }),
      postState: makePageState({ url: 'https://example.com/page-b' }),
    });
    expect(scoreConfidence(transition)).toBe(1.0);
  });

  it('returns 1.0 when DomDiff has added elements', () => {
    const diff: DomDiff = {
      added: [makeDomNode({ tag: 'span' })],
      removed: [],
      modified: [],
    };
    const transition = makeTransition({ domDiff: diff });
    expect(scoreConfidence(transition)).toBe(1.0);
  });

  it('returns 1.0 when DomDiff has removed elements', () => {
    const diff: DomDiff = {
      added: [],
      removed: [makeDomNode({ tag: 'span' })],
      modified: [],
    };
    const transition = makeTransition({ domDiff: diff });
    expect(scoreConfidence(transition)).toBe(1.0);
  });

  it('returns 1.0 when DomDiff has attribute toggle', () => {
    const diff: DomDiff = {
      added: [],
      removed: [],
      modified: [
        {
          before: makeDomNode({ attributes: { disabled: '' } }),
          after: makeDomNode({ attributes: {} }),
          changes: [
            {
              type: 'attribute',
              name: 'disabled',
              oldValue: '',
              newValue: null,
            },
          ],
        },
      ],
    };
    const transition = makeTransition({ domDiff: diff });
    expect(scoreConfidence(transition)).toBe(1.0);
  });

  it('returns 0.8 when DomDiff has text change that looks static', () => {
    const diff: DomDiff = {
      added: [],
      removed: [],
      modified: [
        {
          before: makeDomNode({ textContent: 'Hello' }),
          after: makeDomNode({ textContent: 'Welcome' }),
          changes: [
            {
              type: 'text',
              name: 'textContent',
              oldValue: 'Hello',
              newValue: 'Welcome',
            },
          ],
        },
      ],
    };
    const transition = makeTransition({ domDiff: diff });
    expect(scoreConfidence(transition)).toBe(0.8);
  });

  it('returns 0.5 when DomDiff has text change containing numbers', () => {
    const diff: DomDiff = {
      added: [],
      removed: [],
      modified: [
        {
          before: makeDomNode({ textContent: 'Items: 5' }),
          after: makeDomNode({ textContent: 'Items: 12' }),
          changes: [
            {
              type: 'text',
              name: 'textContent',
              oldValue: 'Items: 5',
              newValue: 'Items: 12',
            },
          ],
        },
      ],
    };
    const transition = makeTransition({ domDiff: diff });
    expect(scoreConfidence(transition)).toBe(0.5);
  });

  it('returns 0.3 when DomDiff has text change matching timestamp/date patterns', () => {
    const diff: DomDiff = {
      added: [],
      removed: [],
      modified: [
        {
          before: makeDomNode({ textContent: 'Created: 2024-01-14' }),
          after: makeDomNode({ textContent: 'Created: 2024-01-15' }),
          changes: [
            {
              type: 'text',
              name: 'textContent',
              oldValue: 'Created: 2024-01-14',
              newValue: 'Created: 2024-01-15',
            },
          ],
        },
      ],
    };
    const transition = makeTransition({ domDiff: diff });
    expect(scoreConfidence(transition)).toBe(0.3);
  });

  it('returns 0.3 when DomDiff has text change matching UUID patterns', () => {
    const diff: DomDiff = {
      added: [],
      removed: [],
      modified: [
        {
          before: makeDomNode({
            textContent: 'id: 00000000-0000-0000-0000-000000000000',
          }),
          after: makeDomNode({
            textContent: 'id: a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          }),
          changes: [
            {
              type: 'text',
              name: 'textContent',
              oldValue: 'id: 00000000-0000-0000-0000-000000000000',
              newValue: 'id: a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            },
          ],
        },
      ],
    };
    const transition = makeTransition({ domDiff: diff });
    expect(scoreConfidence(transition)).toBe(0.3);
  });

  it('returns 1.0 when domDiff is null but URLs differ', () => {
    const transition = makeTransition({
      preState: makePageState({ url: 'https://example.com/login' }),
      postState: makePageState({ url: 'https://example.com/dashboard' }),
      domDiff: null,
    });
    expect(scoreConfidence(transition)).toBe(1.0);
  });

  it('returns 0.5 when domDiff is null and URLs are the same', () => {
    const transition = makeTransition({
      preState: makePageState({ url: 'https://example.com' }),
      postState: makePageState({ url: 'https://example.com' }),
      domDiff: null,
    });
    expect(scoreConfidence(transition)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// filterByDepth
// ---------------------------------------------------------------------------

describe('filterByDepth', () => {
  const assertions: readonly TestAssertion[] = [
    makeAssertion({ confidence: 1.0, description: 'high' }),
    makeAssertion({ confidence: 0.8, description: 'medium-high' }),
    makeAssertion({ confidence: 0.5, description: 'medium' }),
    makeAssertion({ confidence: 0.3, description: 'low' }),
  ];

  it("'minimal' keeps only assertions with confidence >= 0.8", () => {
    const result = filterByDepth(assertions, 'minimal');
    expect(result).toHaveLength(2);
    expect(result.every((a: TestAssertion) => a.confidence >= 0.8)).toBe(true);
  });

  it("'standard' keeps only assertions with confidence >= 0.5", () => {
    const result = filterByDepth(assertions, 'standard');
    expect(result).toHaveLength(3);
    expect(result.every((a: TestAssertion) => a.confidence >= 0.5)).toBe(true);
  });

  it("'verbose' keeps all assertions regardless of confidence", () => {
    const result = filterByDepth(assertions, 'verbose');
    expect(result).toHaveLength(4);
  });

  it('returns empty array when all assertions are below threshold', () => {
    const lowAssertions: readonly TestAssertion[] = [
      makeAssertion({ confidence: 0.3 }),
      makeAssertion({ confidence: 0.1 }),
    ];
    const result = filterByDepth(lowAssertions, 'minimal');
    expect(result).toHaveLength(0);
  });
});
