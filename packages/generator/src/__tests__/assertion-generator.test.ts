import { describe, it, expect } from 'vitest';
import type {
  StateTransitionGraph,
  StateTransition,
  PageState,
  DomNode,
  StabilizedElement,
  StabilityAnalysis,
  SelectorCandidate,
} from '@sentinel/analysis';
import type { TestCase, TestStep, GeneratorConfig } from '@sentinel/generator';
import { generateAssertions } from '../assertions/assertion-generator.js';

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

function makeStep(overrides: Partial<TestStep> = {}): TestStep {
  return {
    action: 'click',
    selector: '#login-btn',
    selectorStrategy: 'id',
    description: 'click login button',
    assertions: [],
    ...overrides,
  };
}

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc-1',
    name: 'Login flow',
    type: 'happy-path',
    journeyId: 'j-1',
    suite: 'auth',
    setupSteps: [],
    steps: [makeStep(), makeStep({ action: 'click', description: 'click dashboard' })],
    teardownSteps: [],
    tags: ['login'],
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

function makeConfig(overrides: Partial<GeneratorConfig> = {}): GeneratorConfig {
  return {
    assertionDepth: 'standard',
    dataStrategy: 'realistic',
    outputFormat: 'playwright-ts',
    outputDir: './output',
    ...overrides,
  };
}

function makeStabilizedElement(node: DomNode, recommended: SelectorCandidate): StabilizedElement {
  const stability: StabilityAnalysis = {
    selectors: [recommended],
    recommendedSelector: recommended,
  };
  return {
    node,
    category: 'button',
    isDisabled: false,
    accessibilityInfo: null,
    stability,
  };
}

// ---------------------------------------------------------------------------
// Fixture data — transitions covering each assertion type
// ---------------------------------------------------------------------------

// Transition 1: URL changes /login -> /dashboard
const urlChangeTransition = makeTransition({
  action: 'click',
  preState: makePageState({ id: 's-login', url: 'https://app.com/login' }),
  postState: makePageState({
    id: 's-dash',
    url: 'https://app.com/dashboard',
  }),
  domDiff: { added: [], removed: [], modified: [] },
});

// Transition 2: Element added (success message div)
const successDiv = makeDomNode({
  tag: 'div',
  id: 'success-msg',
  classes: ['alert', 'alert-success'],
  textContent: 'Login successful',
  isVisible: true,
  cssSelector: 'div#success-msg',
  xpath: '/html/body/div[2]',
});

const elementAddedTransition = makeTransition({
  action: 'click',
  preState: makePageState({ id: 's-2' }),
  postState: makePageState({ id: 's-3', domHash: 'hash-3' }),
  domDiff: { added: [successDiv], removed: [], modified: [] },
});

// Transition 3: Element removed (loading spinner)
const spinnerDiv = makeDomNode({
  tag: 'div',
  id: 'loading-spinner',
  classes: ['spinner'],
  textContent: '',
  isVisible: true,
  cssSelector: 'div#loading-spinner',
  xpath: '/html/body/div[3]',
});

const elementRemovedTransition = makeTransition({
  action: 'click',
  preState: makePageState({ id: 's-3' }),
  postState: makePageState({ id: 's-4', domHash: 'hash-4' }),
  domDiff: { added: [], removed: [spinnerDiv], modified: [] },
});

// Transition 4: Text content changed ("0 items" -> "3 items")
const itemCountBefore = makeDomNode({
  tag: 'span',
  id: 'item-count',
  textContent: '0 items',
  cssSelector: 'span#item-count',
  xpath: '/html/body/span',
});

const itemCountAfter = makeDomNode({
  tag: 'span',
  id: 'item-count',
  textContent: '3 items',
  cssSelector: 'span#item-count',
  xpath: '/html/body/span',
});

