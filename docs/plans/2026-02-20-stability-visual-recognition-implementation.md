# Element Stability & Visual Recognition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement element stability analysis (Story 4.7, #117) and visual element recognition (Story 4.8, #118) to complete Epic #4.

**Architecture:** Two independent modules in `@sentinel/analysis` — `stability/` scores selector resilience for generated tests, `visual/` detects DOM-invisible UI controls via structural analysis plus a pluggable recognizer interface. Both follow the existing pattern of pure functions + browser adapter + barrel exports.

**Tech Stack:** TypeScript strict, Vitest, pnpm monorepo, `@sentinel/analysis` package depending on `@sentinel/shared` and `@sentinel/browser`.

**Parallelism:** Tasks 1-6 (Story 4.7) and Tasks 7-12 (Story 4.8) are independent and can be developed in separate worktrees.

---

## Story 4.7: Element Stability Analysis (#117)

### Task 1: Add stability types to types.ts

**Files:**

- Modify: `packages/analysis/src/types.ts`
- Modify: `packages/analysis/src/__tests__/types.test.ts`

**Step 1: Write the structural type test**

Add to the end of `packages/analysis/src/__tests__/types.test.ts`:

```typescript
it('SelectorCandidate captures strategy with score', () => {
  const candidate: SelectorCandidate = {
    strategy: 'id',
    value: '#submit-btn',
    score: 100,
  };
  expect(candidate.strategy).toBe('id');
  expect(candidate.score).toBe(100);
});

it('StabilityAnalysis provides ranked selectors with recommendation', () => {
  const analysis: StabilityAnalysis = {
    selectors: [
      { strategy: 'id', value: '#submit', score: 100 },
      { strategy: 'aria', value: '[role="button"][aria-label="Submit"]', score: 80 },
    ],
    recommendedSelector: { strategy: 'id', value: '#submit', score: 100 },
  };
  expect(analysis.selectors).toHaveLength(2);
  expect(analysis.recommendedSelector.strategy).toBe('id');
});

it('StabilizedElement extends InteractiveElement with stability', () => {
  const element: StabilizedElement = {
    node: {
      tag: 'button',
      id: 'submit',
      classes: ['btn'],
      attributes: {},
      textContent: 'Submit',
      children: [],
      boundingBox: { x: 0, y: 0, width: 80, height: 30 },
      isVisible: true,
      xpath: '/html/body/button',
      cssSelector: 'button#submit',
    },
    category: 'button',
    isDisabled: false,
    accessibilityInfo: null,
    stability: {
      selectors: [{ strategy: 'id', value: '#submit', score: 100 }],
      recommendedSelector: { strategy: 'id', value: '#submit', score: 100 },
    },
  };
  expect(element.stability.recommendedSelector.strategy).toBe('id');
});

it('SelectorStrategy covers all expected values', () => {
  const strategies: SelectorStrategy[] = ['id', 'css', 'xpath', 'aria'];
  expect(strategies).toHaveLength(4);
});
```

Update the import at the top of `types.test.ts` to include:

```typescript
import type {
  // ...existing imports...
  SelectorStrategy,
  SelectorCandidate,
  StabilityAnalysis,
  StabilizedElement,
} from '../types.js';
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/types.test.ts`
Expected: FAIL — types not exported yet

**Step 3: Add the types**

Append to `packages/analysis/src/types.ts` before the end of file:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(analysis): add stability analysis types (#117)
```

---

### Task 2: Implement dynamic ID detector

**Files:**

- Create: `packages/analysis/src/stability/dynamic-id-detector.ts`
- Create: `packages/analysis/src/__tests__/dynamic-id-detector.test.ts`

**Step 1: Write the failing test**

Create `packages/analysis/src/__tests__/dynamic-id-detector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isDynamicId } from '../stability/dynamic-id-detector.js';

