import { createHash } from 'node:crypto';
import type { DomNode } from '../types.js';

/**
 * Produce a stable string fingerprint for a DomNode subtree.
 *
 * We serialize the tree depth-first so that structural changes (additions,
 * removals, reorderings) always produce a different hash. Only visible,
 * content-bearing properties are included — positional bounding boxes are
 * intentionally excluded because layout shifts should not invalidate state
 * identity on their own.
 */
function serializeNode(node: DomNode, parts: string[]): void {
  parts.push(node.tag);
  parts.push(node.id ?? '');
  parts.push([...node.classes].sort().join(' '));
  parts.push(node.textContent);

  // Attribute names sorted for determinism across different insertion orders
  const attrKeys = Object.keys(node.attributes).sort();
  for (const key of attrKeys) {
    parts.push(key);
    parts.push(node.attributes[key] ?? '');
  }

  for (const child of node.children) {
    serializeNode(child, parts);
  }
}

/** Compute a SHA-256 hex digest of the visible DOM content. */
export function hashDomContent(root: DomNode): string {
  const parts: string[] = [];
  serializeNode(root, parts);
  return createHash('sha256').update(parts.join('\x00')).digest('hex');
}
