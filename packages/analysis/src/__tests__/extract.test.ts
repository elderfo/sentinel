import { describe, it, expect, vi } from 'vitest';
import { extractDom, extractAccessibilityTree } from '../index.js';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { RawDomData, RawAccessibilityNode } from '../types.js';

const mockPage = 'page-1' as PageHandle;

describe('extractDom', () => {
  it('calls evaluate and returns parsed DomNode', async () => {
    const rawDom: RawDomData = {
      tag: 'div',
      id: 'root',
      classes: [],
      attributes: {},
      textContent: 'Hello',
      children: [],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const evaluateFn = vi.fn().mockResolvedValue(rawDom);
    const engine = { evaluate: evaluateFn } as unknown as BrowserEngine;

    const result = await extractDom(engine, mockPage);

    expect(result.tag).toBe('div');
    expect(result.xpath).toBe('/div');
    expect(evaluateFn).toHaveBeenCalledOnce();
  });
});

describe('extractAccessibilityTree', () => {
  it('calls evaluate and returns parsed accessibility info', async () => {
    const rawA11y: RawAccessibilityNode = {
      role: 'button',
      name: 'Submit',
      description: '',
      value: null,
      children: [],
    };

    const evaluateFn = vi.fn().mockResolvedValue(rawA11y);
    const engine = { evaluate: evaluateFn } as unknown as BrowserEngine;

    const result = await extractAccessibilityTree(engine, mockPage);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe('button');
    expect(evaluateFn).toHaveBeenCalledOnce();
  });
});
