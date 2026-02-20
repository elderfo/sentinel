# Element Stability Analysis & Visual Element Recognition Design

## Context

Epic #4 (Application Understanding & DOM Mapping System) has six completed stories (4.1-4.6) covering DOM parsing, element classification, state tracking, accessibility analysis, form detection, and DOM diffing. Two stories remain:

- **Story 4.7 (#117)**: Element stability analysis — score selector resilience for generated tests
- **Story 4.8 (#118)**: Visual element recognition — detect UI controls not well-represented in the DOM

Both live in `@sentinel/analysis` and follow the existing pattern of pure functions + browser adapter layers.

## Story 4.7 — Element Stability Analysis

### Purpose

Evaluate how reliable each interactive element's selectors are so Sentinel can choose the most resilient locator strategy for generated tests, reducing flakiness from minor UI changes.

### Module: `packages/analysis/src/stability/`

**`stability-analyzer.ts`** — Pure function `analyzeStability(elements: InteractiveElement[]): StabilizedElement[]`

- For each element, scores available selectors: `id`, `cssSelector`, `xpath`, ARIA attributes
- Detects dynamically generated IDs via pattern matching (framework prefixes, UUIDs, numeric suffixes)
- Scoring: stable ID = 100, ARIA role+name = 80, stable class-based CSS = 60, xpath = 30, dynamic ID = 20
- Produces a ranked `SelectorCandidate[]` per element with a recommended strategy

**`dynamic-id-detector.ts`** — Pure function `isDynamicId(id: string): boolean`

- Matches framework-generated patterns: `:r[0-9]+:`, `react-`, `ember`, `ng-c`, UUID-like, purely numeric, hash strings

### New Types

```typescript
type SelectorStrategy = 'id' | 'css' | 'xpath' | 'aria';

interface SelectorCandidate {
  readonly strategy: SelectorStrategy;
  readonly value: string;
  readonly score: number; // 0-100
}

interface StabilityAnalysis {
  readonly selectors: readonly SelectorCandidate[];
  readonly recommendedSelector: SelectorCandidate;
}

interface StabilizedElement extends InteractiveElement {
  readonly stability: StabilityAnalysis;
}
```

## Story 4.8 — Visual Element Recognition

### Purpose

Identify UI controls that may not be well-represented in the DOM (canvas-based controls, custom-rendered widgets, heavily styled pseudo-elements) via structural DOM detection, plus define a pluggable interface for future CV/AI-based screenshot analysis.

### Module: `packages/analysis/src/visual/`

**`visual-detector.ts`** — Pure function `detectVisualElements(root: DomNode, interactiveElements: InteractiveElement[]): VisualDetectionResult`

- Walks the DOM for canvas elements, SVG containers, elements with background-image styles, image-map areas
- Cross-references found visual regions against the interactive element list
- Flags regions found visually but missing from interactive elements as `unmatched`

**`visual-recognizer.ts`** — Interface + no-op implementation

- `VisualRecognizer` interface: `recognize(screenshot: Buffer): Promise<VisualRegion[]>`
- `NoOpVisualRecognizer` class returning an empty array
- Ready for future AI/CV provider plug-in

**`extract.ts`** — Browser adapter

- `extractVisualElements(engine, page, interactiveElements, recognizer?)` — captures screenshot via BrowserEngine, runs DOM-based structural detection, optionally calls the recognizer, merges results

### New Types

```typescript
interface VisualRegion {
  readonly boundingBox: BoundingBox;
  readonly confidence: number; // 0-1
  readonly label: string; // e.g., 'icon-button', 'canvas-control'
  readonly source: 'dom-structural' | 'visual-recognition';
}

interface VisualDetectionResult {
  readonly visualRegions: readonly VisualRegion[];
  readonly unmatchedRegions: readonly VisualRegion[];
  readonly canvasElements: readonly DomNode[];
}
```

## Parallelism

Stories 4.7 and 4.8 are independent: 4.7 operates on `InteractiveElement[]` from the classifier, 4.8 operates on the `DomNode` tree and screenshots. They can be developed in separate worktrees and merged independently.

## Exports

Both modules will be barrel-exported through `packages/analysis/src/index.ts` following the existing pattern. New types will be added to `packages/analysis/src/types.ts`.
