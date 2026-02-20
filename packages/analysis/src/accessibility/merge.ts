import type { InteractiveElement, RawAccessibilityNode, AccessibilityInfo } from '../types.js';
import { parseAccessibilityTree } from './accessibility-analyzer.js';

/**
 * Matches an a11y entry to an interactive element's node using a priority-ordered
 * strategy: role+name match first, then name only, then role only.
 */
function findMatch(entry: AccessibilityInfo, element: InteractiveElement): boolean {
  const nodeRole = element.node.attributes['role'] ?? null;
  const nodeText = element.node.textContent.trim();
  const nodeAriaLabel = element.node.attributes['aria-label']?.trim() ?? '';

  const nameMatch =
    entry.name.trim().length > 0 &&
    (entry.name.trim() === nodeText || entry.name.trim() === nodeAriaLabel);

  const roleMatch = nodeRole !== null && entry.role === nodeRole;

  if (roleMatch && nameMatch) return true;
  if (nameMatch) return true;
  if (roleMatch) return true;

  return false;
}

/**
 * Parses the raw accessibility tree and populates the `accessibilityInfo` field
 * on each interactive element by matching a11y entries to elements by role+name,
 * then name, then role.
 */
export function mergeAccessibility(
  elements: readonly InteractiveElement[],
  rawA11yTree: RawAccessibilityNode,
): readonly InteractiveElement[] {
  const a11yEntries = parseAccessibilityTree(rawA11yTree);

  return elements.map((element) => {
    const match = a11yEntries.find((entry) => findMatch(entry, element));
    if (match === undefined) {
      return element;
    }
    return { ...element, accessibilityInfo: match };
  });
}
