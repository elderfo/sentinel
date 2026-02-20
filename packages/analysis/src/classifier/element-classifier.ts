import type { DomNode, InteractiveElement, ElementCategory } from '../types.js';
import { categorizeByRole, categorizeByTag } from './rules.js';

function isDisabled(attributes: Readonly<Record<string, string>>): boolean {
  if ('disabled' in attributes) return true;
  if ('aria-disabled' in attributes && attributes['aria-disabled'] === 'true') return true;
  return false;
}

function hasPointerEventsNone(attributes: Readonly<Record<string, string>>): boolean {
  const style = attributes['style'];
  if (!style) return false;
  return /pointer-events\s*:\s*none/i.test(style);
}

function classifyNode(node: DomNode): ElementCategory | null {
  const role = node.attributes['role'];
  if (role) {
    return categorizeByRole(role);
  }
  return categorizeByTag(node.tag, node.attributes);
}

function collectInteractive(node: DomNode, results: InteractiveElement[]): void {
  if (!node.isVisible) return;

  const category = classifyNode(node);
  if (category !== null) {
    const disabled = isDisabled(node.attributes);
    const pointerEventsNone = hasPointerEventsNone(node.attributes);

    if (!disabled && !pointerEventsNone) {
      results.push({
        node,
        category,
        isDisabled: false,
        accessibilityInfo: null,
      });
    }
  }

  for (const child of node.children) {
    collectInteractive(child, results);
  }
}

/** Walk a DomNode tree and return all interactive elements with classifications. */
export function classifyInteractiveElements(root: DomNode): readonly InteractiveElement[] {
  const results: InteractiveElement[] = [];
  collectInteractive(root, results);
  return results;
}
