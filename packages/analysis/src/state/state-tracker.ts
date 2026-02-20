import type { DomNode, PageState, StateTransition, StateTransitionGraph } from '../types.js';
import { hashDomContent } from './state-hasher.js';
import { diffDom } from '../diff/dom-differ.js';

/**
 * Determine whether a new state is meaningfully different from the previous
 * one. We treat a state as new when the URL, the DOM content hash, or the set
 * of active modal indicators changes.
 */
function hasChanged(
  prev: PageState,
  url: string,
  domHash: string,
  modalIndicators: readonly string[],
): boolean {
  if (prev.url !== url) return true;
  if (prev.domHash !== domHash) return true;
  if (prev.modalIndicators.length !== modalIndicators.length) return true;
  for (let i = 0; i < modalIndicators.length; i++) {
    if (prev.modalIndicators[i] !== modalIndicators[i]) return true;
  }
  return false;
}

/**
 * Generate a simple sequential ID for each state. Using an integer counter
 * rather than a random UUID keeps tests deterministic without requiring mocks.
 */
function makeStateId(index: number): string {
  return `state-${String(index)}`;
}

/**
 * StateTracker records page states and the transitions between them as the
 * user (or automation) navigates an application.
 *
 * Call `recordState` after every meaningful interaction and `exportGraph` to
 * retrieve the full navigation graph for later analysis.
 */
export class StateTracker {
  private readonly states: PageState[] = [];
  private readonly transitions: StateTransition[] = [];
  // We keep the last DomNode alongside the last PageState so we can diff
  // against it when a transition occurs.
  private lastDomRoot: DomNode | null = null;

  recordState(
    url: string,
    domRoot: DomNode,
    modalIndicators: readonly string[],
    action?: string,
  ): void {
    const domHash = hashDomContent(domRoot);
    const prev = this.states[this.states.length - 1];

    if (prev !== undefined && !hasChanged(prev, url, domHash, modalIndicators)) {
      // State is identical — no new entry needed
      return;
    }

    const newState: PageState = {
      id: makeStateId(this.states.length),
      url,
      domHash,
      modalIndicators,
      timestamp: Date.now(),
    };

    if (prev !== undefined) {
      const domDiff = this.lastDomRoot !== null ? diffDom(this.lastDomRoot, domRoot) : null;

      const transition: StateTransition = {
        action: action ?? 'navigate',
        preState: prev,
        postState: newState,
        domDiff,
      };
      this.transitions.push(transition);
    }

    this.states.push(newState);
    this.lastDomRoot = domRoot;
  }

  exportGraph(): StateTransitionGraph {
    return {
      states: [...this.states],
      transitions: [...this.transitions],
    };
  }
}
