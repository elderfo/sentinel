import { describe, it, expect } from 'vitest';
import { detectVisualElements } from '../visual/visual-detector.js';
import type { DomNode, InteractiveElement } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    isVisible: true,
    xpath: '/test',
    cssSelector: 'test',
    ...overrides,
  };
}

function makeInteractive(node: DomNode): InteractiveElement {
  return { node, category: 'button', isDisabled: false, accessibilityInfo: null };
}

describe('detectVisualElements', () => {
  it('detects canvas elements', () => {
    const root = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'canvas', boundingBox: { x: 0, y: 0, width: 400, height: 300 } })],
    });
    const result = detectVisualElements(root, []);
    expect(result.canvasElements).toHaveLength(1);
    expect(result.canvasElements[0]).toMatchObject({ tag: 'canvas' });
    expect(result.visualRegions.length).toBeGreaterThanOrEqual(1);
    expect(result.visualRegions[0]).toMatchObject({
      label: 'canvas-control',
      source: 'dom-structural',
    });
  });

  it('detects SVG containers as visual regions', () => {
    const root = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'svg',
          boundingBox: { x: 10, y: 10, width: 24, height: 24 },
          attributes: { role: 'img' },
        }),
      ],
    });
    const result = detectVisualElements(root, []);
    expect(result.visualRegions.some((r) => r.label === 'svg-graphic')).toBe(true);
  });

  it('detects elements with background-image as visual regions', () => {
    const root = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'div',
          attributes: { style: 'background-image: url(hero.jpg)' },
          boundingBox: { x: 0, y: 0, width: 800, height: 400 },
        }),
      ],
    });
    const result = detectVisualElements(root, []);
    expect(result.visualRegions.some((r) => r.label === 'image-background')).toBe(true);
  });

  it('detects image map areas', () => {
    const root = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'area',
          attributes: { href: '/link', shape: 'rect', coords: '0,0,100,100' },
          boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        }),
      ],
    });
    const result = detectVisualElements(root, []);
    expect(result.visualRegions.some((r) => r.label === 'image-map-area')).toBe(true);
  });

  it('marks visual regions as unmatched when not in interactive elements list', () => {
    const canvas = makeNode({
      tag: 'canvas',
      boundingBox: { x: 0, y: 0, width: 400, height: 300 },
    });
    const root = makeNode({ tag: 'div', children: [canvas] });
    const result = detectVisualElements(root, []);
    expect(result.unmatchedRegions).toHaveLength(result.visualRegions.length);
  });

  it('does not mark visual regions as unmatched when they overlap with interactive elements', () => {
    const canvas = makeNode({
      tag: 'canvas',
      boundingBox: { x: 0, y: 0, width: 400, height: 300 },
    });
    const root = makeNode({ tag: 'div', children: [canvas] });
    const interactives = [makeInteractive(canvas)];
    const result = detectVisualElements(root, interactives);
    expect(result.unmatchedRegions).toHaveLength(0);
  });

  it('skips invisible elements', () => {
    const root = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'canvas', isVisible: false })],
    });
    const result = detectVisualElements(root, []);
    expect(result.canvasElements).toHaveLength(0);
    expect(result.visualRegions).toHaveLength(0);
  });

  it('returns empty results for a tree with no visual elements', () => {
    const root = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'p', textContent: 'Hello' })],
    });
    const result = detectVisualElements(root, []);
    expect(result.visualRegions).toHaveLength(0);
    expect(result.unmatchedRegions).toHaveLength(0);
    expect(result.canvasElements).toHaveLength(0);
  });
});
