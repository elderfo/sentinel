import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { RawAccessibilityNode, AccessibilityInfo } from '../types.js';
import { parseAccessibilityTree } from './accessibility-analyzer.js';

/**
 * JavaScript function serialized as a string to extract the accessibility tree.
 * Walks ARIA attributes on DOM elements as a cross-browser fallback.
 */
const A11Y_EXTRACTION_SCRIPT = `() => {
  function walkAriaTree(el) {
    const role = el.getAttribute('role') || '';
    const name =
      el.getAttribute('aria-label') ||
      el.textContent?.trim() ||
      '';
    const description = el.getAttribute('aria-describedby') || '';
    const value = el.getAttribute('aria-valuenow') || null;

    const children = [];
    for (const child of el.children) {
      children.push(walkAriaTree(child));
    }

    return { role, name, description, value, children };
  }

  return walkAriaTree(document.body);
}`;

/** Extract and parse the accessibility tree from a browser page. */
export async function extractAccessibilityTree(
  engine: BrowserEngine,
  page: PageHandle,
): Promise<readonly AccessibilityInfo[]> {
  const raw = await engine.evaluate<RawAccessibilityNode>(page, A11Y_EXTRACTION_SCRIPT);
  return parseAccessibilityTree(raw);
}
