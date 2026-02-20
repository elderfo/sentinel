import type {
  RawAccessibilityNode,
  AccessibilityInfo,
  InteractiveElement,
  AccessibilityIssue,
} from '../types.js';

/**
 * Recursively walks the raw accessibility tree and collects nodes that have a
 * non-empty role into a flat array of AccessibilityInfo.
 */
export function parseAccessibilityTree(root: RawAccessibilityNode): readonly AccessibilityInfo[] {
  const results: AccessibilityInfo[] = [];
  collectA11yNodes(root, results);
  return results;
}

function collectA11yNodes(node: RawAccessibilityNode, results: AccessibilityInfo[]): void {
  if (node.role.trim().length > 0) {
    const states: Record<string, string | boolean> = {};
    if (node.value !== null) {
      states['value'] = node.value;
    }

    results.push({
      name: node.name,
      role: node.role,
      description: node.description,
      states,
    });
  }

  for (const child of node.children) {
    collectA11yNodes(child, results);
  }
}

/**
 * Inspects each interactive element and returns a list of accessibility issues.
 *
 * Checks:
 * - missing-accessible-name: element has no accessible name from any source
 * - missing-from-a11y-tree: element has no a11y info and no explicit role attribute
 */
export function findAccessibilityIssues(
  elements: readonly InteractiveElement[],
): readonly AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (const element of elements) {
    const { node, accessibilityInfo } = element;
    const attrs = node.attributes;

    const hasAccessibleName =
      node.textContent.trim().length > 0 ||
      Boolean(attrs['aria-label']?.trim()) ||
      Boolean(attrs['aria-labelledby']?.trim()) ||
      Boolean(attrs['title']?.trim()) ||
      Boolean(accessibilityInfo?.name.trim());

    if (!hasAccessibleName) {
      issues.push({ node, issue: 'missing-accessible-name' });
    }

    const missingFromTree = accessibilityInfo === null && !('role' in attrs);
    if (missingFromTree) {
      issues.push({ node, issue: 'missing-from-a11y-tree' });
    }
  }

  return issues;
}
