import { describe, it, expect } from 'vitest';
import { detectForms, extractConstraints } from '../forms/index.js';
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

describe('detectForms', () => {
  it('detects a simple form with text fields', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'form',
          attributes: { action: '/login', method: 'POST' },
          children: [
            makeNode({ tag: 'input', attributes: { type: 'text', name: 'username' } }),
            makeNode({ tag: 'input', attributes: { type: 'password', name: 'password' } }),
          ],
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms).toHaveLength(1);
    expect(forms[0]?.fields).toHaveLength(2);
    expect(forms[0]?.action).toBe('/login');
    expect(forms[0]?.method).toBe('POST');
  });

  it('defaults method to GET when not specified', () => {
    const tree = makeNode({
      tag: 'form',
      children: [makeNode({ tag: 'input', attributes: { type: 'text', name: 'q' } })],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.method).toBe('GET');
  });

  it('sets action to null when not specified', () => {
    const tree = makeNode({
      tag: 'form',
      children: [],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.action).toBeNull();
  });

  it('sets isMultiStep to false', () => {
    const tree = makeNode({
      tag: 'form',
      children: [makeNode({ tag: 'input', attributes: { type: 'text', name: 'step1' } })],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.isMultiStep).toBe(false);
  });

  it('excludes submit, reset, button, hidden, and image input types', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({ tag: 'input', attributes: { type: 'text', name: 'email' } }),
        makeNode({ tag: 'input', attributes: { type: 'submit', value: 'Submit' } }),
        makeNode({ tag: 'input', attributes: { type: 'reset' } }),
        makeNode({ tag: 'input', attributes: { type: 'button', value: 'Cancel' } }),
        makeNode({ tag: 'input', attributes: { type: 'hidden', name: 'csrf' } }),
        makeNode({ tag: 'input', attributes: { type: 'image', alt: 'Submit' } }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields).toHaveLength(1);
    expect(forms[0]?.fields[0]?.inputType).toBe('text');
  });

  it('includes select and textarea as form fields', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({ tag: 'select', attributes: { name: 'country' } }),
        makeNode({ tag: 'textarea', attributes: { name: 'bio' } }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields).toHaveLength(2);
    expect(forms[0]?.fields[0]?.inputType).toBe('select');
    expect(forms[0]?.fields[1]?.inputType).toBe('textarea');
  });

  it('extracts label from associated label element', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'label',
          attributes: { for: 'email' },
          textContent: 'Email address',
        }),
        makeNode({
          tag: 'input',
          id: 'email',
          attributes: { type: 'email', name: 'email' },
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.label).toBe('Email address');
  });

  it('sets label to null when no matching label exists', () => {
    const tree = makeNode({
      tag: 'form',
      children: [makeNode({ tag: 'input', attributes: { type: 'text', name: 'search' } })],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.label).toBeNull();
  });

  it('extracts placeholder attribute', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'input',
          attributes: { type: 'text', name: 'search', placeholder: 'Search…' },
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.placeholder).toBe('Search…');
  });

  it('sets placeholder to null when not present', () => {
    const tree = makeNode({
      tag: 'form',
      children: [makeNode({ tag: 'input', attributes: { type: 'text', name: 'username' } })],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.placeholder).toBeNull();
  });

  it('detects multiple forms in a page', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({ tag: 'form', attributes: { action: '/login' } }),
        makeNode({ tag: 'form', attributes: { action: '/search' } }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms).toHaveLength(2);
  });
});

describe('extractConstraints', () => {
  it('extracts required constraint from required attribute', () => {
    const node = makeNode({ tag: 'input', attributes: { required: '' } });

    const constraints = extractConstraints(node);

    expect(constraints.required).toBe(true);
  });

  it('detects ARIA required equivalent', () => {
    const node = makeNode({ tag: 'input', attributes: { 'aria-required': 'true' } });

    const constraints = extractConstraints(node);

    expect(constraints.required).toBe(true);
  });

  it('returns required false when neither required nor aria-required are set', () => {
    const node = makeNode({ tag: 'input', attributes: {} });

    const constraints = extractConstraints(node);

    expect(constraints.required).toBe(false);
  });

  it('extracts pattern constraint', () => {
    const node = makeNode({ tag: 'input', attributes: { pattern: '[A-Z]+' } });

    const constraints = extractConstraints(node);

    expect(constraints.pattern).toBe('[A-Z]+');
  });

  it('returns null pattern when not set', () => {
    const node = makeNode({ tag: 'input', attributes: {} });

    expect(extractConstraints(node).pattern).toBeNull();
  });

  it('extracts min and max constraints as strings', () => {
    const node = makeNode({ tag: 'input', attributes: { min: '1', max: '100' } });

    const constraints = extractConstraints(node);

    expect(constraints.min).toBe('1');
    expect(constraints.max).toBe('100');
  });

  it('returns null for min/max when not set', () => {
    const node = makeNode({ tag: 'input', attributes: {} });

    const constraints = extractConstraints(node);

    expect(constraints.min).toBeNull();
    expect(constraints.max).toBeNull();
  });

  it('extracts minLength and maxLength parsed as numbers', () => {
    const node = makeNode({
      tag: 'input',
      attributes: { minlength: '3', maxlength: '50' },
    });

    const constraints = extractConstraints(node);

    expect(constraints.minLength).toBe(3);
    expect(constraints.maxLength).toBe(50);
  });

  it('returns null for minLength/maxLength when not set', () => {
    const node = makeNode({ tag: 'input', attributes: {} });

    const constraints = extractConstraints(node);

    expect(constraints.minLength).toBeNull();
    expect(constraints.maxLength).toBeNull();
  });
});
