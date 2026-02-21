import type {
  StateTransitionGraph,
  StabilizedElement,
  StateTransition,
  DomNode,
  SelectorStrategy,
} from '@sentinel/analysis';
import type { TestCase, TestAssertion, TestStep, GeneratorConfig } from '../types.js';
import { scoreConfidence, filterByDepth } from './confidence.js';

/**
 * Resolves the best selector for a DOM node by checking stabilized elements
 * first, then falling back to the node's own cssSelector.
 */
function resolveSelector(
  node: DomNode,
  stabilizedElements: readonly StabilizedElement[],
): { readonly selector: string; readonly selectorStrategy: SelectorStrategy } {
  const match = stabilizedElements.find((se) => se.node.cssSelector === node.cssSelector);
  if (match) {
    return {
      selector: match.stability.recommendedSelector.value,
      selectorStrategy: match.stability.recommendedSelector.strategy,
    };
  }
  return { selector: node.cssSelector, selectorStrategy: 'css' };
}

/**
 * Derives assertions from a single state transition's DOM diff and URL change.
 */
function assertionsFromTransition(
  transition: StateTransition,
  stabilizedElements: readonly StabilizedElement[],
): readonly TestAssertion[] {
  const confidence = scoreConfidence(transition);
  const assertions: TestAssertion[] = [];

  // URL change → url-match assertion
  if (transition.preState.url !== transition.postState.url) {
    assertions.push({
      type: 'url-match',
      selector: 'window.location',
      selectorStrategy: 'css',
      expected: transition.postState.url,
      confidence,
      description: `URL changed from ${transition.preState.url} to ${transition.postState.url}`,
    });
  }

  const diff = transition.domDiff;
  if (diff === null) {
    return assertions;
  }

  // Added elements → visibility true
  for (const added of diff.added) {
    const { selector, selectorStrategy } = resolveSelector(added, stabilizedElements);
    assertions.push({
      type: 'visibility',
      selector,
      selectorStrategy,
      expected: 'true',
      confidence,
      description: `Element <${added.tag}> appeared after action`,
    });
  }

  // Removed elements → visibility false
  for (const removed of diff.removed) {
    const { selector, selectorStrategy } = resolveSelector(removed, stabilizedElements);
    assertions.push({
      type: 'visibility',
      selector,
      selectorStrategy,
      expected: 'false',
      confidence,
      description: `Element <${removed.tag}> disappeared after action`,
    });
  }

  // Modified elements
  for (const mod of diff.modified) {
    for (const change of mod.changes) {
      const { selector, selectorStrategy } = resolveSelector(mod.after, stabilizedElements);

      if (change.type === 'text') {
        assertions.push({
          type: 'text-content',
          selector,
          selectorStrategy,
          expected: change.newValue ?? '',
          confidence,
          description: `Text content changed from "${change.oldValue ?? ''}" to "${change.newValue ?? ''}"`,
        });
      } else {
        // attribute or class change
        assertions.push({
          type: 'attribute-value',
          selector,
          selectorStrategy,
          expected: change.newValue ?? '',
          confidence,
          description: `Attribute "${change.name}" changed from "${change.oldValue ?? ''}" to "${change.newValue ?? ''}"`,
        });
      }
    }
  }

  return assertions;
}

/**
 * Generates assertions for test case steps by correlating them with
 * state transitions from the exploration graph.
 *
 * Each step is matched to a transition by index (step i of test case maps
 * to transition i in the graph). For each matching transition, assertions
 * are derived from URL changes and DOM diffs, scored for confidence, and
 * filtered according to the configured assertion depth.
 */
export function generateAssertions(
  testCases: readonly TestCase[],
  stateGraph: StateTransitionGraph,
  stabilizedElements: readonly StabilizedElement[],
  config: GeneratorConfig,
): readonly TestCase[] {
  const transitions = stateGraph.transitions;

  return testCases.map((testCase) => {
    const updatedSteps: readonly TestStep[] = testCase.steps.map((step, stepIndex) => {
      // Match step to transition by index
      const transition = transitions[stepIndex];
      if (transition === undefined) {
        return step;
      }

      const rawAssertions = assertionsFromTransition(transition, stabilizedElements);
      const filtered = filterByDepth(rawAssertions, config.assertionDepth);

      if (filtered.length === 0) {
        return step;
      }

      return {
        ...step,
        assertions: [...step.assertions, ...filtered],
      };
    });

    // Only create a new test case object if any step actually changed
    const changed = updatedSteps.some((step, i) => step !== testCase.steps[i]);

    return changed ? { ...testCase, steps: updatedSteps } : testCase;
  });
}