describe('isDynamicId', () => {
  it('returns false for stable semantic IDs', () => {
    expect(isDynamicId('submit-btn')).toBe(false);
    expect(isDynamicId('main-nav')).toBe(false);
    expect(isDynamicId('login-form')).toBe(false);
    expect(isDynamicId('header')).toBe(false);
  });

  it('detects React-generated IDs (colon format)', () => {
    expect(isDynamicId(':r0:')).toBe(true);
    expect(isDynamicId(':r1a:')).toBe(true);
    expect(isDynamicId(':R1:')).toBe(true);
  });

  it('detects framework-prefixed IDs', () => {
    expect(isDynamicId('react-select-123')).toBe(true);
    expect(isDynamicId('ember456')).toBe(true);
    expect(isDynamicId('ng-c123456')).toBe(true);
    expect(isDynamicId('vue-component-1')).toBe(true);
  });

  it('detects UUID-like IDs', () => {
    expect(isDynamicId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('detects purely numeric IDs', () => {
    expect(isDynamicId('123')).toBe(true);
    expect(isDynamicId('0')).toBe(true);
  });

  it('detects hex-hash-like IDs', () => {
    expect(isDynamicId('css-1a2b3c')).toBe(true);
    expect(isDynamicId('sc-1x2y3z')).toBe(true);
  });

  it('detects IDs ending with long numeric suffixes', () => {
    expect(isDynamicId('component-839271649')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isDynamicId('')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/dynamic-id-detector.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `packages/analysis/src/stability/dynamic-id-detector.ts`:

```typescript
const DYNAMIC_PATTERNS: readonly RegExp[] = [
  // React 18+ generated IDs: :r0:, :R1a:, etc.
  /^:[rR][0-9a-zA-Z]*:$/,
  // Framework prefixes followed by digits/hashes
  /^react[-_]/i,
  /^ember\d/i,
  /^ng-c\d/i,
  /^vue[-_]/i,
  // UUID format
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  // Purely numeric
  /^\d+$/,
  // CSS-in-JS prefixes (styled-components, emotion)
  /^(?:css|sc)-[0-9a-z]+$/i,
  // IDs ending in long numeric suffix (6+ digits)
  /^.+-\d{6,}$/,
];

/** Detect whether an element ID appears to be dynamically generated by a framework. */
export function isDynamicId(id: string): boolean {
  if (id.length === 0) return false;
  return DYNAMIC_PATTERNS.some((pattern) => pattern.test(id));
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/dynamic-id-detector.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(analysis): add dynamic ID detector (#117)
```

---

### Task 3: Implement stability analyzer

**Files:**

- Create: `packages/analysis/src/stability/stability-analyzer.ts`
- Create: `packages/analysis/src/__tests__/stability-analyzer.test.ts`

**Step 1: Write the failing test**

Create `packages/analysis/src/__tests__/stability-analyzer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeStability } from '../stability/stability-analyzer.js';
import type { InteractiveElement, DomNode } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    isVisible: true,
    xpath: '/html/body/button',
    cssSelector: 'button',
    ...overrides,
  };
}

function makeElement(nodeOverrides: Partial<DomNode> & { tag: string }): InteractiveElement {
  return {
    node: makeNode(nodeOverrides),
    category: 'button',
    isDisabled: false,
    accessibilityInfo: null,
  };
}

describe('analyzeStability', () => {
  it('recommends id strategy for elements with stable IDs', () => {
    const elements = [makeElement({ tag: 'button', id: 'submit-btn' })];

    const result = analyzeStability(elements);

    expect(result).toHaveLength(1);
    expect(result[0]!.stability.recommendedSelector.strategy).toBe('id');
    expect(result[0]!.stability.recommendedSelector.value).toBe('#submit-btn');
    expect(result[0]!.stability.recommendedSelector.score).toBe(100);
  });

  it('deprioritizes dynamically generated IDs', () => {
    const elements = [makeElement({ tag: 'button', id: ':r0:' })];

    const result = analyzeStability(elements);

    expect(result[0]!.stability.recommendedSelector.strategy).not.toBe('id');
  });

  it('recommends aria strategy when element has role and aria-label', () => {
    const elements = [
      makeElement({
        tag: 'div',
        attributes: { role: 'button', 'aria-label': 'Submit form' },
      }),
    ];

    const result = analyzeStability(elements);

    expect(result[0]!.stability.recommendedSelector.strategy).toBe('aria');
    expect(result[0]!.stability.recommendedSelector.score).toBe(80);
  });

  it('falls back to css for elements with stable classes', () => {
    const elements = [
      makeElement({
        tag: 'button',
        classes: ['btn-primary'],
        cssSelector: 'button.btn-primary',
      }),
    ];

    const result = analyzeStability(elements);

    expect(result[0]!.stability.recommendedSelector.strategy).toBe('css');
  });

  it('falls back to xpath as last resort', () => {
    const elements = [
      makeElement({
        tag: 'div',
        xpath: '/html/body/div[3]/div[1]/div',
        cssSelector: 'div',
      }),
    ];

    const result = analyzeStability(elements);

    expect(result[0]!.stability.recommendedSelector.strategy).toBe('xpath');
    expect(result[0]!.stability.recommendedSelector.score).toBe(30);
  });

  it('includes all available selectors ranked by score', () => {
    const elements = [
      makeElement({
        tag: 'button',
        id: 'save',
        attributes: { role: 'button', 'aria-label': 'Save' },
        classes: ['btn'],
        cssSelector: 'button#save',
        xpath: '/html/body/button',
      }),
    ];

    const result = analyzeStability(elements);
    const selectors = result[0]!.stability.selectors;

    expect(selectors.length).toBeGreaterThanOrEqual(3);
    // Selectors are sorted descending by score
    for (let i = 1; i < selectors.length; i++) {
      expect(selectors[i - 1]!.score).toBeGreaterThanOrEqual(selectors[i]!.score);
    }
  });

  it('preserves all InteractiveElement fields', () => {
    const elements = [
      {
        ...makeElement({ tag: 'button', id: 'test' }),
        accessibilityInfo: {
          name: 'Test',
          role: 'button',
          description: '',
          states: {},
        },
      },
    ];

    const result = analyzeStability(elements);

    expect(result[0]!.category).toBe('button');
    expect(result[0]!.accessibilityInfo?.name).toBe('Test');
    expect(result[0]!.stability).toBeDefined();
  });

  it('handles empty element list', () => {
    const result = analyzeStability([]);
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/stability-analyzer.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `packages/analysis/src/stability/stability-analyzer.ts`:

```typescript
import type {
  InteractiveElement,
  StabilizedElement,
  SelectorCandidate,
  StabilityAnalysis,
} from '../types.js';
import { isDynamicId } from './dynamic-id-detector.js';

const STABLE_ID_SCORE = 100;
const DYNAMIC_ID_SCORE = 20;
const ARIA_SCORE = 80;
const CSS_SCORE = 60;
const XPATH_SCORE = 30;

function buildIdCandidate(id: string): SelectorCandidate {
  const score = isDynamicId(id) ? DYNAMIC_ID_SCORE : STABLE_ID_SCORE;
  return { strategy: 'id', value: `#${id}`, score };
}

function buildAriaCandidate(
  attributes: Readonly<Record<string, string>>,
): SelectorCandidate | null {
  const role = attributes['role'];
  const label = attributes['aria-label'];
  if (!role && !label) return null;

  const parts: string[] = [];
  if (role) parts.push(`[role="${role}"]`);
  if (label) parts.push(`[aria-label="${label}"]`);
  return { strategy: 'aria', value: parts.join(''), score: ARIA_SCORE };
}

function buildCssCandidate(cssSelector: string, classes: readonly string[]): SelectorCandidate {
  // Selectors with meaningful class names score higher
  const hasClasses = classes.length > 0;
  return { strategy: 'css', value: cssSelector, score: hasClasses ? CSS_SCORE : XPATH_SCORE };
}

function buildXpathCandidate(xpath: string): SelectorCandidate {
  return { strategy: 'xpath', value: xpath, score: XPATH_SCORE };
}

function buildStabilityAnalysis(element: InteractiveElement): StabilityAnalysis {
  const candidates: SelectorCandidate[] = [];
  const { node } = element;

  if (node.id) {
    candidates.push(buildIdCandidate(node.id));
  }

  const ariaCandidate = buildAriaCandidate(node.attributes);
  if (ariaCandidate) {
    candidates.push(ariaCandidate);
  }

  candidates.push(buildCssCandidate(node.cssSelector, node.classes));
  candidates.push(buildXpathCandidate(node.xpath));

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  return {
    selectors: candidates,
    recommendedSelector: candidates[0]!,
  };
}

/** Analyze selector stability for each interactive element and produce a recommended locator strategy. */
export function analyzeStability(
  elements: readonly InteractiveElement[],
): readonly StabilizedElement[] {
  return elements.map((element) => ({
    ...element,
    stability: buildStabilityAnalysis(element),
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/stability-analyzer.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(analysis): add stability analyzer (#117)
```

---

### Task 4: Add stability barrel export

**Files:**

- Create: `packages/analysis/src/stability/index.ts`

**Step 1: Create the barrel file**

Create `packages/analysis/src/stability/index.ts`:

```typescript
export { isDynamicId } from './dynamic-id-detector.js';
export { analyzeStability } from './stability-analyzer.js';
```

**Step 2: Commit**

```
feat(analysis): add stability module barrel export (#117)
```

---

### Task 5: Wire stability into package public API

**Files:**

- Modify: `packages/analysis/src/index.ts`

**Step 1: Add exports**

Add to the type export block in `packages/analysis/src/index.ts`:

```typescript
// In the export type { ... } block, add:
  SelectorStrategy,
  SelectorCandidate,
  StabilityAnalysis,
  StabilizedElement,
```

Add the function export:

```typescript
export { analyzeStability, isDynamicId } from './stability/index.js';
```

**Step 2: Run all analysis tests to verify nothing broke**

Run: `pnpm exec vitest run --project @sentinel/analysis`
Expected: ALL PASS

**Step 3: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```
feat(analysis): export stability module from package API (#117)
```

---

### Task 6: Update CLAUDE.md directory structure

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add stability section to the analysis package directory tree**

Under `packages/analysis/src/`, add:

```
│   │       ├── stability/
│   │       │   ├── dynamic-id-detector.ts  # isDynamicId() — pattern matching for framework-generated IDs
│   │       │   ├── stability-analyzer.ts   # analyzeStability() — scores selectors, recommends best locator strategy
│   │       │   └── index.ts               # Barrel re-export for stability/
```

Add test entries:

```
│   │           ├── dynamic-id-detector.test.ts    # Dynamic ID detector unit tests
│   │           ├── stability-analyzer.test.ts     # Stability analyzer unit tests
```

**Step 2: Commit**

```
docs: update CLAUDE.md with stability module structure (#117)
```

---

## Story 4.8: Visual Element Recognition (#118)

### Task 7: Add visual recognition types to types.ts

**Files:**

- Modify: `packages/analysis/src/types.ts`
- Modify: `packages/analysis/src/__tests__/types.test.ts`

**Step 1: Write the structural type test**

Add to the end of `packages/analysis/src/__tests__/types.test.ts`:

```typescript
it('VisualRegion captures detected visual area', () => {
  const region: VisualRegion = {
    boundingBox: { x: 10, y: 20, width: 200, height: 100 },
    confidence: 0.95,
    label: 'canvas-control',
    source: 'dom-structural',
  };
  expect(region.source).toBe('dom-structural');
  expect(region.confidence).toBe(0.95);
});

it('VisualDetectionResult captures all detection outputs', () => {
  const result: VisualDetectionResult = {
    visualRegions: [
      {
        boundingBox: { x: 0, y: 0, width: 300, height: 150 },
        confidence: 1.0,
        label: 'canvas-control',
        source: 'dom-structural',
      },
    ],
    unmatchedRegions: [],
    canvasElements: [],
  };
  expect(result.visualRegions).toHaveLength(1);
});

it('VisualRegionSource covers all expected values', () => {
  const sources: VisualRegionSource[] = ['dom-structural', 'visual-recognition'];
  expect(sources).toHaveLength(2);
});
```

Update the import to include:

```typescript
import type {
  // ...existing imports...
  VisualRegion,
  VisualRegionSource,
  VisualDetectionResult,
} from '../types.js';
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/types.test.ts`
Expected: FAIL — types not exported

**Step 3: Add the types**

Append to `packages/analysis/src/types.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(analysis): add visual recognition types (#118)
```

---

### Task 8: Implement VisualRecognizer interface and NoOp

**Files:**

- Create: `packages/analysis/src/visual/visual-recognizer.ts`
- Create: `packages/analysis/src/__tests__/visual-recognizer.test.ts`

**Step 1: Write the failing test**

Create `packages/analysis/src/__tests__/visual-recognizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { NoOpVisualRecognizer } from '../visual/visual-recognizer.js';
import type { VisualRecognizer } from '../visual/visual-recognizer.js';

describe('NoOpVisualRecognizer', () => {
  it('implements VisualRecognizer interface', () => {
    const recognizer: VisualRecognizer = new NoOpVisualRecognizer();
    expect(recognizer).toBeDefined();
  });

  it('returns an empty array for any screenshot', async () => {
    const recognizer = new NoOpVisualRecognizer();
    const screenshot = Buffer.from('fake-png-data');

    const result = await recognizer.recognize(screenshot);

    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/visual-recognizer.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `packages/analysis/src/visual/visual-recognizer.ts`:

```typescript
import type { VisualRegion } from '../types.js';

/** Interface for screenshot-based visual element recognition. */
export interface VisualRecognizer {
  recognize(screenshot: Buffer): Promise<readonly VisualRegion[]>;
}

/** No-op implementation that returns no visual regions. Placeholder for future AI/CV integration. */
export class NoOpVisualRecognizer implements VisualRecognizer {
  async recognize(_screenshot: Buffer): Promise<readonly VisualRegion[]> {
    return [];
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/visual-recognizer.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(analysis): add VisualRecognizer interface with NoOp implementation (#118)
```

---

### Task 9: Implement visual detector (DOM structural detection)

**Files:**

- Create: `packages/analysis/src/visual/visual-detector.ts`
- Create: `packages/analysis/src/__tests__/visual-detector.test.ts`

**Step 1: Write the failing test**

Create `packages/analysis/src/__tests__/visual-detector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectVisualElements } from '../visual/visual-detector.js';
import type { DomNode, InteractiveElement } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    isVisible: true,
    xpath: '/test',
    cssSelector: 'test',
    ...overrides,
  };
}

function makeInteractive(node: DomNode): InteractiveElement {
  return { node, category: 'button', isDisabled: false, accessibilityInfo: null };
}

describe('detectVisualElements', () => {
  it('detects canvas elements', () => {
    const root = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'canvas', boundingBox: { x: 0, y: 0, width: 400, height: 300 } })],
    });

    const result = detectVisualElements(root, []);

    expect(result.canvasElements).toHaveLength(1);
    expect(result.canvasElements[0]!.tag).toBe('canvas');
    expect(result.visualRegions.length).toBeGreaterThanOrEqual(1);
    expect(result.visualRegions[0]!.label).toBe('canvas-control');
    expect(result.visualRegions[0]!.source).toBe('dom-structural');
  });

  it('detects SVG containers as visual regions', () => {
    const root = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'svg',
          boundingBox: { x: 10, y: 10, width: 24, height: 24 },
          attributes: { role: 'img' },
        }),
      ],
    });

    const result = detectVisualElements(root, []);

    expect(result.visualRegions.some((r) => r.label === 'svg-graphic')).toBe(true);
  });

  it('detects elements with background-image as visual regions', () => {
    const root = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'div',
          attributes: { style: 'background-image: url(hero.jpg)' },
          boundingBox: { x: 0, y: 0, width: 800, height: 400 },
        }),
      ],
    });

    const result = detectVisualElements(root, []);

    expect(result.visualRegions.some((r) => r.label === 'image-background')).toBe(true);
  });

  it('detects image map areas', () => {
    const root = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'area',
          attributes: { href: '/link', shape: 'rect', coords: '0,0,100,100' },
          boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        }),
      ],
    });

    const result = detectVisualElements(root, []);

    expect(result.visualRegions.some((r) => r.label === 'image-map-area')).toBe(true);
  });

  it('marks visual regions as unmatched when not in interactive elements list', () => {
    const canvas = makeNode({
      tag: 'canvas',
      boundingBox: { x: 0, y: 0, width: 400, height: 300 },
    });
    const root = makeNode({ tag: 'div', children: [canvas] });

    const result = detectVisualElements(root, []);

    expect(result.unmatchedRegions).toHaveLength(result.visualRegions.length);
  });

  it('does not mark visual regions as unmatched when they overlap with interactive elements', () => {
    const canvas = makeNode({
      tag: 'canvas',
      boundingBox: { x: 0, y: 0, width: 400, height: 300 },
    });
    const root = makeNode({ tag: 'div', children: [canvas] });
    const interactives = [makeInteractive(canvas)];

    const result = detectVisualElements(root, interactives);

    expect(result.unmatchedRegions).toHaveLength(0);
  });

  it('skips invisible elements', () => {
    const root = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'canvas', isVisible: false })],
    });

    const result = detectVisualElements(root, []);

    expect(result.canvasElements).toHaveLength(0);
    expect(result.visualRegions).toHaveLength(0);
  });

  it('returns empty results for a tree with no visual elements', () => {
    const root = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'p', textContent: 'Hello' })],
    });

    const result = detectVisualElements(root, []);

    expect(result.visualRegions).toHaveLength(0);
    expect(result.unmatchedRegions).toHaveLength(0);
    expect(result.canvasElements).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/visual-detector.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `packages/analysis/src/visual/visual-detector.ts`:

```typescript
import type {
  DomNode,
  InteractiveElement,
  VisualRegion,
  VisualDetectionResult,
  BoundingBox,
} from '../types.js';

function hasBackgroundImage(attributes: Readonly<Record<string, string>>): boolean {
  const style = attributes['style'];
  if (!style) return false;
  return /background-image\s*:/i.test(style);
}

function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function collectVisualNodes(
  node: DomNode,
  regions: VisualRegion[],
  canvasElements: DomNode[],
): void {
  if (!node.isVisible || !node.boundingBox) {
    return;
  }

  const tag = node.tag.toLowerCase();

  if (tag === 'canvas') {
    canvasElements.push(node);
    regions.push({
      boundingBox: node.boundingBox,
      confidence: 1.0,
      label: 'canvas-control',
      source: 'dom-structural',
    });
  } else if (tag === 'svg') {
    regions.push({
      boundingBox: node.boundingBox,
      confidence: 0.9,
      label: 'svg-graphic',
      source: 'dom-structural',
    });
  } else if (tag === 'area') {
    regions.push({
      boundingBox: node.boundingBox,
      confidence: 0.85,
      label: 'image-map-area',
      source: 'dom-structural',
    });
  } else if (hasBackgroundImage(node.attributes)) {
    regions.push({
      boundingBox: node.boundingBox,
      confidence: 0.7,
      label: 'image-background',
      source: 'dom-structural',
    });
  }

  for (const child of node.children) {
    collectVisualNodes(child, regions, canvasElements);
  }
}

/** Detect visually significant elements in the DOM that may not be well-represented as interactive elements. */
export function detectVisualElements(
  root: DomNode,
  interactiveElements: readonly InteractiveElement[],
): VisualDetectionResult {
  const visualRegions: VisualRegion[] = [];
  const canvasElements: DomNode[] = [];

  collectVisualNodes(root, visualRegions, canvasElements);

  const unmatchedRegions = visualRegions.filter((region) => {
    return !interactiveElements.some((el) => {
      if (!el.node.boundingBox) return false;
      return boundingBoxesOverlap(region.boundingBox, el.node.boundingBox);
    });
  });

  return { visualRegions, unmatchedRegions, canvasElements };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/visual-detector.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(analysis): add visual element detector (#118)
```

---

### Task 10: Implement visual extract adapter

**Files:**

- Create: `packages/analysis/src/visual/extract.ts`
- Modify: `packages/analysis/src/__tests__/extract.test.ts`

**Step 1: Write the failing test**

Add to `packages/analysis/src/__tests__/extract.test.ts`:

```typescript
import { extractVisualElements } from '../index.js';
import { NoOpVisualRecognizer } from '../visual/visual-recognizer.js';

// ... (add import for VisualDetectionResult type)

describe('extractVisualElements', () => {
  it('extracts DOM, detects visual elements, and calls recognizer', async () => {
    const rawDom: RawDomData = {
      tag: 'div',
      id: 'root',
      classes: [],
      attributes: {},
      textContent: '',
      children: [
        {
          tag: 'canvas',
          id: 'game',
          classes: [],
          attributes: {},
          textContent: '',
          children: [],
          boundingBox: { x: 0, y: 0, width: 400, height: 300 },
          isVisible: true,
        },
      ],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const screenshot = Buffer.from('fake-screenshot');
    const evaluateFn = vi.fn().mockResolvedValue(rawDom);
    const screenshotFn = vi.fn().mockResolvedValue(screenshot);
    const engine = {
      evaluate: evaluateFn,
      screenshot: screenshotFn,
    } as unknown as BrowserEngine;

    const result = await extractVisualElements(engine, mockPage, [], new NoOpVisualRecognizer());

    expect(result.canvasElements).toHaveLength(1);
    expect(result.visualRegions.length).toBeGreaterThanOrEqual(1);
    expect(screenshotFn).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/extract.test.ts`
Expected: FAIL — extractVisualElements not exported

**Step 3: Write the implementation**

Create `packages/analysis/src/visual/extract.ts`:

```typescript
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { InteractiveElement, VisualDetectionResult } from '../types.js';
import { extractDom } from '../parser/index.js';
import { detectVisualElements } from './visual-detector.js';
import type { VisualRecognizer } from './visual-recognizer.js';
import { NoOpVisualRecognizer } from './visual-recognizer.js';

/** Extract visual elements from a browser page using DOM analysis and optional screenshot recognition. */
export async function extractVisualElements(
  engine: BrowserEngine,
  page: PageHandle,
  interactiveElements: readonly InteractiveElement[],
  recognizer: VisualRecognizer = new NoOpVisualRecognizer(),
): Promise<VisualDetectionResult> {
  const [domRoot, screenshot] = await Promise.all([
    extractDom(engine, page),
    engine.screenshot(page, { fullPage: true }),
  ]);

  const domResult = detectVisualElements(domRoot, interactiveElements);
  const recognizedRegions = await recognizer.recognize(screenshot);

  return {
    visualRegions: [...domResult.visualRegions, ...recognizedRegions],
    unmatchedRegions: [...domResult.unmatchedRegions, ...recognizedRegions],
    canvasElements: domResult.canvasElements,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/analysis/src/__tests__/extract.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(analysis): add visual element extract adapter (#118)
```

---

### Task 11: Add visual barrel export and wire into package API

**Files:**

- Create: `packages/analysis/src/visual/index.ts`
- Modify: `packages/analysis/src/index.ts`

**Step 1: Create barrel file**

Create `packages/analysis/src/visual/index.ts`:

```typescript
export { detectVisualElements } from './visual-detector.js';
export { type VisualRecognizer, NoOpVisualRecognizer } from './visual-recognizer.js';
export { extractVisualElements } from './extract.js';
```

**Step 2: Update package index.ts**

Add to the type export block:

```typescript
  VisualRegion,
  VisualRegionSource,
  VisualDetectionResult,
```

Add function exports:

```typescript
export {
  detectVisualElements,
  type VisualRecognizer,
  NoOpVisualRecognizer,
  extractVisualElements,
} from './visual/index.js';
```

**Step 3: Run all analysis tests**

Run: `pnpm exec vitest run --project @sentinel/analysis`
Expected: ALL PASS

**Step 4: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```
feat(analysis): export visual recognition module from package API (#118)
```

---

### Task 12: Update CLAUDE.md directory structure for visual module

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add visual section to the analysis package directory tree**

Under `packages/analysis/src/`, add:

```
│   │       ├── visual/
│   │       │   ├── visual-detector.ts     # detectVisualElements() — pure: DOM → VisualDetectionResult
│   │       │   ├── visual-recognizer.ts   # VisualRecognizer interface + NoOpVisualRecognizer
│   │       │   ├── extract.ts             # extractVisualElements() — BrowserEngine adapter
│   │       │   └── index.ts               # Barrel re-export for visual/
```

Add test entries:

```
│   │           ├── visual-detector.test.ts        # Visual detector unit tests
│   │           ├── visual-recognizer.test.ts      # Visual recognizer unit tests
```

**Step 2: Commit**

```
docs: update CLAUDE.md with visual recognition module structure (#118)
```

---

## Final Verification

### Task 13: Run full test suite and close issues

**Step 1: Run full workspace tests**

Run: `pnpm test`
Expected: ALL PASS across all packages

**Step 2: Run full typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors
