import type { DomNode, DomDiff, ElementModification, AttributeChange } from '../types.js';

/**
 * Recursively walk a DomNode tree and collect all nodes into a flat map keyed
 * by xpath. XPaths are unique within a parsed tree so this gives us O(1)
 * lookup when comparing before/after snapshots.
 */
function flattenTree(node: DomNode, map: Map<string, DomNode>): void {
  map.set(node.xpath, node);
  for (const child of node.children) {
    flattenTree(child, map);
  }
}

/**
 * Compute the attribute-level changes between two versions of the same node.
 * Returns an empty array when the nodes are semantically identical.
 */
function computeChanges(before: DomNode, after: DomNode): readonly AttributeChange[] {
  const changes: AttributeChange[] = [];

  // Text content
  if (before.textContent !== after.textContent) {
    changes.push({
      type: 'text',
      name: 'textContent',
      oldValue: before.textContent,
      newValue: after.textContent,
    });
  }

  // Class list — compare as sorted sets so order differences don't matter
  const beforeClasses = [...before.classes].sort().join(' ');
  const afterClasses = [...after.classes].sort().join(' ');
  if (beforeClasses !== afterClasses) {
    changes.push({
      type: 'class',
      name: 'class',
      oldValue: beforeClasses || null,
      newValue: afterClasses || null,
    });
  }

  // Attributes — detect added, removed, and changed values
  const allAttrNames = new Set([
    ...Object.keys(before.attributes),
    ...Object.keys(after.attributes),
  ]);

  for (const name of allAttrNames) {
    const oldValue = before.attributes[name] ?? null;
    const newValue = after.attributes[name] ?? null;
    if (oldValue !== newValue) {
      changes.push({ type: 'attribute', name, oldValue, newValue });
    }
  }

  return changes;
}

/**
 * Diff two DOM trees by comparing their flattened xpath maps.
 *
 * - Nodes present only in `after`  → added
 * - Nodes present only in `before` → removed
 * - Nodes present in both          → inspected for content/attribute changes
 */
export function diffDom(before: DomNode, after: DomNode): DomDiff {
  const beforeMap = new Map<string, DomNode>();
  const afterMap = new Map<string, DomNode>();

  flattenTree(before, beforeMap);
  flattenTree(after, afterMap);

  const added: DomNode[] = [];
  const removed: DomNode[] = [];
  const modified: ElementModification[] = [];

  for (const [xpath, afterNode] of afterMap) {
    if (!beforeMap.has(xpath)) {
      added.push(afterNode);
    }
  }

  for (const [xpath, beforeNode] of beforeMap) {
    if (!afterMap.has(xpath)) {
      removed.push(beforeNode);
    } else {
      const afterNode = afterMap.get(xpath) as DomNode;
      const changes = computeChanges(beforeNode, afterNode);
      if (changes.length > 0) {
        modified.push({ before: beforeNode, after: afterNode, changes });
      }
    }
  }

  return { added, removed, modified };
}
