import { describe, it, expect } from 'vitest';
import { parseDom } from '../parser/index.js';
import type { RawDomData } from '../types.js';

describe('parseDom', () => {
  it('parses a single visible element', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: 'root',
      classes: ['container'],
      attributes: { 'data-testid': 'root' },
      textContent: 'Hello',
      children: [],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.tag).toBe('div');
    expect(result.id).toBe('root');
    expect(result.classes).toEqual(['container']);
    expect(result.textContent).toBe('Hello');
    expect(result.xpath).toBe('/div');
    expect(result.cssSelector).toBe('div#root');
    expect(result.children).toEqual([]);
  });

  it('preserves parent-child hierarchy', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [
        {
          tag: 'span',
          id: null,
          classes: ['text'],
          attributes: {},
          textContent: 'Child',
          children: [],
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
          isVisible: true,
        },
      ],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.children).toHaveLength(1);
    expect(result.children[0]?.tag).toBe('span');
    expect(result.children[0]?.xpath).toBe('/div/span');
    expect(result.children[0]?.cssSelector).toBe('div > span.text');
  });

  it('excludes invisible elements', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [
        {
          tag: 'span',
          id: null,
          classes: [],
          attributes: {},
          textContent: 'Visible',
          children: [],
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
          isVisible: true,
        },
        {
          tag: 'span',
          id: null,
          classes: [],
          attributes: {},
          textContent: 'Hidden',
          children: [],
          boundingBox: null,
          isVisible: false,
        },
      ],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.children).toHaveLength(1);
    expect(result.children[0]?.textContent).toBe('Visible');
  });

  it('generates unique xpaths with sibling indices', () => {
    const raw: RawDomData = {
      tag: 'ul',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [
        {
          tag: 'li',
          id: null,
          classes: [],
          attributes: {},
          textContent: 'First',
          children: [],
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
          isVisible: true,
        },
        {
          tag: 'li',
          id: null,
          classes: [],
          attributes: {},
          textContent: 'Second',
          children: [],
          boundingBox: { x: 0, y: 20, width: 100, height: 20 },
          isVisible: true,
        },
      ],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.children[0]?.xpath).toBe('/ul/li[1]');
    expect(result.children[1]?.xpath).toBe('/ul/li[2]');
  });

  it('uses id for CSS selector when available', () => {
    const raw: RawDomData = {
      tag: 'input',
      id: 'email',
      classes: ['form-control', 'required'],
      attributes: { type: 'email' },
      textContent: '',
      children: [],
      boundingBox: { x: 0, y: 0, width: 200, height: 30 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.cssSelector).toBe('input#email');
  });

  it('produces deterministic output for identical input', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: 'app',
      classes: [],
      attributes: {},
      textContent: 'Test',
      children: [],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result1 = parseDom(raw);
    const result2 = parseDom(raw);

    expect(result1).toEqual(result2);
  });
});
