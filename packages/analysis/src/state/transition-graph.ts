import type { StateTransitionGraph } from '../types.js';

/**
 * Serialize a StateTransitionGraph to a JSON string.
 *
 * The graph is already a plain, JSON-serializable object (readonly arrays and
 * primitives only) so this is a thin wrapper that centralizes the
 * serialization concern and makes the intent explicit at call sites.
 */
export function exportGraphJson(graph: StateTransitionGraph): string {
  return JSON.stringify(graph, null, 2);
}
