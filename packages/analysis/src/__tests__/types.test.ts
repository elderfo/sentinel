import { describe, it, expect } from 'vitest';
import type {
  DomNode,
  ElementCategory,
  InteractiveElement,
  FormModel,
  PageState,
  DomDiff,
  RawDomData,
  RawAccessibilityNode,
  VisualRegion,
  VisualRegionSource,
  VisualDetectionResult,
  SelectorStrategy,
  SelectorCandidate,
  StabilityAnalysis,
  StabilizedElement,
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

  it('VisualRegion captures detected visual area', () => {
    const region: VisualRegion = {
      boundingBox: { x: 10, y: 20, width: 200, height: 100 },
      confidence: 0.95,
      label: 'canvas-control',
      source: 'dom-structural',
    };
    expect(region.source).toBe('dom-structural');
    expect(region.confidence).toBe(0.95);
  });

  it('VisualDetectionResult captures all detection outputs', () => {
    const result: VisualDetectionResult = {
      visualRegions: [
        {
          boundingBox: { x: 0, y: 0, width: 300, height: 150 },
          confidence: 1.0,
          label: 'canvas-control',
          source: 'dom-structural',
        },
      ],
      unmatchedRegions: [],
      canvasElements: [],
    };
    expect(result.visualRegions).toHaveLength(1);
  });

  it('VisualRegionSource covers all expected values', () => {
    const sources: VisualRegionSource[] = ['dom-structural', 'visual-recognition'];
    expect(sources).toHaveLength(2);
  });

  it('SelectorCandidate captures strategy with score', () => {
    const candidate: SelectorCandidate = {
      strategy: 'id',
      value: '#submit-btn',
      score: 100,
    };
    expect(candidate.strategy).toBe('id');
    expect(candidate.score).toBe(100);
  });

  it('StabilityAnalysis provides ranked selectors with recommendation', () => {
    const analysis: StabilityAnalysis = {
      selectors: [
        { strategy: 'id', value: '#submit', score: 100 },
        { strategy: 'aria', value: '[role="button"][aria-label="Submit"]', score: 80 },
      ],
      recommendedSelector: { strategy: 'id', value: '#submit', score: 100 },
    };
    expect(analysis.selectors).toHaveLength(2);
    expect(analysis.recommendedSelector.strategy).toBe('id');
  });

  it('StabilizedElement extends InteractiveElement with stability', () => {
    const element: StabilizedElement = {
      node: {
        tag: 'button',
        id: 'submit',
        classes: ['btn'],
        attributes: {},
        textContent: 'Submit',
        children: [],
        boundingBox: { x: 0, y: 0, width: 80, height: 30 },
        isVisible: true,
        xpath: '/html/body/button',
        cssSelector: 'button#submit',
      },
      category: 'button',
      isDisabled: false,
      accessibilityInfo: null,
      stability: {
        selectors: [{ strategy: 'id', value: '#submit', score: 100 }],
        recommendedSelector: { strategy: 'id', value: '#submit', score: 100 },
      },
    };
    expect(element.stability.recommendedSelector.strategy).toBe('id');
  });

  it('SelectorStrategy covers all expected values', () => {
    const strategies: SelectorStrategy[] = ['id', 'css', 'xpath', 'aria'];
    expect(strategies).toHaveLength(4);
  });
});
