import { describe, it, expect } from 'vitest';
import { analyzeStability } from '../stability/stability-analyzer.js';
import type { InteractiveElement, DomNode } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    isVisible: true,
    xpath: '/html/body/button',
    cssSelector: 'button',
    ...overrides,
  };
}

function makeElement(nodeOverrides: Partial<DomNode> & { tag: string }): InteractiveElement {
  return {
    node: makeNode(nodeOverrides),
    category: 'button',
    isDisabled: false,
    accessibilityInfo: null,
  };
}

describe('analyzeStability', () => {
  it('recommends id strategy for elements with stable IDs', () => {
    const elements = [makeElement({ tag: 'button', id: 'submit-btn' })];
    const result = analyzeStability(elements);
    expect(result).toHaveLength(1);
    expect(result[0]?.stability.recommendedSelector.strategy).toBe('id');
    expect(result[0]?.stability.recommendedSelector.value).toBe('#submit-btn');
    expect(result[0]?.stability.recommendedSelector.score).toBe(100);
  });

  it('deprioritizes dynamically generated IDs', () => {
    const elements = [makeElement({ tag: 'button', id: ':r0:' })];
    const result = analyzeStability(elements);
    expect(result[0]?.stability.recommendedSelector.strategy).not.toBe('id');
  });

  it('recommends aria strategy when element has role and aria-label', () => {
    const elements = [
      makeElement({
        tag: 'div',
        attributes: { role: 'button', 'aria-label': 'Submit form' },
      }),
    ];
    const result = analyzeStability(elements);
    expect(result[0]?.stability.recommendedSelector.strategy).toBe('aria');
    expect(result[0]?.stability.recommendedSelector.score).toBe(80);
  });

  it('falls back to css for elements with stable classes', () => {
    const elements = [
      makeElement({
        tag: 'button',
        classes: ['btn-primary'],
        cssSelector: 'button.btn-primary',
      }),
    ];
    const result = analyzeStability(elements);
    expect(result[0]?.stability.recommendedSelector.strategy).toBe('css');
  });

  it('falls back to xpath as last resort', () => {
    const elements = [
      makeElement({
        tag: 'div',
        xpath: '/html/body/div[3]/div[1]/div',
        cssSelector: 'div',
      }),
    ];
    const result = analyzeStability(elements);
    expect(result[0]?.stability.recommendedSelector.strategy).toBe('xpath');
    expect(result[0]?.stability.recommendedSelector.score).toBe(30);
  });

  it('includes all available selectors ranked by score', () => {
    const elements = [
      makeElement({
        tag: 'button',
        id: 'save',
        attributes: { role: 'button', 'aria-label': 'Save' },
        classes: ['btn'],
        cssSelector: 'button#save',
        xpath: '/html/body/button',
      }),
    ];
    const result = analyzeStability(elements);
    const selectors = result[0]?.stability.selectors;
    expect(selectors?.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < (selectors?.length ?? 0); i++) {
      expect(selectors?.[i - 1]?.score).toBeGreaterThanOrEqual(selectors?.[i]?.score ?? 0);
    }
  });

  it('preserves all InteractiveElement fields', () => {
    const elements = [
      {
        ...makeElement({ tag: 'button', id: 'test' }),
        accessibilityInfo: {
          name: 'Test',
          role: 'button',
          description: '',
          states: {},
        },
      },
    ];
    const result = analyzeStability(elements);
    expect(result[0]?.category).toBe('button');
    expect(result[0]?.accessibilityInfo?.name).toBe('Test');
    expect(result[0]?.stability).toBeDefined();
  });

  it('handles empty element list', () => {
    const result = analyzeStability([]);
    expect(result).toEqual([]);
  });
});
