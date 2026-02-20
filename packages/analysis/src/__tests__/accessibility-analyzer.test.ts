import { describe, it, expect } from 'vitest';
import {
  parseAccessibilityTree,
  findAccessibilityIssues,
  mergeAccessibility,
} from '../accessibility/index.js';
import type { RawAccessibilityNode, InteractiveElement, DomNode } from '../types.js';

function makeRawA11yNode(
  overrides: Partial<RawAccessibilityNode> & { role: string },
): RawAccessibilityNode {
  return {
    name: '',
    description: '',
    value: null,
    children: [],
    ...overrides,
  };
}

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    isVisible: true,
    xpath: '/test',
    cssSelector: 'test',
    ...overrides,
  };
}

function makeInteractiveElement(
  overrides: Partial<InteractiveElement> & { node: DomNode },
): InteractiveElement {
  return {
    category: 'button',
    isDisabled: false,
    accessibilityInfo: null,
    ...overrides,
  };
}

describe('parseAccessibilityTree', () => {
  it('extracts accessibility info from a single root node with a role', () => {
    const root = makeRawA11yNode({ role: 'button', name: 'Submit' });

    const result = parseAccessibilityTree(root);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: 'button', name: 'Submit' });
  });

  it('flattens nested accessibility nodes into a single array', () => {
    const root = makeRawA11yNode({
      role: 'form',
      name: 'Login',
      children: [
        makeRawA11yNode({ role: 'textbox', name: 'Email' }),
        makeRawA11yNode({ role: 'textbox', name: 'Password' }),
      ],
    });

    const result = parseAccessibilityTree(root);

    expect(result).toHaveLength(3);
    expect(result.map((n) => n.role)).toEqual(['form', 'textbox', 'textbox']);
  });

  it('skips nodes with an empty role', () => {
    const root = makeRawA11yNode({
      role: 'group',
      children: [
        makeRawA11yNode({ role: '', name: 'ignored' }),
        makeRawA11yNode({ role: 'button', name: 'OK' }),
      ],
    });

    const result = parseAccessibilityTree(root);

    expect(result).toHaveLength(2);
    expect(result.every((n) => n.role.length > 0)).toBe(true);
  });

  it('maps the value field to the states record', () => {
    const root = makeRawA11yNode({
      role: 'spinbutton',
      name: 'Quantity',
      value: '5',
    });

    const result = parseAccessibilityTree(root);

    expect(result[0]?.states).toEqual({ value: '5' });
  });

  it('produces empty states when value is null', () => {
    const root = makeRawA11yNode({ role: 'button', name: 'Close', value: null });

    const result = parseAccessibilityTree(root);

    expect(result[0]?.states).toEqual({});
  });

  it('handles deeply nested trees', () => {
    const leaf = makeRawA11yNode({ role: 'checkbox', name: 'Accept terms' });
    const mid = makeRawA11yNode({ role: 'group', children: [leaf] });
    const root = makeRawA11yNode({ role: 'form', children: [mid] });

    const result = parseAccessibilityTree(root);

    expect(result).toHaveLength(3);
    expect(result[2]?.role).toBe('checkbox');
  });
});

