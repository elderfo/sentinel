/**
 * @sentinel/analysis
 *
 * DOM analysis engine for the Sentinel QA platform.
 * Provides DOM parsing, element classification, accessibility analysis,
 * form detection, DOM diffing, and application state tracking.
 */

export type {
  BoundingBox,
  RawDomData,
  RawAccessibilityNode,
  DomNode,
  ElementCategory,
  InteractiveElement,
  AccessibilityInfo,
  AccessibilityIssueType,
  AccessibilityIssue,
  FieldConstraints,
  FormField,
  FormModel,
  PageState,
  StateTransition,
  StateTransitionGraph,
  AttributeChangeType,
  AttributeChange,
  ElementModification,
  DomDiff,
} from './types.js';

export { parseDom } from './parser/index.js';

export {
  classifyInteractiveElements,
  categorizeByRole,
  categorizeByTag,
} from './classifier/index.js';
