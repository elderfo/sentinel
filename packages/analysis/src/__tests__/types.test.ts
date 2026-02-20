import { describe, it, expect } from 'vitest';
import type {
  DomNode,
  BoundingBox,
  ElementCategory,
  InteractiveElement,
  AccessibilityInfo,
  FormModel,
  FieldConstraints,
  PageState,
  DomDiff,
  AttributeChange,
  RawDomData,
  RawAccessibilityNode,
} from '../types.js';

describe('analysis types', () => {
  it('DomNode is structurally valid', () => {
    const node: DomNode = {
      tag: 'div',
      id: 'root',
      classes: ['container'],
      attributes: { 'data-testid': 'root' },
      textContent: 'Hello',
      children: [],
      boundingBox: { x: 0, y: 0, width: 100, height: 50 },
      isVisible: true,
      xpath: '/html/body/div',
      cssSelector: 'div#root',
    };
    expect(node.tag).toBe('div');
  });

  it('InteractiveElement extends DomNode with category', () => {
    const element: InteractiveElement = {
      node: {
        tag: 'button',
        id: 'submit',
        classes: ['btn'],
        attributes: {},
        textContent: 'Submit',
        children: [],
        boundingBox: { x: 10, y: 20, width: 80, height: 30 },
        isVisible: true,
        xpath: '/html/body/button',
        cssSelector: 'button#submit',
      },
      category: 'button',
      isDisabled: false,
      accessibilityInfo: null,
    };
    expect(element.category).toBe('button');
  });

  it('ElementCategory covers all expected values', () => {
    const categories: ElementCategory[] = [
      'navigation-link',
      'button',
      'form-field',
      'dropdown',
      'checkbox',
      'radio',
      'date-picker',
      'file-upload',
    ];
    expect(categories).toHaveLength(8);
  });

  it('FormModel captures form structure with constraints', () => {
    const form: FormModel = {
      formElement: {
        tag: 'form',
        id: 'login',
        classes: [],
        attributes: {},
        textContent: '',
        children: [],
        boundingBox: null,
        isVisible: true,
        xpath: '/html/body/form',
        cssSelector: 'form#login',
      },
      action: '/api/login',
      method: 'POST',
      fields: [
        {
          node: {
            tag: 'input',
            id: 'email',
            classes: [],
            attributes: { type: 'email' },
            textContent: '',
            children: [],
            boundingBox: null,
            isVisible: true,
            xpath: '/html/body/form/input',
            cssSelector: 'input#email',
          },
          inputType: 'email',
          name: 'email',
          label: 'Email',
          placeholder: 'you@example.com',
          constraints: {
            required: true,
            pattern: null,
            min: null,
            max: null,
            minLength: null,
            maxLength: 255,
          },
        },
      ],
      isMultiStep: false,
    };
    expect(form.fields).toHaveLength(1);
  });

  it('PageState captures state identity', () => {
    const state: PageState = {
      id: 'state-1',
      url: 'https://example.com',
      domHash: 'abc123',
      modalIndicators: [],
      timestamp: Date.now(),
    };
    expect(state.url).toBe('https://example.com');
  });

  it('DomDiff captures added, removed, and modified elements', () => {
    const diff: DomDiff = {
      added: [],
      removed: [],
      modified: [
        {
          before: {
            tag: 'span',
            id: null,
            classes: [],
            attributes: {},
            textContent: 'old',
            children: [],
            boundingBox: null,
            isVisible: true,
            xpath: '/html/body/span',
            cssSelector: 'span',
          },
          after: {
            tag: 'span',
            id: null,
            classes: [],
            attributes: {},
            textContent: 'new',
            children: [],
            boundingBox: null,
            isVisible: true,
            xpath: '/html/body/span',
            cssSelector: 'span',
          },
          changes: [
            {
              type: 'text',
              name: 'textContent',
              oldValue: 'old',
              newValue: 'new',
            },
          ],
        },
      ],
    };
    expect(diff.modified).toHaveLength(1);
  });

  it('RawDomData represents serialized browser output', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [],
      boundingBox: null,
      isVisible: true,
    };
    expect(raw.tag).toBe('div');
  });

  it('RawAccessibilityNode represents browser a11y snapshot', () => {
    const raw: RawAccessibilityNode = {
      role: 'button',
      name: 'Submit',
      description: '',
      value: null,
      children: [],
    };
    expect(raw.role).toBe('button');
  });

  // Ensure unused type imports don't cause type errors
  it('all types are importable', () => {
    const _bb: BoundingBox = { x: 0, y: 0, width: 0, height: 0 };
    const _ai: AccessibilityInfo = { name: '', role: '', description: '', states: {} };
    const _ac: AttributeChange = { type: 'text', name: '', oldValue: null, newValue: null };
    const _fc: FieldConstraints = {
      required: false,
      pattern: null,
      min: null,
      max: null,
      minLength: null,
      maxLength: null,
    };
    expect(_bb).toBeDefined();
    expect(_ai).toBeDefined();
    expect(_ac).toBeDefined();
    expect(_fc).toBeDefined();
  });
});