describe('mergeAccessibility', () => {
  it('attaches a11y info to a matching element by name', () => {
    const node = makeNode({ tag: 'button', textContent: 'Submit' });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'button' }),
    ];
    const rawTree = makeRawA11yNode({
      role: 'button',
      name: 'Submit',
      children: [],
    });

    const result = mergeAccessibility(elements, rawTree);

    expect(result[0]?.accessibilityInfo).not.toBeNull();
    expect(result[0]?.accessibilityInfo?.name).toBe('Submit');
    expect(result[0]?.accessibilityInfo?.role).toBe('button');
  });

  it('attaches a11y info by role when name is absent', () => {
    const node = makeNode({
      tag: 'div',
      attributes: { role: 'checkbox' },
      textContent: '',
    });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'checkbox' }),
    ];
    const rawTree = makeRawA11yNode({ role: 'checkbox', name: '' });

    const result = mergeAccessibility(elements, rawTree);

    expect(result[0]?.accessibilityInfo?.role).toBe('checkbox');
  });

  it('leaves accessibilityInfo as null when no match is found', () => {
    const node = makeNode({ tag: 'button', textContent: 'No match' });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'button' }),
    ];
    const rawTree = makeRawA11yNode({ role: 'link', name: 'Completely different' });

    const result = mergeAccessibility(elements, rawTree);

    expect(result[0]?.accessibilityInfo).toBeNull();
  });

  it('does not mutate the original elements array', () => {
    const node = makeNode({ tag: 'button', textContent: 'Save' });
    const original: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'button' }),
    ];
    const rawTree = makeRawA11yNode({ role: 'button', name: 'Save' });

    const result = mergeAccessibility(original, rawTree);

    expect(result).not.toBe(original);
    expect(original[0]?.accessibilityInfo).toBeNull();
    expect(result[0]?.accessibilityInfo).not.toBeNull();
  });
});

describe('findAccessibilityIssues', () => {
  it('flags elements missing an accessible name', () => {
    const node = makeNode({
      tag: 'button',
      textContent: '',
      attributes: {},
    });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'button', accessibilityInfo: null }),
    ];

    const issues = findAccessibilityIssues(elements);

    const nameIssues = issues.filter((i) => i.issue === 'missing-accessible-name');
    expect(nameIssues).toHaveLength(1);
    expect(nameIssues[0]?.node).toBe(node);
  });

  it('returns no issues for a well-labeled element', () => {
    const node = makeNode({
      tag: 'button',
      textContent: 'Submit form',
      attributes: {},
    });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({
        node,
        category: 'button',
        accessibilityInfo: {
          name: 'Submit form',
          role: 'button',
          description: '',
          states: {},
        },
      }),
    ];

    const issues = findAccessibilityIssues(elements);

    expect(issues).toHaveLength(0);
  });

  it('flags an element missing from the a11y tree when it has no role attribute', () => {
    const node = makeNode({
      tag: 'div',
      textContent: '',
      attributes: {},
    });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'button', accessibilityInfo: null }),
    ];

    const issues = findAccessibilityIssues(elements);

    const treeIssues = issues.filter((i) => i.issue === 'missing-from-a11y-tree');
    expect(treeIssues).toHaveLength(1);
  });

  it('does not flag missing-from-a11y-tree when element has a role attribute', () => {
    const node = makeNode({
      tag: 'div',
      textContent: 'Click me',
      attributes: { role: 'button' },
    });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'button', accessibilityInfo: null }),
    ];

    const issues = findAccessibilityIssues(elements);

    const treeIssues = issues.filter((i) => i.issue === 'missing-from-a11y-tree');
    expect(treeIssues).toHaveLength(0);
  });

  it('accepts aria-label as a valid accessible name source', () => {
    const node = makeNode({
      tag: 'button',
      textContent: '',
      attributes: { 'aria-label': 'Close dialog' },
    });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'button', accessibilityInfo: null }),
    ];

    const issues = findAccessibilityIssues(elements);

    const nameIssues = issues.filter((i) => i.issue === 'missing-accessible-name');
    expect(nameIssues).toHaveLength(0);
  });

  it('accepts title attribute as a valid accessible name source', () => {
    const node = makeNode({
      tag: 'input',
      textContent: '',
      attributes: { type: 'text', title: 'Search field' },
    });
    const elements: readonly InteractiveElement[] = [
      makeInteractiveElement({ node, category: 'form-field', accessibilityInfo: null }),
    ];

    const issues = findAccessibilityIssues(elements);

    const nameIssues = issues.filter((i) => i.issue === 'missing-accessible-name');
    expect(nameIssues).toHaveLength(0);
  });
});
