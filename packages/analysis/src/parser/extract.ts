import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { RawDomData, DomNode } from '../types.js';
import { parseDom } from './dom-parser.js';

/**
 * JavaScript function serialized as a string to be evaluated in the browser context.
 * Walks the DOM and returns a RawDomData tree of visible elements.
 */
const DOM_EXTRACTION_SCRIPT = `() => {
  function serializeNode(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const isVisible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0;

    const attrs = {};
    for (const attr of el.attributes) {
      attrs[attr.name] = attr.value;
    }

    const children = [];
    for (const child of el.children) {
      children.push(serializeNode(child));
    }

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: [...el.classList],
      attributes: attrs,
      textContent: el.textContent?.trim() ?? '',
      children,
      boundingBox: isVisible
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : null,
      isVisible,
    };
  }

  return serializeNode(document.body);
}`;

/** Extract and parse the DOM from a browser page. */
export async function extractDom(engine: BrowserEngine, page: PageHandle): Promise<DomNode> {
  const raw = await engine.evaluate<RawDomData>(page, DOM_EXTRACTION_SCRIPT);
  return parseDom(raw);
}