const textChangeTransition = makeTransition({
  action: 'click',
  preState: makePageState({ id: 's-4' }),
  postState: makePageState({ id: 's-5', domHash: 'hash-5' }),
  domDiff: {
    added: [],
    removed: [],
    modified: [
      {
        before: itemCountBefore,
        after: itemCountAfter,
        changes: [
          {
            type: 'text',
            name: 'textContent',
            oldValue: '0 items',
            newValue: '3 items',
          },
        ],
      },
    ],
  },
});

// Transition 5: Attribute changed (button disabled toggled)
const buttonBefore = makeDomNode({
  tag: 'button',
  id: 'submit-btn',
  attributes: { disabled: '' },
  cssSelector: 'button#submit-btn',
  xpath: '/html/body/button',
});

const buttonAfter = makeDomNode({
  tag: 'button',
  id: 'submit-btn',
  attributes: {},
  cssSelector: 'button#submit-btn',
  xpath: '/html/body/button',
});

const attributeChangeTransition = makeTransition({
  action: 'click',
  preState: makePageState({ id: 's-5' }),
  postState: makePageState({ id: 's-6', domHash: 'hash-6' }),
  domDiff: {
    added: [],
    removed: [],
    modified: [
      {
        before: buttonBefore,
        after: buttonAfter,
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
  },
});

// ---------------------------------------------------------------------------
// StabilizedElement fixtures
// ---------------------------------------------------------------------------

const stableButtonSelector: SelectorCandidate = {
  strategy: 'css',
  value: '[data-testid="submit"]',
  score: 0.95,
};

const stableButton = makeStabilizedElement(
  makeDomNode({
    tag: 'button',
    id: 'submit-btn',
    cssSelector: 'button#submit-btn',
    xpath: '/html/body/button',
  }),
  stableButtonSelector,
);

// ---------------------------------------------------------------------------
// Test cases fixture
// ---------------------------------------------------------------------------

const testCaseWithUrlTransition = makeTestCase({
  id: 'tc-url',
  name: 'URL change test',
  steps: [makeStep({ action: 'click', description: 'click login button' })],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateAssertions', () => {
  it('adds url-match assertion when pre/post state URLs differ', () => {
    const graph: StateTransitionGraph = {
      states: [urlChangeTransition.preState, urlChangeTransition.postState],
      transitions: [urlChangeTransition],
    };

    const result = generateAssertions([testCaseWithUrlTransition], graph, [], makeConfig());

    expect(result).toHaveLength(1);
    const step = result.at(0)?.steps.at(0);
    const urlAssertion = step?.assertions.find((a) => a.type === 'url-match');
    expect(urlAssertion).toBeDefined();
    expect(urlAssertion?.expected).toBe('https://app.com/dashboard');
  });

  it('adds visibility assertion (expected: true) when DomDiff has added element', () => {
    const graph: StateTransitionGraph = {
      states: [elementAddedTransition.preState, elementAddedTransition.postState],
      transitions: [elementAddedTransition],
    };

    const result = generateAssertions(
      [makeTestCase({ id: 'tc-add', steps: [makeStep()] })],
      graph,
      [],
      makeConfig(),
    );

    const step = result.at(0)?.steps.at(0);
    const visAssertion = step?.assertions.find(
      (a) => a.type === 'visibility' && a.expected === 'true',
    );
    expect(visAssertion).toBeDefined();
    expect(visAssertion?.selector).toBe('div#success-msg');
  });

  it('adds visibility assertion (expected: false) when DomDiff has removed element', () => {
    const graph: StateTransitionGraph = {
      states: [elementRemovedTransition.preState, elementRemovedTransition.postState],
      transitions: [elementRemovedTransition],
    };

    const result = generateAssertions(
      [makeTestCase({ id: 'tc-remove', steps: [makeStep()] })],
      graph,
      [],
      makeConfig(),
    );

    const step = result.at(0)?.steps.at(0);
    const visAssertion = step?.assertions.find(
      (a) => a.type === 'visibility' && a.expected === 'false',
    );
    expect(visAssertion).toBeDefined();
    expect(visAssertion?.selector).toBe('div#loading-spinner');
  });

  it('adds text-content assertion when DomDiff has text modification', () => {
    const graph: StateTransitionGraph = {
      states: [textChangeTransition.preState, textChangeTransition.postState],
      transitions: [textChangeTransition],
    };

    const result = generateAssertions(
      [makeTestCase({ id: 'tc-text', steps: [makeStep()] })],
      graph,
      [],
      makeConfig(),
    );

    const step = result.at(0)?.steps.at(0);
    const textAssertion = step?.assertions.find((a) => a.type === 'text-content');
    expect(textAssertion).toBeDefined();
    expect(textAssertion?.expected).toBe('3 items');
    expect(textAssertion?.selector).toBe('span#item-count');
  });

  it('adds attribute-value assertion when DomDiff has attribute change', () => {
    const graph: StateTransitionGraph = {
      states: [attributeChangeTransition.preState, attributeChangeTransition.postState],
      transitions: [attributeChangeTransition],
    };

    const result = generateAssertions(
      [makeTestCase({ id: 'tc-attr', steps: [makeStep()] })],
      graph,
      [],
      makeConfig(),
    );

    const step = result.at(0)?.steps.at(0);
    const attrAssertion = step?.assertions.find((a) => a.type === 'attribute-value');
    expect(attrAssertion).toBeDefined();
    expect(attrAssertion?.description).toContain('disabled');
  });

  it('uses recommendedSelector from StabilizedElement when element matches by cssSelector', () => {
    const graph: StateTransitionGraph = {
      states: [attributeChangeTransition.preState, attributeChangeTransition.postState],
      transitions: [attributeChangeTransition],
    };

    const result = generateAssertions(
      [makeTestCase({ id: 'tc-stable', steps: [makeStep()] })],
      graph,
      [stableButton],
      makeConfig(),
    );

    const step = result.at(0)?.steps.at(0);
    const attrAssertion = step?.assertions.find((a) => a.type === 'attribute-value');
    expect(attrAssertion).toBeDefined();
    expect(attrAssertion?.selector).toBe('[data-testid="submit"]');
    expect(attrAssertion?.selectorStrategy).toBe('css');
  });

  it('falls back to cssSelector from DomNode when no stability analysis matches', () => {
    const graph: StateTransitionGraph = {
      states: [elementAddedTransition.preState, elementAddedTransition.postState],
      transitions: [elementAddedTransition],
    };

    // Stable elements don't match the added node
    const unrelatedStable = makeStabilizedElement(makeDomNode({ cssSelector: 'div.unrelated' }), {
      strategy: 'id',
      value: '#unrelated',
      score: 0.9,
    });

    const result = generateAssertions(
      [makeTestCase({ id: 'tc-fallback', steps: [makeStep()] })],
      graph,
      [unrelatedStable],
      makeConfig(),
    );

    const step = result.at(0)?.steps.at(0);
    const visAssertion = step?.assertions.find((a) => a.type === 'visibility');
    expect(visAssertion).toBeDefined();
    expect(visAssertion?.selector).toBe('div#success-msg');
    expect(visAssertion?.selectorStrategy).toBe('css');
  });

  it('each assertion has a description explaining its origin', () => {
    const graph: StateTransitionGraph = {
      states: [urlChangeTransition.preState, urlChangeTransition.postState],
      transitions: [urlChangeTransition],
    };

    const result = generateAssertions([testCaseWithUrlTransition], graph, [], makeConfig());

    const step = result.at(0)?.steps.at(0);
    expect(step).toBeDefined();
    for (const assertion of step?.assertions ?? []) {
      expect(assertion.description).toBeTruthy();
      expect(typeof assertion.description).toBe('string');
      expect(assertion.description.length).toBeGreaterThan(0);
    }
  });

  it('each assertion has confidence from scoreConfidence()', () => {
    // URL change -> scoreConfidence returns 1.0
    const graph: StateTransitionGraph = {
      states: [urlChangeTransition.preState, urlChangeTransition.postState],
      transitions: [urlChangeTransition],
    };

    const result = generateAssertions([testCaseWithUrlTransition], graph, [], makeConfig());

    const step = result.at(0)?.steps.at(0);
    const urlAssertion = step?.assertions.find((a) => a.type === 'url-match');
    expect(urlAssertion?.confidence).toBe(1.0);
  });

  it("respects assertionDepth: 'minimal' — filters low-confidence assertions", () => {
    // Text change with numbers -> scoreConfidence returns 0.5
    // minimal threshold is 0.8 -> this assertion should be filtered out
    const graph: StateTransitionGraph = {
      states: [textChangeTransition.preState, textChangeTransition.postState],
      transitions: [textChangeTransition],
    };

    const result = generateAssertions(
      [makeTestCase({ id: 'tc-min', steps: [makeStep()] })],
      graph,
      [],
      makeConfig({ assertionDepth: 'minimal' }),
    );

    const step = result.at(0)?.steps.at(0);
    // Text change with numeric content has confidence 0.5, below 0.8 threshold
    const textAssertion = step?.assertions.find((a) => a.type === 'text-content');
    expect(textAssertion).toBeUndefined();
  });

  it("respects assertionDepth: 'verbose' — keeps all assertions", () => {
    // Text change with numbers -> scoreConfidence returns 0.5
    // verbose threshold is 0 -> assertion should be kept
    const graph: StateTransitionGraph = {
      states: [textChangeTransition.preState, textChangeTransition.postState],
      transitions: [textChangeTransition],
    };

    const result = generateAssertions(
      [makeTestCase({ id: 'tc-verb', steps: [makeStep()] })],
      graph,
      [],
      makeConfig({ assertionDepth: 'verbose' }),
    );

    const step = result.at(0)?.steps.at(0);
    const textAssertion = step?.assertions.find((a) => a.type === 'text-content');
    expect(textAssertion).toBeDefined();
  });

  it('returns test cases unchanged when no state transitions match their steps', () => {
    // Empty graph -> no transitions to match
    const graph: StateTransitionGraph = {
      states: [],
      transitions: [],
    };

    const testCases = [testCaseWithUrlTransition];
    const result = generateAssertions(testCases, graph, [], makeConfig());

    expect(result).toHaveLength(1);
    expect(result.at(0)?.steps.at(0)?.assertions).toHaveLength(0);
    expect(result[0]).toEqual(testCases[0]);
  });

  it('handles multiple test cases with multiple steps each', () => {
    const graph: StateTransitionGraph = {
      states: [
        urlChangeTransition.preState,
        urlChangeTransition.postState,
        elementAddedTransition.preState,
        elementAddedTransition.postState,
        elementRemovedTransition.preState,
        elementRemovedTransition.postState,
        textChangeTransition.preState,
        textChangeTransition.postState,
        attributeChangeTransition.preState,
        attributeChangeTransition.postState,
      ],
      transitions: [
        urlChangeTransition,
        elementAddedTransition,
        elementRemovedTransition,
        textChangeTransition,
        attributeChangeTransition,
      ],
    };

    const tc1 = makeTestCase({
      id: 'tc-multi-1',
      steps: [makeStep(), makeStep()],
    });
    const tc2 = makeTestCase({
      id: 'tc-multi-2',
      steps: [makeStep(), makeStep()],
    });

    const result = generateAssertions([tc1, tc2], graph, [], makeConfig());

    expect(result).toHaveLength(2);
    // Each test case should be returned
    expect(result.at(0)?.id).toBe('tc-multi-1');
    expect(result.at(1)?.id).toBe('tc-multi-2');
  });
});
