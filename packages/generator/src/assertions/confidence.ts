import type { AssertionDepth, TestAssertion } from '../types.js';
import type { StateTransition } from '@sentinel/analysis';

const TIMESTAMP_PATTERN =
  /\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}\s*(AM|PM|am|pm)?|\d{1,2}\/\d{1,2}\/\d{2,4}/;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const NUMBER_PATTERN = /\d+/;

export function scoreConfidence(transition: StateTransition): number {
  // URL change is a strong, deterministic signal
  if (transition.preState.url !== transition.postState.url) return 1.0;

  const diff = transition.domDiff;
  if (diff === null) return 0.5;

  // Elements added or removed are structural changes — high confidence
  if (diff.added.length > 0 || diff.removed.length > 0) return 1.0;

  // Check individual modifications
  if (diff.modified.length > 0) {
    for (const mod of diff.modified) {
      for (const change of mod.changes) {
        // Attribute or class changes are deterministic
        if (change.type === 'attribute' || change.type === 'class') return 1.0;

        // Text changes — evaluate content stability
        const newVal = change.newValue ?? '';
        if (TIMESTAMP_PATTERN.test(newVal)) return 0.3;
        if (UUID_PATTERN.test(newVal)) return 0.3;
        if (NUMBER_PATTERN.test(newVal)) return 0.5;
        return 0.8; // Static text
      }
    }
  }

  return 0.5;
}

export function filterByDepth(
  assertions: readonly TestAssertion[],
  depth: AssertionDepth,
): readonly TestAssertion[] {
  const thresholds: Record<AssertionDepth, number> = {
    minimal: 0.8,
    standard: 0.5,
    verbose: 0,
  };
  const threshold = thresholds[depth];
  return assertions.filter((a) => a.confidence >= threshold);
}
