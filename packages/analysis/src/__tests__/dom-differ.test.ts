import { describe, it, expect } from 'vitest';
import { diffDom } from '../diff/dom-differ.js';
import type { DomNode } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(tag: string, xpath: string, overrides?: Partial<DomNode>): DomNode {
  return {
    tag,
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: null,
    isVisible: true,
    xpath,
    cssSelector: tag,
    ...overrides,
  };
}

const ROOT_XPATH = '/div';

function rootNode(overrides?: Partial<DomNode>): DomNode {
  return makeNode('div', ROOT_XPATH, overrides);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('diffDom', () => {
  it('returns an empty diff for identical trees', () => {
    const tree = rootNode({ textContent: 'hello' });
    const diff = diffDom(tree, tree);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it('detects an added element', () => {
    const before = rootNode();
    const child = makeNode('span', '/div/span', { textContent: 'new' });
    const after: DomNode = { ...rootNode(), children: [child] };

    const diff = diffDom(before, after);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.xpath).toBe('/div/span');
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it('detects a removed element', () => {
    const child = makeNode('span', '/div/span', { textContent: 'gone' });
    const before: DomNode = { ...rootNode(), children: [child] };
    const after = rootNode();

    const diff = diffDom(before, after);

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]?.xpath).toBe('/div/span');
    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it('detects modified text content', () => {
    const before = rootNode({ textContent: 'old text' });
    const after = rootNode({ textContent: 'new text' });

    const diff = diffDom(before, after);

    expect(diff.modified).toHaveLength(1);
    const mod = diff.modified[0];
    expect(mod?.changes).toHaveLength(1);
    const change = mod?.changes[0];
    expect(change?.type).toBe('text');
    expect(change?.name).toBe('textContent');
    expect(change?.oldValue).toBe('old text');
    expect(change?.newValue).toBe('new text');
  });

  it('detects a modified attribute', () => {
    const before = rootNode({ attributes: { href: '/old' } });
    const after = rootNode({ attributes: { href: '/new' } });

    const diff = diffDom(before, after);

    expect(diff.modified).toHaveLength(1);
    const change = diff.modified[0]?.changes.find((c) => c.name === 'href');
    expect(change?.type).toBe('attribute');
    expect(change?.oldValue).toBe('/old');
    expect(change?.newValue).toBe('/new');
  });

  it('detects a removed attribute', () => {
    const before = rootNode({ attributes: { 'aria-expanded': 'true' } });
    const after = rootNode({ attributes: {} });

    const diff = diffDom(before, after);

    expect(diff.modified).toHaveLength(1);
    const change = diff.modified[0]?.changes[0];
    expect(change?.type).toBe('attribute');
    expect(change?.name).toBe('aria-expanded');
    expect(change?.oldValue).toBe('true');
    expect(change?.newValue).toBeNull();
  });

  it('detects a class change', () => {
    const before = rootNode({ classes: ['btn'] });
    const after = rootNode({ classes: ['btn', 'btn-primary'] });

    const diff = diffDom(before, after);

    expect(diff.modified).toHaveLength(1);
    const change = diff.modified[0]?.changes.find((c) => c.type === 'class');
    expect(change).toBeDefined();
    expect(change?.oldValue).toBe('btn');
    expect(change?.newValue).toBe('btn btn-primary');
  });

  it('handles mixed additions, removals, and modifications', () => {
    const shared = makeNode('p', '/div/p', { textContent: 'before' });
    const toRemove = makeNode('span', '/div/span', { textContent: 'removed' });

    const before: DomNode = { ...rootNode(), children: [shared, toRemove] };

    const modifiedShared = makeNode('p', '/div/p', { textContent: 'after' });
    const newChild = makeNode('em', '/div/em', { textContent: 'added' });

    const after: DomNode = { ...rootNode(), children: [modifiedShared, newChild] };

    const diff = diffDom(before, after);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.xpath).toBe('/div/em');

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]?.xpath).toBe('/div/span');

    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.before.xpath).toBe('/div/p');
    expect(diff.modified[0]?.changes[0]?.type).toBe('text');
  });

  it('treats class order as insignificant', () => {
    const before = rootNode({ classes: ['a', 'b', 'c'] });
    const after = rootNode({ classes: ['c', 'a', 'b'] });

    // Sorted sets are identical so no modification should be recorded
    const diff = diffDom(before, after);
    expect(diff.modified).toHaveLength(0);
  });
});
