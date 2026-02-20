# DOM Analysis Engine Design

**Epic**: #4 - Build Application Understanding & DOM Mapping System
**Date**: 2026-02-20
**Package**: `@sentinel/analysis`

## Overview

The DOM analysis engine processes browser pages to extract structured representations, classify interactive elements, track application state, analyze accessibility, detect forms, and compute DOM diffs. It sits above `@sentinel/browser` and provides the foundation for autonomous test generation.

## Architecture

### Package: `@sentinel/analysis`

Dependencies: `@sentinel/shared` (workspace), `@sentinel/browser` (workspace)

```
packages/analysis/
├── package.json
├── vitest.config.ts
├── tsconfig.json
└── src/
    ├── index.ts                  # Public API barrel
    ├── types.ts                  # All analysis domain types
    ├── parser/
    │   ├── index.ts
    │   ├── dom-parser.ts         # Pure: raw serialized DOM → DomNode tree
    │   └── extract.ts            # BrowserEngine adapter: evaluate() → raw data → parser
    ├── classifier/
    │   ├── index.ts
    │   ├── element-classifier.ts # Pure: DomNode[] → InteractiveElement[]
    │   └── rules.ts              # Tag + ARIA role → ElementCategory mapping
    ├── accessibility/
    │   ├── index.ts
    │   ├── accessibility-analyzer.ts  # Pure: raw a11y snapshot → AccessibilityInfo[]
    │   ├── extract.ts                 # BrowserEngine adapter for accessibility tree
    │   └── merge.ts                   # Merges a11y info into DomNode model
    ├── forms/
    │   ├── index.ts
    │   ├── form-detector.ts      # Pure: DomNode tree → FormModel[]
    │   └── constraints.ts        # Extracts validation constraints from attributes
    ├── diff/
    │   ├── index.ts
    │   └── dom-differ.ts         # Pure: two DomNode trees → DomDiff
    ├── state/
    │   ├── index.ts
    │   ├── state-tracker.ts      # Stateful class: accumulates state transitions
    │   ├── state-hasher.ts       # Content hash for state identity
    │   └── transition-graph.ts   # JSON export of state transition graph
    └── __tests__/
        ├── dom-parser.test.ts
        ├── element-classifier.test.ts
        ├── accessibility-analyzer.test.ts
        ├── form-detector.test.ts
        ├── dom-differ.test.ts
        ├── state-tracker.test.ts
        └── extract.test.ts
```

### Layered API

All parsing, classification, and diffing functions are **pure** — they accept raw serialized data and return structured output. No browser dependency at this layer.

Thin **adapter files** (`extract.ts`) bridge `BrowserEngine` + `PageHandle` → `evaluate()` call → raw data → pure function. This enables:

- Unit testing with JSON fixtures (no browser mocking)
- Reuse of pure functions outside browser context
- Clear separation of I/O from logic

### Dependency Graph

```
@sentinel/shared ← @sentinel/browser ← @sentinel/analysis
@sentinel/shared ← @sentinel/analysis
```

## Types

### Core Element Model

```typescript
interface DomNode {
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

interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

### Interactive Element Classification

```typescript
type ElementCategory =
  | 'navigation-link'
  | 'button'
  | 'form-field'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'date-picker'
  | 'file-upload';

interface InteractiveElement {
  readonly node: DomNode;
  readonly category: ElementCategory;
  readonly isDisabled: boolean;
  readonly accessibilityInfo: AccessibilityInfo | null;
}
```

### Accessibility

```typescript
interface AccessibilityInfo {
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly states: Readonly<Record<string, string | boolean>>;
}

interface AccessibilityIssue {
  readonly node: DomNode;
  readonly issue: 'missing-from-a11y-tree' | 'missing-accessible-name' | 'missing-role';
}
```

### Form Model

```typescript
interface FormModel {
  readonly formElement: DomNode;
  readonly action: string | null;
  readonly method: string;
  readonly fields: readonly FormField[];
  readonly isMultiStep: boolean;
}

interface FormField {
  readonly node: DomNode;
  readonly inputType: string;
  readonly name: string | null;
  readonly label: string | null;
  readonly placeholder: string | null;
  readonly constraints: FieldConstraints;
}

interface FieldConstraints {
  readonly required: boolean;
  readonly pattern: string | null;
  readonly min: string | null;
  readonly max: string | null;
  readonly minLength: number | null;
  readonly maxLength: number | null;
}
```

### State Tracking

```typescript
interface PageState {
  readonly id: string;
  readonly url: string;
  readonly domHash: string;
  readonly modalIndicators: readonly string[];
  readonly timestamp: number;
}

interface StateTransition {
  readonly action: string;
  readonly preState: PageState;
  readonly postState: PageState;
  readonly domDiff: DomDiff | null;
}

interface StateTransitionGraph {
  readonly states: readonly PageState[];
  readonly transitions: readonly StateTransition[];
}
```

### DOM Diff

```typescript
interface DomDiff {
  readonly added: readonly DomNode[];
  readonly removed: readonly DomNode[];
  readonly modified: readonly ElementModification[];
}

interface ElementModification {
  readonly before: DomNode;
  readonly after: DomNode;
  readonly changes: readonly AttributeChange[];
}

interface AttributeChange {
  readonly type: 'attribute' | 'text' | 'class';
  readonly name: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}
```

## Design Decisions

1. **Types stay in `@sentinel/analysis`** — no other package needs them yet. Move to shared when a second consumer appears.
2. **StateTracker is the only stateful class** — everything else is pure functions.
3. **DOM hash uses visible content** — per issue #38, state identity is URL + visible DOM hash + modal indicators.
4. **20% content change threshold** triggers new state — measured by comparing DOM hashes of visible content.
5. **Accessibility name takes priority** over visible text for selector generation — per issue #39.
6. **No dependency on Playwright types** — analysis package depends on `@sentinel/browser` for the `BrowserEngine` interface only.

## Workstream Breakdown

| Workstream | Stories | Dependencies |
|------------|---------|--------------|
| WS1: DOM Foundation | #36 (parser) + #37 (classifier) | Package scaffold, types |
| WS2: Accessibility + Forms | #39 (a11y) + #40 (forms) | WS1 types (DomNode) |
| WS3: State + Diff | #38 (state tracker) + #41 (diff) | WS1 types (DomNode) |

WS1 creates the package, types, and parser. WS2 and WS3 run in parallel after WS1 completes.
