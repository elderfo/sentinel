/**
 * @sentinel/analysis
 *
 * DOM analysis engine for the Sentinel QA platform.
 * Provides DOM parsing, element classification, accessibility analysis,
 * form detection, DOM diffing, application state tracking, and element stability analysis.
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
  VisualRegion,
  VisualRegionSource,
  VisualDetectionResult,
  SelectorStrategy,
  SelectorCandidate,
  StabilityAnalysis,
  StabilizedElement,
} from './types.js';

export { parseDom, extractDom } from './parser/index.js';

export {
  classifyInteractiveElements,
  categorizeByRole,
  categorizeByTag,
} from './classifier/index.js';

export { diffDom } from './diff/index.js';
export { StateTracker, hashDomContent, exportGraphJson } from './state/index.js';

export {
  parseAccessibilityTree,
  mergeAccessibility,
  findAccessibilityIssues,
  extractAccessibilityTree,
} from './accessibility/index.js';

export { detectForms, extractConstraints } from './forms/index.js';

export {
  detectVisualElements,
  type VisualRecognizer,
  NoOpVisualRecognizer,
  extractVisualElements,
} from './visual/index.js';

export { analyzeStability, isDynamicId } from './stability/index.js';
