import { describe, it, expect } from 'vitest';
import { classifyInteractiveElements } from '../classifier/index.js';
import type { DomNode } from '../types.js';

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

describe('classifyInteractiveElements', () => {
  it('classifies a button element', () => {
    const tree = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'button', textContent: 'Click me' })],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('button');
  });

  it('classifies an anchor with href as navigation-link', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'a',
          attributes: { href: '/about' },
          textContent: 'About',
        }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('navigation-link');
  });

  it('classifies input types correctly', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({ tag: 'input', attributes: { type: 'text' } }),
        makeNode({ tag: 'input', attributes: { type: 'checkbox' } }),
        makeNode({ tag: 'input', attributes: { type: 'radio' } }),
        makeNode({ tag: 'input', attributes: { type: 'date' } }),
        makeNode({ tag: 'input', attributes: { type: 'file' } }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(5);
    expect(result[0]?.category).toBe('form-field');
    expect(result[1]?.category).toBe('checkbox');
    expect(result[2]?.category).toBe('radio');
    expect(result[3]?.category).toBe('date-picker');
    expect(result[4]?.category).toBe('file-upload');
  });

  it('classifies select as dropdown', () => {
    const tree = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'select' })],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('dropdown');
  });

  it('classifies textarea as form-field', () => {
    const tree = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'textarea' })],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('form-field');
  });

  it('excludes disabled elements', () => {
    const tree = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'button', attributes: { disabled: '' } })],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(0);
  });

  it('excludes elements with pointer-events: none', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'button',
          attributes: { style: 'pointer-events: none' },
        }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(0);
  });

  it('excludes invisible elements', () => {
    const tree = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'button', isVisible: false })],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(0);
  });

  it('classifies elements by ARIA role attribute', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'div',
          attributes: { role: 'button' },
          textContent: 'Custom button',
        }),
        makeNode({
          tag: 'div',
          attributes: { role: 'link' },
          textContent: 'Custom link',
        }),
        makeNode({
          tag: 'div',
          attributes: { role: 'checkbox' },
        }),
        makeNode({
          tag: 'div',
          attributes: { role: 'combobox' },
        }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(4);
    expect(result[0]?.category).toBe('button');
    expect(result[1]?.category).toBe('navigation-link');
    expect(result[2]?.category).toBe('checkbox');
    expect(result[3]?.category).toBe('dropdown');
  });

  it('custom web components with ARIA roles are classified by role', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'my-custom-button',
          attributes: { role: 'button' },
          textContent: 'Custom',
        }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('button');
  });
});
