// ---------------------------------------------------------------------------
// Bounding box
// ---------------------------------------------------------------------------

export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// ---------------------------------------------------------------------------
// Raw data from browser — input to pure parsers
// ---------------------------------------------------------------------------

/** Serialized DOM node as returned by evaluate() in the browser context. */
export interface RawDomData {
  readonly tag: string;
  readonly id: string | null;
  readonly classes: readonly string[];
  readonly attributes: Readonly<Record<string, string>>;
  readonly textContent: string;
  readonly children: readonly RawDomData[];
  readonly boundingBox: BoundingBox | null;
  readonly isVisible: boolean;
}

/** Serialized accessibility tree node from the browser's accessibility API. */
export interface RawAccessibilityNode {
  readonly role: string;
  readonly name: string;
  readonly description: string;
  readonly value: string | null;
  readonly children: readonly RawAccessibilityNode[];
}

// ---------------------------------------------------------------------------
// Parsed DOM model
// ---------------------------------------------------------------------------

export interface DomNode {
  readonly tag: string;
  readonly id: string | null;
  readonly classes: readonly string[];
  readonly attributes: Readonly<Record<string, string>>;
  readonly textContent: string;
  readonly children: readonly DomNode[];
  readonly boundingBox: BoundingBox | null;
  readonly isVisible: boolean;
  readonly xpath: string;
  readonly cssSelector: string;
}

// ---------------------------------------------------------------------------
// Interactive element classification
// ---------------------------------------------------------------------------

export type ElementCategory =
  | 'navigation-link'
  | 'button'
  | 'form-field'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'date-picker'
  | 'file-upload';

export interface InteractiveElement {
  readonly node: DomNode;
  readonly category: ElementCategory;
  readonly isDisabled: boolean;
  readonly accessibilityInfo: AccessibilityInfo | null;
}

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

export interface AccessibilityInfo {
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly states: Readonly<Record<string, string | boolean>>;
}

export type AccessibilityIssueType =
  | 'missing-from-a11y-tree'
  | 'missing-accessible-name'
  | 'missing-role';

export interface AccessibilityIssue {
  readonly node: DomNode;
  readonly issue: AccessibilityIssueType;
}

// ---------------------------------------------------------------------------
// Form model
// ---------------------------------------------------------------------------

export interface FieldConstraints {
  readonly required: boolean;
  readonly pattern: string | null;
  readonly min: string | null;
  readonly max: string | null;
  readonly minLength: number | null;
  readonly maxLength: number | null;
}

export interface FormField {
  readonly node: DomNode;
  readonly inputType: string;
  readonly name: string | null;
  readonly label: string | null;
  readonly placeholder: string | null;
  readonly constraints: FieldConstraints;
}

export interface FormModel {
  readonly formElement: DomNode;
  readonly action: string | null;
  readonly method: string;
  readonly fields: readonly FormField[];
  readonly isMultiStep: boolean;
}

// ---------------------------------------------------------------------------
// State tracking
// ---------------------------------------------------------------------------

export interface PageState {
  readonly id: string;
  readonly url: string;
  readonly domHash: string;
  readonly modalIndicators: readonly string[];
  readonly timestamp: number;
}

export interface StateTransition {
  readonly action: string;
  readonly preState: PageState;
  readonly postState: PageState;
  readonly domDiff: DomDiff | null;
}

export interface StateTransitionGraph {
  readonly states: readonly PageState[];
  readonly transitions: readonly StateTransition[];
}

// ---------------------------------------------------------------------------
// DOM diff
// ---------------------------------------------------------------------------

export type AttributeChangeType = 'attribute' | 'text' | 'class';

export interface AttributeChange {
  readonly type: AttributeChangeType;
  readonly name: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

export interface ElementModification {
  readonly before: DomNode;
  readonly after: DomNode;
  readonly changes: readonly AttributeChange[];
}

export interface DomDiff {
  readonly added: readonly DomNode[];
  readonly removed: readonly DomNode[];
  readonly modified: readonly ElementModification[];
}

// ---------------------------------------------------------------------------
// Visual element recognition
// ---------------------------------------------------------------------------

export type VisualRegionSource = 'dom-structural' | 'visual-recognition';

export interface VisualRegion {
  readonly boundingBox: BoundingBox;
  readonly confidence: number;
  readonly label: string;
  readonly source: VisualRegionSource;
}

export interface VisualDetectionResult {
  readonly visualRegions: readonly VisualRegion[];
  readonly unmatchedRegions: readonly VisualRegion[];
  readonly canvasElements: readonly DomNode[];
}

// ---------------------------------------------------------------------------
// Element stability analysis
// ---------------------------------------------------------------------------

export type SelectorStrategy = 'id' | 'css' | 'xpath' | 'aria';

export interface SelectorCandidate {
  readonly strategy: SelectorStrategy;
  readonly value: string;
  readonly score: number;
}

export interface StabilityAnalysis {
  readonly selectors: readonly SelectorCandidate[];
  readonly recommendedSelector: SelectorCandidate;
}

export interface StabilizedElement extends InteractiveElement {
  readonly stability: StabilityAnalysis;
}
