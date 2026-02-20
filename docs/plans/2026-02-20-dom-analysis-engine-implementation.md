# DOM Analysis Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `@sentinel/analysis` package implementing DOM parsing, element classification, accessibility analysis, form detection, DOM diffing, and state tracking for Epic #4.

**Architecture:** New `@sentinel/analysis` package with layered API: pure functions accept raw serialized data (testable with JSON fixtures), thin adapter layer bridges `BrowserEngine` for convenience. Types are local to the package.

**Tech Stack:** TypeScript (strict), Vitest 4, pnpm workspace, `@sentinel/browser` BrowserEngine interface

---

### Task 1: Scaffold @sentinel/analysis Package

**Files:**
- Create: `packages/analysis/package.json`
- Create: `packages/analysis/tsconfig.json`
- Create: `packages/analysis/vitest.config.ts`
- Create: `packages/analysis/src/index.ts`
- Modify: `tsconfig.build.json`
- Modify: `tsconfig.json` (add path alias)
- Modify: `vitest.config.ts` (add project)
- Modify: `pnpm-workspace.yaml` (already uses `packages/*` glob — no change needed)

**Step 1: Create package.json**

```json
{
  "name": "@sentinel/analysis",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc --build",
    "clean": "tsc --build --clean",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@sentinel/shared": "workspace:*",
    "@sentinel/browser": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }, { "path": "../browser" }]
}
```

**Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: '@sentinel/analysis',
    environment: 'node',
    reporters: ['default', ['junit', { outputFile: './test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/__tests__/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@sentinel/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@sentinel/browser': resolve(__dirname, '../browser/src/index.ts'),
      '@sentinel/analysis': resolve(__dirname, './src/index.ts'),
    },
  },
});
```

**Step 4: Create placeholder src/index.ts**

```typescript
/**
 * @sentinel/analysis
 *
 * DOM analysis engine for the Sentinel QA platform.
 * Provides DOM parsing, element classification, accessibility analysis,
 * form detection, DOM diffing, and application state tracking.
 */
```

**Step 5: Add analysis to tsconfig.build.json**

Add `{ "path": "./packages/analysis" }` after the browser entry in the references array.

**Step 6: Add path alias to root tsconfig.json**

Add `"@sentinel/analysis": ["./packages/analysis/src/index.ts"]` to the paths object.

**Step 7: Add project to root vitest.config.ts**

Add `@sentinel/analysis` alias to resolve.alias and add a new project entry:

```typescript
// In resolve.alias:
'@sentinel/analysis': resolve(root, 'packages/analysis/src/index.ts'),

// In test.projects:
{
  extends: true,
  test: {
    name: '@sentinel/analysis',
    include: ['packages/analysis/src/**/*.test.ts'],
  },
},
```

**Step 8: Install dependencies**

Run: `pnpm install`

**Step 9: Verify setup**

Run: `pnpm typecheck`
Expected: No errors (empty index.ts)

**Step 10: Commit**

```
feat(analysis): scaffold @sentinel/analysis package (#4)
```

---

### Task 2: Define Core Types

**Files:**
- Create: `packages/analysis/src/types.ts`
- Modify: `packages/analysis/src/index.ts` (re-export types)
- Create: `packages/analysis/src/__tests__/types.test.ts`

**Step 1: Write the types test**

Test that types are importable and structurally correct:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  DomNode,
  BoundingBox,
  ElementCategory,
  InteractiveElement,
  AccessibilityInfo,
  AccessibilityIssue,
  FormModel,
  FormField,
  FieldConstraints,
  PageState,
  StateTransition,
  StateTransitionGraph,
  DomDiff,
  ElementModification,
  AttributeChange,
  RawDomData,
  RawAccessibilityNode,
} from '../types.js';

describe('analysis types', () => {
  it('DomNode is structurally valid', () => {
    const node: DomNode = {
      tag: 'div',
      id: 'root',
      classes: ['container'],
      attributes: { 'data-testid': 'root' },
      textContent: 'Hello',
      children: [],
      boundingBox: { x: 0, y: 0, width: 100, height: 50 },
      isVisible: true,
      xpath: '/html/body/div',
      cssSelector: 'div#root',
    };
    expect(node.tag).toBe('div');
  });

  it('InteractiveElement extends DomNode with category', () => {
    const element: InteractiveElement = {
      node: {
        tag: 'button',
        id: 'submit',
        classes: ['btn'],
        attributes: {},
        textContent: 'Submit',
        children: [],
        boundingBox: { x: 10, y: 20, width: 80, height: 30 },
        isVisible: true,
        xpath: '/html/body/button',
        cssSelector: 'button#submit',
      },
      category: 'button',
      isDisabled: false,
      accessibilityInfo: null,
    };
    expect(element.category).toBe('button');
  });

  it('ElementCategory covers all expected values', () => {
    const categories: ElementCategory[] = [
      'navigation-link',
      'button',
      'form-field',
      'dropdown',
      'checkbox',
      'radio',
      'date-picker',
      'file-upload',
    ];
    expect(categories).toHaveLength(8);
  });

  it('FormModel captures form structure with constraints', () => {
    const form: FormModel = {
      formElement: {
        tag: 'form',
        id: 'login',
        classes: [],
        attributes: {},
        textContent: '',
        children: [],
        boundingBox: null,
        isVisible: true,
        xpath: '/html/body/form',
        cssSelector: 'form#login',
      },
      action: '/api/login',
      method: 'POST',
      fields: [
        {
          node: {
            tag: 'input',
            id: 'email',
            classes: [],
            attributes: { type: 'email' },
            textContent: '',
            children: [],
            boundingBox: null,
            isVisible: true,
            xpath: '/html/body/form/input',
            cssSelector: 'input#email',
          },
          inputType: 'email',
          name: 'email',
          label: 'Email',
          placeholder: 'you@example.com',
          constraints: {
            required: true,
            pattern: null,
            min: null,
            max: null,
            minLength: null,
            maxLength: 255,
          },
        },
      ],
      isMultiStep: false,
    };
    expect(form.fields).toHaveLength(1);
  });

  it('PageState captures state identity', () => {
    const state: PageState = {
      id: 'state-1',
      url: 'https://example.com',
      domHash: 'abc123',
      modalIndicators: [],
      timestamp: Date.now(),
    };
    expect(state.url).toBe('https://example.com');
  });

  it('DomDiff captures added, removed, and modified elements', () => {
    const diff: DomDiff = {
      added: [],
      removed: [],
      modified: [
        {
          before: {
            tag: 'span',
            id: null,
            classes: [],
            attributes: {},
            textContent: 'old',
            children: [],
            boundingBox: null,
            isVisible: true,
            xpath: '/html/body/span',
            cssSelector: 'span',
          },
          after: {
            tag: 'span',
            id: null,
            classes: [],
            attributes: {},
            textContent: 'new',
            children: [],
            boundingBox: null,
            isVisible: true,
            xpath: '/html/body/span',
            cssSelector: 'span',
          },
          changes: [
            {
              type: 'text',
              name: 'textContent',
              oldValue: 'old',
              newValue: 'new',
            },
          ],
        },
      ],
    };
    expect(diff.modified).toHaveLength(1);
  });

  it('RawDomData represents serialized browser output', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [],
      boundingBox: null,
      isVisible: true,
    };
    expect(raw.tag).toBe('div');
  });

  it('RawAccessibilityNode represents browser a11y snapshot', () => {
    const raw: RawAccessibilityNode = {
      role: 'button',
      name: 'Submit',
      description: '',
      value: null,
      children: [],
    };
    expect(raw.role).toBe('button');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/analysis/src/__tests__/types.test.ts`
Expected: FAIL — types.ts doesn't exist yet

**Step 3: Write the types file**

Create `packages/analysis/src/types.ts` with all the types defined in the design doc:

```typescript
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
```

**Step 4: Update index.ts to re-export types**

```typescript
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
```

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/analysis/src/__tests__/types.test.ts`
Expected: PASS — all type structural tests pass

**Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 7: Commit**

```
feat(analysis): define core analysis types (#4)
```

---

### Task 3: DOM Parser — Pure Function (#36)

**Files:**
- Create: `packages/analysis/src/parser/dom-parser.ts`
- Create: `packages/analysis/src/parser/index.ts`
- Create: `packages/analysis/src/__tests__/dom-parser.test.ts`
- Modify: `packages/analysis/src/index.ts` (add export)

The DOM parser converts `RawDomData` (serialized from browser) into a `DomNode` tree with computed `xpath` and `cssSelector` paths.

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { parseDom } from '../parser/index.js';
import type { RawDomData, DomNode } from '../types.js';

describe('parseDom', () => {
  it('parses a single visible element', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: 'root',
      classes: ['container'],
      attributes: { 'data-testid': 'root' },
      textContent: 'Hello',
      children: [],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.tag).toBe('div');
    expect(result.id).toBe('root');
    expect(result.classes).toEqual(['container']);
    expect(result.textContent).toBe('Hello');
    expect(result.xpath).toBe('/div');
    expect(result.cssSelector).toBe('div#root');
    expect(result.children).toEqual([]);
  });

  it('preserves parent-child hierarchy', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [
        {
          tag: 'span',
          id: null,
          classes: ['text'],
          attributes: {},
          textContent: 'Child',
          children: [],
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
          isVisible: true,
        },
      ],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.children).toHaveLength(1);
    expect(result.children[0]?.tag).toBe('span');
    expect(result.children[0]?.xpath).toBe('/div/span');
    expect(result.children[0]?.cssSelector).toBe('div > span.text');
  });

  it('excludes invisible elements', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [
        {
          tag: 'span',
          id: null,
          classes: [],
          attributes: {},
          textContent: 'Visible',
          children: [],
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
          isVisible: true,
        },
        {
          tag: 'span',
          id: null,
          classes: [],
          attributes: {},
          textContent: 'Hidden',
          children: [],
          boundingBox: null,
          isVisible: false,
        },
      ],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.children).toHaveLength(1);
    expect(result.children[0]?.textContent).toBe('Visible');
  });

  it('generates unique xpaths with sibling indices', () => {
    const raw: RawDomData = {
      tag: 'ul',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [
        {
          tag: 'li',
          id: null,
          classes: [],
          attributes: {},
          textContent: 'First',
          children: [],
          boundingBox: { x: 0, y: 0, width: 100, height: 20 },
          isVisible: true,
        },
        {
          tag: 'li',
          id: null,
          classes: [],
          attributes: {},
          textContent: 'Second',
          children: [],
          boundingBox: { x: 0, y: 20, width: 100, height: 20 },
          isVisible: true,
        },
      ],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.children[0]?.xpath).toBe('/ul/li[1]');
    expect(result.children[1]?.xpath).toBe('/ul/li[2]');
  });

  it('uses id for CSS selector when available', () => {
    const raw: RawDomData = {
      tag: 'input',
      id: 'email',
      classes: ['form-control', 'required'],
      attributes: { type: 'email' },
      textContent: '',
      children: [],
      boundingBox: { x: 0, y: 0, width: 200, height: 30 },
      isVisible: true,
    };

    const result = parseDom(raw);

    expect(result.cssSelector).toBe('input#email');
  });

  it('produces deterministic output for identical input', () => {
    const raw: RawDomData = {
      tag: 'div',
      id: 'app',
      classes: [],
      attributes: {},
      textContent: 'Test',
      children: [],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };

    const result1 = parseDom(raw);
    const result2 = parseDom(raw);

    expect(result1).toEqual(result2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/analysis/src/__tests__/dom-parser.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the parser**

Create `packages/analysis/src/parser/dom-parser.ts`:

```typescript
import type { RawDomData, DomNode } from '../types.js';

function buildCssSelector(
  tag: string,
  id: string | null,
  classes: readonly string[],
  parentSelector: string,
): string {
  if (id) {
    return `${tag}#${id}`;
  }
  const classStr = classes.length > 0 ? `.${classes.join('.')}` : '';
  const self = `${tag}${classStr}`;
  return parentSelector ? `${parentSelector} > ${self}` : self;
}

function buildXpath(
  tag: string,
  siblingIndex: number | null,
  parentXpath: string,
): string {
  const indexSuffix = siblingIndex !== null ? `[${siblingIndex}]` : '';
  return `${parentXpath}/${tag}${indexSuffix}`;
}

function parseNode(
  raw: RawDomData,
  parentXpath: string,
  parentCssSelector: string,
  siblingIndex: number | null,
): DomNode {
  const xpath = buildXpath(raw.tag, siblingIndex, parentXpath);
  const cssSelector = buildCssSelector(
    raw.tag,
    raw.id,
    raw.classes,
    parentCssSelector,
  );

  const visibleChildren = raw.children.filter((child) => child.isVisible);

  // Count siblings per tag for xpath indexing
  const tagCounts = new Map<string, number>();
  const tagTotals = new Map<string, number>();
  for (const child of visibleChildren) {
    tagTotals.set(child.tag, (tagTotals.get(child.tag) ?? 0) + 1);
  }

  const children: DomNode[] = visibleChildren.map((child) => {
    const currentCount = (tagCounts.get(child.tag) ?? 0) + 1;
    tagCounts.set(child.tag, currentCount);
    const total = tagTotals.get(child.tag) ?? 1;
    const childSiblingIndex = total > 1 ? currentCount : null;
    return parseNode(child, xpath, cssSelector, childSiblingIndex);
  });

  return {
    tag: raw.tag,
    id: raw.id,
    classes: [...raw.classes],
    attributes: { ...raw.attributes },
    textContent: raw.textContent,
    children,
    boundingBox: raw.boundingBox
      ? { ...raw.boundingBox }
      : null,
    isVisible: raw.isVisible,
    xpath,
    cssSelector,
  };
}

/** Parse raw serialized DOM data into a structured DomNode tree. */
export function parseDom(raw: RawDomData): DomNode {
  return parseNode(raw, '', '', null);
}
```

Create `packages/analysis/src/parser/index.ts`:

```typescript
export { parseDom } from './dom-parser.js';
```

**Step 4: Update index.ts**

Add to `packages/analysis/src/index.ts`:

```typescript
export { parseDom } from './parser/index.js';
```

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/analysis/src/__tests__/dom-parser.test.ts`
Expected: PASS

**Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 7: Commit**

```
feat(analysis): add DOM parser with xpath/css selector generation (#36)
```

---

### Task 4: Element Classifier (#37)

**Files:**
- Create: `packages/analysis/src/classifier/rules.ts`
- Create: `packages/analysis/src/classifier/element-classifier.ts`
- Create: `packages/analysis/src/classifier/index.ts`
- Create: `packages/analysis/src/__tests__/element-classifier.test.ts`
- Modify: `packages/analysis/src/index.ts` (add export)

The classifier walks a `DomNode` tree and identifies interactive elements, categorizing them by type using tag name and ARIA role. Elements that are disabled or hidden are excluded.

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { classifyInteractiveElements } from '../classifier/index.js';
import type { DomNode } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    isVisible: true,
    xpath: '/test',
    cssSelector: 'test',
    ...overrides,
  };
}

describe('classifyInteractiveElements', () => {
  it('classifies a button element', () => {
    const tree = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'button', textContent: 'Click me' })],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('button');
  });

  it('classifies an anchor with href as navigation-link', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'a',
          attributes: { href: '/about' },
          textContent: 'About',
        }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('navigation-link');
  });

  it('classifies input types correctly', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({ tag: 'input', attributes: { type: 'text' } }),
        makeNode({ tag: 'input', attributes: { type: 'checkbox' } }),
        makeNode({ tag: 'input', attributes: { type: 'radio' } }),
        makeNode({ tag: 'input', attributes: { type: 'date' } }),
        makeNode({ tag: 'input', attributes: { type: 'file' } }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(5);
    expect(result[0]?.category).toBe('form-field');
    expect(result[1]?.category).toBe('checkbox');
    expect(result[2]?.category).toBe('radio');
    expect(result[3]?.category).toBe('date-picker');
    expect(result[4]?.category).toBe('file-upload');
  });

  it('classifies select as dropdown', () => {
    const tree = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'select' })],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('dropdown');
  });

  it('classifies textarea as form-field', () => {
    const tree = makeNode({
      tag: 'div',
      children: [makeNode({ tag: 'textarea' })],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('form-field');
  });

  it('excludes disabled elements', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({ tag: 'button', attributes: { disabled: '' } }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(0);
  });

  it('excludes elements with pointer-events: none', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'button',
          attributes: { style: 'pointer-events: none' },
        }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(0);
  });

  it('excludes invisible elements', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({ tag: 'button', isVisible: false }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(0);
  });

  it('classifies elements by ARIA role attribute', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'div',
          attributes: { role: 'button' },
          textContent: 'Custom button',
        }),
        makeNode({
          tag: 'div',
          attributes: { role: 'link' },
          textContent: 'Custom link',
        }),
        makeNode({
          tag: 'div',
          attributes: { role: 'checkbox' },
        }),
        makeNode({
          tag: 'div',
          attributes: { role: 'combobox' },
        }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(4);
    expect(result[0]?.category).toBe('button');
    expect(result[1]?.category).toBe('navigation-link');
    expect(result[2]?.category).toBe('checkbox');
    expect(result[3]?.category).toBe('dropdown');
  });

  it('custom web components with ARIA roles are classified by role', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'my-custom-button',
          attributes: { role: 'button' },
          textContent: 'Custom',
        }),
      ],
    });

    const result = classifyInteractiveElements(tree);

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe('button');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/analysis/src/__tests__/element-classifier.test.ts`
Expected: FAIL

**Step 3: Implement the rules and classifier**

Create `packages/analysis/src/classifier/rules.ts`:

```typescript
import type { ElementCategory } from '../types.js';

/** Maps ARIA roles to element categories. */
const ROLE_TO_CATEGORY: Readonly<Record<string, ElementCategory>> = {
  button: 'button',
  link: 'navigation-link',
  checkbox: 'checkbox',
  radio: 'radio',
  combobox: 'dropdown',
  listbox: 'dropdown',
  textbox: 'form-field',
  searchbox: 'form-field',
  spinbutton: 'form-field',
  slider: 'form-field',
};

/** Maps input types to element categories. */
const INPUT_TYPE_TO_CATEGORY: Readonly<Record<string, ElementCategory>> = {
  checkbox: 'checkbox',
  radio: 'radio',
  date: 'date-picker',
  'datetime-local': 'date-picker',
  month: 'date-picker',
  week: 'date-picker',
  time: 'date-picker',
  file: 'file-upload',
};

/** Maps tag names to element categories (for tags that are always interactive). */
const TAG_TO_CATEGORY: Readonly<Record<string, ElementCategory>> = {
  button: 'button',
  select: 'dropdown',
  textarea: 'form-field',
};

export function categorizeByRole(role: string): ElementCategory | null {
  return ROLE_TO_CATEGORY[role] ?? null;
}

export function categorizeByTag(
  tag: string,
  attributes: Readonly<Record<string, string>>,
): ElementCategory | null {
  const lower = tag.toLowerCase();

  if (lower === 'a' && 'href' in attributes) {
    return 'navigation-link';
  }

  if (lower === 'input') {
    const inputType = (attributes['type'] ?? 'text').toLowerCase();
    return INPUT_TYPE_TO_CATEGORY[inputType] ?? 'form-field';
  }

  return TAG_TO_CATEGORY[lower] ?? null;
}
```

Create `packages/analysis/src/classifier/element-classifier.ts`:

```typescript
import type { DomNode, InteractiveElement, ElementCategory } from '../types.js';
import { categorizeByRole, categorizeByTag } from './rules.js';

function isDisabled(attributes: Readonly<Record<string, string>>): boolean {
  if ('disabled' in attributes) return true;
  if ('aria-disabled' in attributes && attributes['aria-disabled'] === 'true') return true;
  return false;
}

function hasPointerEventsNone(attributes: Readonly<Record<string, string>>): boolean {
  const style = attributes['style'];
  if (!style) return false;
  return /pointer-events\s*:\s*none/i.test(style);
}

function classifyNode(node: DomNode): ElementCategory | null {
  const role = node.attributes['role'];
  if (role) {
    return categorizeByRole(role);
  }
  return categorizeByTag(node.tag, node.attributes);
}

function collectInteractive(
  node: DomNode,
  results: InteractiveElement[],
): void {
  if (!node.isVisible) return;

  const category = classifyNode(node);
  if (category !== null) {
    const disabled = isDisabled(node.attributes);
    const pointerEventsNone = hasPointerEventsNone(node.attributes);

    if (!disabled && !pointerEventsNone) {
      results.push({
        node,
        category,
        isDisabled: false,
        accessibilityInfo: null,
      });
    }
  }

  for (const child of node.children) {
    collectInteractive(child, results);
  }
}

/** Walk a DomNode tree and return all interactive elements with classifications. */
export function classifyInteractiveElements(
  root: DomNode,
): readonly InteractiveElement[] {
  const results: InteractiveElement[] = [];
  collectInteractive(root, results);
  return results;
}
```

Create `packages/analysis/src/classifier/index.ts`:

```typescript
export { classifyInteractiveElements } from './element-classifier.js';
export { categorizeByRole, categorizeByTag } from './rules.js';
```

**Step 4: Update index.ts**

Add to `packages/analysis/src/index.ts`:

```typescript
export {
  classifyInteractiveElements,
  categorizeByRole,
  categorizeByTag,
} from './classifier/index.js';
```

**Step 5: Run tests**

Run: `pnpm vitest run packages/analysis/src/__tests__/element-classifier.test.ts`
Expected: PASS

**Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 7: Commit**

```
feat(analysis): add interactive element classifier with ARIA support (#37)
```

---

### Task 5: DOM Differ (#41)

**Files:**
- Create: `packages/analysis/src/diff/dom-differ.ts`
- Create: `packages/analysis/src/diff/index.ts`
- Create: `packages/analysis/src/__tests__/dom-differ.test.ts`
- Modify: `packages/analysis/src/index.ts`

Compares two `DomNode` trees and produces a `DomDiff` of added, removed, and modified elements. Matches nodes by xpath.

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { diffDom } from '../diff/index.js';
import type { DomNode } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    isVisible: true,
    xpath: '/test',
    cssSelector: 'test',
    ...overrides,
  };
}

describe('diffDom', () => {
  it('returns empty diff for identical trees', () => {
    const tree = makeNode({ tag: 'div', xpath: '/div' });
    const diff = diffDom(tree, tree);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it('detects added elements', () => {
    const before = makeNode({ tag: 'div', xpath: '/div', children: [] });
    const after = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [makeNode({ tag: 'span', xpath: '/div/span', textContent: 'New' })],
    });

    const diff = diffDom(before, after);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.tag).toBe('span');
  });

  it('detects removed elements', () => {
    const before = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [makeNode({ tag: 'span', xpath: '/div/span', textContent: 'Old' })],
    });
    const after = makeNode({ tag: 'div', xpath: '/div', children: [] });

    const diff = diffDom(before, after);

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]?.tag).toBe('span');
  });

  it('detects modified text content', () => {
    const before = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [
        makeNode({ tag: 'span', xpath: '/div/span', textContent: 'old text' }),
      ],
    });
    const after = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [
        makeNode({ tag: 'span', xpath: '/div/span', textContent: 'new text' }),
      ],
    });

    const diff = diffDom(before, after);

    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.changes).toContainEqual({
      type: 'text',
      name: 'textContent',
      oldValue: 'old text',
      newValue: 'new text',
    });
  });

  it('detects modified attributes', () => {
    const before = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [
        makeNode({
          tag: 'input',
          xpath: '/div/input',
          attributes: { value: 'old' },
        }),
      ],
    });
    const after = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [
        makeNode({
          tag: 'input',
          xpath: '/div/input',
          attributes: { value: 'new' },
        }),
      ],
    });

    const diff = diffDom(before, after);

    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.changes).toContainEqual({
      type: 'attribute',
      name: 'value',
      oldValue: 'old',
      newValue: 'new',
    });
  });

  it('detects class changes', () => {
    const before = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [
        makeNode({
          tag: 'span',
          xpath: '/div/span',
          classes: ['active'],
        }),
      ],
    });
    const after = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [
        makeNode({
          tag: 'span',
          xpath: '/div/span',
          classes: ['inactive'],
        }),
      ],
    });

    const diff = diffDom(before, after);

    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.changes).toContainEqual({
      type: 'class',
      name: 'class',
      oldValue: 'active',
      newValue: 'inactive',
    });
  });

  it('handles mixed additions, removals, and modifications', () => {
    const before = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [
        makeNode({ tag: 'p', xpath: '/div/p', textContent: 'stays' }),
        makeNode({ tag: 'span', xpath: '/div/span', textContent: 'removed' }),
      ],
    });
    const after = makeNode({
      tag: 'div',
      xpath: '/div',
      children: [
        makeNode({ tag: 'p', xpath: '/div/p', textContent: 'changed' }),
        makeNode({ tag: 'button', xpath: '/div/button', textContent: 'added' }),
      ],
    });

    const diff = diffDom(before, after);

    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.modified).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/analysis/src/__tests__/dom-differ.test.ts`
Expected: FAIL

**Step 3: Implement the differ**

Create `packages/analysis/src/diff/dom-differ.ts`:

```typescript
import type {
  DomNode,
  DomDiff,
  ElementModification,
  AttributeChange,
} from '../types.js';

function flattenNodes(node: DomNode): Map<string, DomNode> {
  const map = new Map<string, DomNode>();
  map.set(node.xpath, node);
  for (const child of node.children) {
    for (const [key, value] of flattenNodes(child)) {
      map.set(key, value);
    }
  }
  return map;
}

function diffAttributes(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): AttributeChange[] {
  const changes: AttributeChange[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const oldVal = before[key] ?? null;
    const newVal = after[key] ?? null;
    if (oldVal !== newVal) {
      changes.push({
        type: 'attribute',
        name: key,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  return changes;
}

function diffNode(before: DomNode, after: DomNode): ElementModification | null {
  const changes: AttributeChange[] = [];

  if (before.textContent !== after.textContent) {
    changes.push({
      type: 'text',
      name: 'textContent',
      oldValue: before.textContent,
      newValue: after.textContent,
    });
  }

  const classesOld = before.classes.join(' ');
  const classesNew = after.classes.join(' ');
  if (classesOld !== classesNew) {
    changes.push({
      type: 'class',
      name: 'class',
      oldValue: classesOld,
      newValue: classesNew,
    });
  }

  changes.push(...diffAttributes(before.attributes, after.attributes));

  if (changes.length === 0) return null;

  return { before, after, changes };
}

/** Compare two DomNode trees and produce a diff of added, removed, and modified elements. */
export function diffDom(before: DomNode, after: DomNode): DomDiff {
  const beforeMap = flattenNodes(before);
  const afterMap = flattenNodes(after);

  const added: DomNode[] = [];
  const removed: DomNode[] = [];
  const modified: ElementModification[] = [];

  for (const [xpath, node] of afterMap) {
    if (!beforeMap.has(xpath)) {
      added.push(node);
    }
  }

  for (const [xpath, node] of beforeMap) {
    if (!afterMap.has(xpath)) {
      removed.push(node);
    }
  }

  for (const [xpath, beforeNode] of beforeMap) {
    const afterNode = afterMap.get(xpath);
    if (afterNode) {
      const mod = diffNode(beforeNode, afterNode);
      if (mod) modified.push(mod);
    }
  }

  return { added, removed, modified };
}
```

Create `packages/analysis/src/diff/index.ts`:

```typescript
export { diffDom } from './dom-differ.js';
```

**Step 4: Update index.ts**

Add: `export { diffDom } from './diff/index.js';`

**Step 5: Run tests**

Run: `pnpm vitest run packages/analysis/src/__tests__/dom-differ.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat(analysis): add DOM diff algorithm (#41)
```

---

### Task 6: Accessibility Analyzer (#39)

**Files:**
- Create: `packages/analysis/src/accessibility/accessibility-analyzer.ts`
- Create: `packages/analysis/src/accessibility/merge.ts`
- Create: `packages/analysis/src/accessibility/index.ts`
- Create: `packages/analysis/src/__tests__/accessibility-analyzer.test.ts`
- Modify: `packages/analysis/src/index.ts`

Parses the raw accessibility tree and merges it with the DOM model. Flags elements missing from the a11y tree as potential issues.

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseAccessibilityTree,
  mergeAccessibility,
  findAccessibilityIssues,
} from '../accessibility/index.js';
import type { DomNode, RawAccessibilityNode, InteractiveElement } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    isVisible: true,
    xpath: '/test',
    cssSelector: 'test',
    ...overrides,
  };
}

describe('parseAccessibilityTree', () => {
  it('extracts accessibility info from raw nodes', () => {
    const raw: RawAccessibilityNode = {
      role: 'button',
      name: 'Submit',
      description: 'Submit the form',
      value: null,
      children: [],
    };

    const result = parseAccessibilityTree(raw);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe('button');
    expect(result[0]?.name).toBe('Submit');
    expect(result[0]?.description).toBe('Submit the form');
  });

  it('flattens nested accessibility nodes', () => {
    const raw: RawAccessibilityNode = {
      role: 'form',
      name: 'Login',
      description: '',
      value: null,
      children: [
        {
          role: 'textbox',
          name: 'Email',
          description: '',
          value: null,
          children: [],
        },
        {
          role: 'button',
          name: 'Submit',
          description: '',
          value: null,
          children: [],
        },
      ],
    };

    const result = parseAccessibilityTree(raw);

    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('skips nodes with empty role', () => {
    const raw: RawAccessibilityNode = {
      role: '',
      name: '',
      description: '',
      value: null,
      children: [
        {
          role: 'button',
          name: 'OK',
          description: '',
          value: null,
          children: [],
        },
      ],
    };

    const result = parseAccessibilityTree(raw);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe('button');
  });
});

describe('mergeAccessibility', () => {
  it('attaches accessibility info to matching interactive elements', () => {
    const elements: InteractiveElement[] = [
      {
        node: makeNode({
          tag: 'button',
          textContent: 'Submit',
          attributes: { role: 'button' },
        }),
        category: 'button',
        isDisabled: false,
        accessibilityInfo: null,
      },
    ];

    const a11yNodes: RawAccessibilityNode = {
      role: 'button',
      name: 'Submit',
      description: '',
      value: null,
      children: [],
    };

    const merged = mergeAccessibility(elements, a11yNodes);

    expect(merged[0]?.accessibilityInfo).not.toBeNull();
    expect(merged[0]?.accessibilityInfo?.name).toBe('Submit');
  });
});

describe('findAccessibilityIssues', () => {
  it('flags interactive elements missing from accessibility tree', () => {
    const elements: InteractiveElement[] = [
      {
        node: makeNode({ tag: 'button', textContent: '' }),
        category: 'button',
        isDisabled: false,
        accessibilityInfo: null,
      },
    ];

    const issues = findAccessibilityIssues(elements);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.issue).toBe('missing-accessible-name');
  });

  it('returns no issues for well-labeled elements', () => {
    const elements: InteractiveElement[] = [
      {
        node: makeNode({
          tag: 'button',
          textContent: 'Submit',
          attributes: { 'aria-label': 'Submit form' },
        }),
        category: 'button',
        isDisabled: false,
        accessibilityInfo: {
          name: 'Submit form',
          role: 'button',
          description: '',
          states: {},
        },
      },
    ];

    const issues = findAccessibilityIssues(elements);

    expect(issues).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/analysis/src/__tests__/accessibility-analyzer.test.ts`
Expected: FAIL

**Step 3: Implement accessibility analyzer**

Create `packages/analysis/src/accessibility/accessibility-analyzer.ts`:

```typescript
import type {
  RawAccessibilityNode,
  AccessibilityInfo,
  InteractiveElement,
  AccessibilityIssue,
} from '../types.js';

/** Flatten and parse a raw accessibility tree into AccessibilityInfo entries. */
export function parseAccessibilityTree(
  root: RawAccessibilityNode,
): readonly AccessibilityInfo[] {
  const results: AccessibilityInfo[] = [];

  function walk(node: RawAccessibilityNode): void {
    if (node.role) {
      results.push({
        name: node.name,
        role: node.role,
        description: node.description,
        states: node.value !== null ? { value: node.value } : {},
      });
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
  return results;
}

/** Find accessibility issues in interactive elements. */
export function findAccessibilityIssues(
  elements: readonly InteractiveElement[],
): readonly AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (const element of elements) {
    const hasA11yInfo = element.accessibilityInfo !== null;
    const hasName =
      element.node.textContent.trim().length > 0 ||
      element.node.attributes['aria-label'] !== undefined ||
      element.node.attributes['aria-labelledby'] !== undefined ||
      element.node.attributes['title'] !== undefined;
    const hasA11yName = hasA11yInfo && element.accessibilityInfo.name.trim().length > 0;

    if (!hasName && !hasA11yName) {
      issues.push({
        node: element.node,
        issue: 'missing-accessible-name',
      });
    }

    if (!hasA11yInfo && !element.node.attributes['role']) {
      issues.push({
        node: element.node,
        issue: 'missing-from-a11y-tree',
      });
    }
  }

  return issues;
}
```

Create `packages/analysis/src/accessibility/merge.ts`:

```typescript
import type {
  InteractiveElement,
  RawAccessibilityNode,
  AccessibilityInfo,
} from '../types.js';
import { parseAccessibilityTree } from './accessibility-analyzer.js';

function findBestMatch(
  element: InteractiveElement,
  a11yEntries: readonly AccessibilityInfo[],
): AccessibilityInfo | null {
  const role = element.node.attributes['role'] ?? element.node.tag;
  const text = element.node.textContent.trim();

  // Match by role + name
  for (const entry of a11yEntries) {
    if (entry.role === role && entry.name === text) {
      return entry;
    }
  }

  // Match by name only
  if (text) {
    for (const entry of a11yEntries) {
      if (entry.name === text) {
        return entry;
      }
    }
  }

  // Match by role only (first match)
  for (const entry of a11yEntries) {
    if (entry.role === role) {
      return entry;
    }
  }

  return null;
}

/** Merge accessibility tree data into interactive elements. */
export function mergeAccessibility(
  elements: readonly InteractiveElement[],
  rawA11yTree: RawAccessibilityNode,
): readonly InteractiveElement[] {
  const a11yEntries = parseAccessibilityTree(rawA11yTree);

  return elements.map((element) => {
    const match = findBestMatch(element, a11yEntries);
    if (match) {
      return { ...element, accessibilityInfo: match };
    }
    return element;
  });
}
```

Create `packages/analysis/src/accessibility/index.ts`:

```typescript
export { parseAccessibilityTree, findAccessibilityIssues } from './accessibility-analyzer.js';
export { mergeAccessibility } from './merge.js';
```

**Step 4: Update index.ts**

Add:

```typescript
export {
  parseAccessibilityTree,
  mergeAccessibility,
  findAccessibilityIssues,
} from './accessibility/index.js';
```

**Step 5: Run tests**

Run: `pnpm vitest run packages/analysis/src/__tests__/accessibility-analyzer.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat(analysis): add accessibility tree analyzer and merger (#39)
```

---

### Task 7: Form Detector (#40)

**Files:**
- Create: `packages/analysis/src/forms/constraints.ts`
- Create: `packages/analysis/src/forms/form-detector.ts`
- Create: `packages/analysis/src/forms/index.ts`
- Create: `packages/analysis/src/__tests__/form-detector.test.ts`
- Modify: `packages/analysis/src/index.ts`

Detects forms in a DomNode tree and extracts field types, labels, and validation constraints.

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { detectForms } from '../forms/index.js';
import type { DomNode } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    isVisible: true,
    xpath: '/test',
    cssSelector: 'test',
    ...overrides,
  };
}

describe('detectForms', () => {
  it('detects a simple form with fields', () => {
    const tree = makeNode({
      tag: 'div',
      children: [
        makeNode({
          tag: 'form',
          attributes: { action: '/submit', method: 'POST' },
          children: [
            makeNode({
              tag: 'input',
              attributes: { type: 'text', name: 'username', required: '' },
            }),
            makeNode({
              tag: 'input',
              attributes: { type: 'password', name: 'password' },
            }),
            makeNode({ tag: 'button', attributes: { type: 'submit' } }),
          ],
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms).toHaveLength(1);
    expect(forms[0]?.action).toBe('/submit');
    expect(forms[0]?.method).toBe('POST');
    expect(forms[0]?.fields).toHaveLength(2);
  });

  it('extracts required constraint', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'input',
          attributes: { type: 'email', name: 'email', required: '' },
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.constraints.required).toBe(true);
  });

  it('extracts pattern constraint', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'input',
          attributes: { type: 'text', name: 'zip', pattern: '\\d{5}' },
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.constraints.pattern).toBe('\\d{5}');
  });

  it('extracts min/max constraints', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'input',
          attributes: { type: 'number', name: 'age', min: '0', max: '120' },
        }),
      ],
    });

    const forms = detectForms(tree);
    const field = forms[0]?.fields[0];

    expect(field?.constraints.min).toBe('0');
    expect(field?.constraints.max).toBe('120');
  });

  it('extracts minLength/maxLength constraints', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'input',
          attributes: {
            type: 'text',
            name: 'name',
            minlength: '2',
            maxlength: '100',
          },
        }),
      ],
    });

    const forms = detectForms(tree);
    const field = forms[0]?.fields[0];

    expect(field?.constraints.minLength).toBe(2);
    expect(field?.constraints.maxLength).toBe(100);
  });

  it('detects ARIA required equivalents', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'input',
          attributes: { type: 'text', name: 'field', 'aria-required': 'true' },
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.constraints.required).toBe(true);
  });

  it('extracts label from associated label element', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'label',
          attributes: { for: 'email' },
          textContent: 'Email Address',
        }),
        makeNode({
          tag: 'input',
          id: 'email',
          attributes: { type: 'email', name: 'email' },
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.label).toBe('Email Address');
  });

  it('extracts placeholder', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({
          tag: 'input',
          attributes: {
            type: 'text',
            name: 'search',
            placeholder: 'Search...',
          },
        }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields[0]?.placeholder).toBe('Search...');
  });

  it('includes select and textarea as form fields', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({ tag: 'select', attributes: { name: 'country' } }),
        makeNode({ tag: 'textarea', attributes: { name: 'bio' } }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.fields).toHaveLength(2);
  });

  it('defaults method to GET when not specified', () => {
    const tree = makeNode({
      tag: 'form',
      children: [
        makeNode({ tag: 'input', attributes: { type: 'text', name: 'q' } }),
      ],
    });

    const forms = detectForms(tree);

    expect(forms[0]?.method).toBe('GET');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/analysis/src/__tests__/form-detector.test.ts`
Expected: FAIL

**Step 3: Implement form detector**

Create `packages/analysis/src/forms/constraints.ts`:

```typescript
import type { DomNode, FieldConstraints } from '../types.js';

/** Extract validation constraints from a form field's attributes. */
export function extractConstraints(
  node: DomNode,
): FieldConstraints {
  const attrs = node.attributes;

  const required =
    'required' in attrs || attrs['aria-required'] === 'true';

  const pattern = attrs['pattern'] ?? null;
  const min = attrs['min'] ?? null;
  const max = attrs['max'] ?? null;

  const minLengthStr = attrs['minlength'];
  const maxLengthStr = attrs['maxlength'];
  const minLength = minLengthStr !== undefined ? parseInt(minLengthStr, 10) : null;
  const maxLength = maxLengthStr !== undefined ? parseInt(maxLengthStr, 10) : null;

  return {
    required,
    pattern,
    min,
    max,
    minLength: minLength !== null && !Number.isNaN(minLength) ? minLength : null,
    maxLength: maxLength !== null && !Number.isNaN(maxLength) ? maxLength : null,
  };
}
```

Create `packages/analysis/src/forms/form-detector.ts`:

```typescript
import type { DomNode, FormModel, FormField } from '../types.js';
import { extractConstraints } from './constraints.js';

const FORM_FIELD_TAGS = new Set(['input', 'select', 'textarea']);
const EXCLUDED_INPUT_TYPES = new Set(['submit', 'reset', 'button', 'hidden', 'image']);

function findLabels(formNode: DomNode): Map<string, string> {
  const labels = new Map<string, string>();

  function walk(node: DomNode): void {
    if (node.tag === 'label' && node.attributes['for']) {
      labels.set(node.attributes['for'], node.textContent.trim());
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(formNode);
  return labels;
}

function collectFields(
  node: DomNode,
  labels: Map<string, string>,
  fields: FormField[],
): void {
  const tag = node.tag.toLowerCase();

  if (FORM_FIELD_TAGS.has(tag)) {
    const inputType = (node.attributes['type'] ?? 'text').toLowerCase();

    if (tag === 'input' && EXCLUDED_INPUT_TYPES.has(inputType)) {
      // Skip non-data input types
    } else {
      const name = node.attributes['name'] ?? null;
      const labelText = node.id ? (labels.get(node.id) ?? null) : null;
      const ariaLabel = node.attributes['aria-label'] ?? null;
      const placeholder = node.attributes['placeholder'] ?? null;

      fields.push({
        node,
        inputType: tag === 'select' ? 'select' : tag === 'textarea' ? 'textarea' : inputType,
        name,
        label: labelText ?? ariaLabel,
        placeholder,
        constraints: extractConstraints(node),
      });
    }
  }

  for (const child of node.children) {
    collectFields(child, labels, fields);
  }
}

function collectForms(node: DomNode, forms: FormModel[]): void {
  if (node.tag.toLowerCase() === 'form') {
    const labels = findLabels(node);
    const fields: FormField[] = [];
    for (const child of node.children) {
      collectFields(child, labels, fields);
    }

    forms.push({
      formElement: node,
      action: node.attributes['action'] ?? null,
      method: (node.attributes['method'] ?? 'GET').toUpperCase(),
      fields,
      isMultiStep: false,
    });
    return;
  }

  for (const child of node.children) {
    collectForms(child, forms);
  }
}

/** Detect all forms in a DomNode tree and extract their structure. */
export function detectForms(root: DomNode): readonly FormModel[] {
  const forms: FormModel[] = [];
  collectForms(root, forms);
  return forms;
}
```

Create `packages/analysis/src/forms/index.ts`:

```typescript
export { detectForms } from './form-detector.js';
export { extractConstraints } from './constraints.js';
```

**Step 4: Update index.ts**

Add:

```typescript
export { detectForms, extractConstraints } from './forms/index.js';
```

**Step 5: Run tests**

Run: `pnpm vitest run packages/analysis/src/__tests__/form-detector.test.ts`
Expected: PASS

**Step 6: Commit**

```
feat(analysis): add form structure and constraint detector (#40)
```

---

### Task 8: State Tracker (#38)

**Files:**
- Create: `packages/analysis/src/state/state-hasher.ts`
- Create: `packages/analysis/src/state/state-tracker.ts`
- Create: `packages/analysis/src/state/transition-graph.ts`
- Create: `packages/analysis/src/state/index.ts`
- Create: `packages/analysis/src/__tests__/state-tracker.test.ts`
- Modify: `packages/analysis/src/index.ts`

Tracks application state as (URL, DOM hash, modal indicators). Records transitions and exports a state graph.

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { StateTracker } from '../state/index.js';
import { hashDomContent } from '../state/state-hasher.js';
import type { DomNode } from '../types.js';

function makeNode(overrides: Partial<DomNode> & { tag: string }): DomNode {
  return {
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: { x: 0, y: 0, width: 100, height: 30 },
    isVisible: true,
    xpath: '/test',
    cssSelector: 'test',
    ...overrides,
  };
}

describe('hashDomContent', () => {
  it('produces a hex string hash', () => {
    const node = makeNode({ tag: 'div', textContent: 'Hello' });
    const hash = hashDomContent(node);

    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('produces the same hash for identical trees', () => {
    const node1 = makeNode({ tag: 'div', textContent: 'Hello' });
    const node2 = makeNode({ tag: 'div', textContent: 'Hello' });

    expect(hashDomContent(node1)).toBe(hashDomContent(node2));
  });

  it('produces different hashes for different content', () => {
    const node1 = makeNode({ tag: 'div', textContent: 'Hello' });
    const node2 = makeNode({ tag: 'div', textContent: 'World' });

    expect(hashDomContent(node1)).not.toBe(hashDomContent(node2));
  });
});

describe('StateTracker', () => {
  it('records initial state', () => {
    const tracker = new StateTracker();
    const node = makeNode({ tag: 'div', textContent: 'Page 1' });

    tracker.recordState('https://example.com', node, []);

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(1);
    expect(graph.states[0]?.url).toBe('https://example.com');
  });

  it('records transition when URL changes', () => {
    const tracker = new StateTracker();
    const node1 = makeNode({ tag: 'div', textContent: 'Page 1' });
    const node2 = makeNode({ tag: 'div', textContent: 'Page 2' });

    tracker.recordState('https://example.com', node1, []);
    tracker.recordState('https://example.com/about', node2, [], 'click About link');

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(2);
    expect(graph.transitions).toHaveLength(1);
    expect(graph.transitions[0]?.action).toBe('click About link');
  });

  it('records transition when DOM changes significantly without URL change', () => {
    const tracker = new StateTracker();
    const node1 = makeNode({
      tag: 'div',
      textContent: 'Content A',
      children: [
        makeNode({ tag: 'p', textContent: 'Original paragraph 1' }),
        makeNode({ tag: 'p', textContent: 'Original paragraph 2' }),
      ],
    });
    const node2 = makeNode({
      tag: 'div',
      textContent: 'Content B completely different',
      children: [
        makeNode({ tag: 'section', textContent: 'New section 1' }),
        makeNode({ tag: 'section', textContent: 'New section 2' }),
      ],
    });

    tracker.recordState('https://example.com', node1, []);
    tracker.recordState('https://example.com', node2, [], 'tab switch');

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(2);
    expect(graph.transitions).toHaveLength(1);
  });

  it('does not record transition for minor DOM changes', () => {
    const tracker = new StateTracker();
    const node1 = makeNode({ tag: 'div', textContent: 'Hello World' });
    const node2 = makeNode({ tag: 'div', textContent: 'Hello World!' });

    tracker.recordState('https://example.com', node1, []);
    tracker.recordState('https://example.com', node2, []);

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(1);
  });

  it('tracks modal as nested state layer', () => {
    const tracker = new StateTracker();
    const node = makeNode({ tag: 'div', textContent: 'Page' });

    tracker.recordState('https://example.com', node, []);
    tracker.recordState('https://example.com', node, ['dialog#confirm'], 'open dialog');

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(2);
    expect(graph.states[1]?.modalIndicators).toContain('dialog#confirm');
  });

  it('exports graph as JSON-serializable object', () => {
    const tracker = new StateTracker();
    const node = makeNode({ tag: 'div', textContent: 'Test' });

    tracker.recordState('https://example.com', node, []);

    const graph = tracker.exportGraph();
    const json = JSON.stringify(graph);
    expect(json).toBeTruthy();
    expect(JSON.parse(json)).toEqual(graph);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/analysis/src/__tests__/state-tracker.test.ts`
Expected: FAIL

**Step 3: Implement state hasher**

Create `packages/analysis/src/state/state-hasher.ts`:

```typescript
import { createHash } from 'node:crypto';
import type { DomNode } from '../types.js';

function collectContent(node: DomNode, parts: string[]): void {
  parts.push(node.tag);
  parts.push(node.textContent);
  for (const child of node.children) {
    collectContent(child, parts);
  }
}

/** Generate a content hash representing the visible DOM structure. */
export function hashDomContent(root: DomNode): string {
  const parts: string[] = [];
  collectContent(root, parts);
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
```

**Step 4: Implement state tracker**

Create `packages/analysis/src/state/state-tracker.ts`:

```typescript
import type {
  DomNode,
  PageState,
  StateTransition,
  StateTransitionGraph,
  DomDiff,
} from '../types.js';
import { hashDomContent } from './state-hasher.js';
import { diffDom } from '../diff/dom-differ.js';

/** Tracks application state transitions across a session. */
export class StateTracker {
  private readonly states: PageState[] = [];
  private readonly transitions: StateTransition[] = [];
  private lastDomNode: DomNode | null = null;

  /** Record the current state. Creates a transition if state changed. */
  recordState(
    url: string,
    domRoot: DomNode,
    modalIndicators: readonly string[],
    action?: string,
  ): void {
    const domHash = hashDomContent(domRoot);
    const currentState = this.states[this.states.length - 1];

    const isNewState =
      currentState === undefined ||
      currentState.url !== url ||
      currentState.domHash !== domHash ||
      this.modalIndicatorsChanged(currentState.modalIndicators, modalIndicators);

    if (!isNewState) return;

    const newState: PageState = {
      id: `state-${this.states.length + 1}`,
      url,
      domHash,
      modalIndicators: [...modalIndicators],
      timestamp: Date.now(),
    };

    this.states.push(newState);

    if (currentState && action) {
      let domDiff: DomDiff | null = null;
      if (this.lastDomNode) {
        domDiff = diffDom(this.lastDomNode, domRoot);
      }

      this.transitions.push({
        action,
        preState: currentState,
        postState: newState,
        domDiff,
      });
    }

    this.lastDomNode = domRoot;
  }

  /** Export the state transition graph as a JSON-serializable object. */
  exportGraph(): StateTransitionGraph {
    return {
      states: [...this.states],
      transitions: [...this.transitions],
    };
  }

  private modalIndicatorsChanged(
    previous: readonly string[],
    current: readonly string[],
  ): boolean {
    if (previous.length !== current.length) return true;
    for (let i = 0; i < previous.length; i++) {
      if (previous[i] !== current[i]) return true;
    }
    return false;
  }
}
```

Create `packages/analysis/src/state/transition-graph.ts`:

```typescript
import type { StateTransitionGraph } from '../types.js';

/** Serialize a state transition graph to a JSON string. */
export function exportGraphJson(graph: StateTransitionGraph): string {
  return JSON.stringify(graph, null, 2);
}
```

Create `packages/analysis/src/state/index.ts`:

```typescript
export { StateTracker } from './state-tracker.js';
export { hashDomContent } from './state-hasher.js';
export { exportGraphJson } from './transition-graph.js';
```

**Step 5: Update index.ts**

Add:

```typescript
export { StateTracker, hashDomContent, exportGraphJson } from './state/index.js';
```

**Step 6: Run tests**

Run: `pnpm vitest run packages/analysis/src/__tests__/state-tracker.test.ts`
Expected: PASS

**Step 7: Commit**

```
feat(analysis): add state tracker with transition graph export (#38)
```

---

### Task 9: Browser Extract Adapters

**Files:**
- Create: `packages/analysis/src/parser/extract.ts`
- Create: `packages/analysis/src/accessibility/extract.ts`
- Create: `packages/analysis/src/__tests__/extract.test.ts`
- Modify: `packages/analysis/src/index.ts`

High-level convenience functions that accept `BrowserEngine` + `PageHandle` and orchestrate DOM/a11y extraction via `evaluate()`.

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractDom, extractAccessibilityTree } from '../index.js';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { RawDomData, RawAccessibilityNode } from '../types.js';

function makeMockEngine(
  domResult: RawDomData,
  a11yResult?: RawAccessibilityNode,
): BrowserEngine {
  return {
    evaluate: vi.fn().mockResolvedValueOnce(domResult).mockResolvedValueOnce(a11yResult),
  } as unknown as BrowserEngine;
}

const mockPage = 'page-1' as PageHandle;

describe('extractDom', () => {
  it('calls evaluate and returns parsed DomNode', async () => {
    const rawDom: RawDomData = {
      tag: 'div',
      id: 'root',
      classes: [],
      attributes: {},
      textContent: 'Hello',
      children: [],
      boundingBox: { x: 0, y: 0, width: 800, height: 600 },
      isVisible: true,
    };
    const engine = makeMockEngine(rawDom);

    const result = await extractDom(engine, mockPage);

    expect(result.tag).toBe('div');
    expect(result.xpath).toBe('/div');
    expect(engine.evaluate).toHaveBeenCalledOnce();
  });
});

describe('extractAccessibilityTree', () => {
  it('calls evaluate and returns parsed accessibility info', async () => {
    const rawDom: RawDomData = {
      tag: 'div',
      id: null,
      classes: [],
      attributes: {},
      textContent: '',
      children: [],
      boundingBox: null,
      isVisible: true,
    };
    const rawA11y: RawAccessibilityNode = {
      role: 'button',
      name: 'Submit',
      description: '',
      value: null,
      children: [],
    };
    const engine = makeMockEngine(rawDom, rawA11y);

    const result = await extractAccessibilityTree(engine, mockPage);

    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe('button');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/analysis/src/__tests__/extract.test.ts`
Expected: FAIL

**Step 3: Implement extract adapters**

Create `packages/analysis/src/parser/extract.ts`:

```typescript
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { RawDomData, DomNode } from '../types.js';
import { parseDom } from './dom-parser.js';

/**
 * JavaScript function serialized as a string to be evaluated in the browser context.
 * Walks the DOM and returns a RawDomData tree.
 */
const DOM_EXTRACTION_SCRIPT = `() => {
  function serializeNode(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const isVisible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0;

    const attrs = {};
    for (const attr of el.attributes) {
      attrs[attr.name] = attr.value;
    }

    const children = [];
    for (const child of el.children) {
      children.push(serializeNode(child));
    }

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: [...el.classList],
      attributes: attrs,
      textContent: el.textContent?.trim() ?? '',
      children,
      boundingBox: isVisible ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      isVisible,
    };
  }

  return serializeNode(document.body);
}`;

/** Extract and parse the DOM from a browser page. */
export async function extractDom(
  engine: BrowserEngine,
  page: PageHandle,
): Promise<DomNode> {
  const raw = await engine.evaluate<RawDomData>(page, DOM_EXTRACTION_SCRIPT);
  return parseDom(raw);
}
```

Create `packages/analysis/src/accessibility/extract.ts`:

```typescript
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { RawAccessibilityNode, AccessibilityInfo } from '../types.js';
import { parseAccessibilityTree } from './accessibility-analyzer.js';

/**
 * JavaScript function serialized as a string to extract the accessibility tree.
 * Uses the browser's accessibility snapshot API.
 */
const A11Y_EXTRACTION_SCRIPT = `() => {
  function serializeA11yNode(node) {
    return {
      role: node.role || '',
      name: node.name || '',
      description: node.description || '',
      value: node.value?.toString() ?? null,
      children: (node.children || []).map(serializeA11yNode),
    };
  }

  // Fallback: walk ARIA attributes on DOM elements when no snapshot API available
  function walkAriaTree(el) {
    const role = el.getAttribute('role') || el.tagName?.toLowerCase() || '';
    const name =
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      el.textContent?.trim() ||
      '';
    const description = el.getAttribute('aria-describedby') || '';
    const value = el.getAttribute('aria-valuenow') || null;

    const children = [];
    for (const child of el.children) {
      children.push(walkAriaTree(child));
    }

    return { role, name, description, value, children };
  }

  return walkAriaTree(document.body);
}`;

/** Extract and parse the accessibility tree from a browser page. */
export async function extractAccessibilityTree(
  engine: BrowserEngine,
  page: PageHandle,
): Promise<readonly AccessibilityInfo[]> {
  const raw = await engine.evaluate<RawAccessibilityNode>(page, A11Y_EXTRACTION_SCRIPT);
  return parseAccessibilityTree(raw);
}
```

**Step 4: Update barrel exports**

Add to `packages/analysis/src/parser/index.ts`:

```typescript
export { extractDom } from './extract.js';
```

Add to `packages/analysis/src/accessibility/index.ts`:

```typescript
export { extractAccessibilityTree } from './extract.js';
```

Add to `packages/analysis/src/index.ts`:

```typescript
export { extractDom } from './parser/index.js';
export { extractAccessibilityTree } from './accessibility/index.js';
```

**Step 5: Run tests**

Run: `pnpm vitest run packages/analysis/src/__tests__/extract.test.ts`
Expected: PASS

**Step 6: Run full test suite**

Run: `pnpm test`
Expected: All tests pass across all packages

**Step 7: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 8: Commit**

```
feat(analysis): add browser engine extract adapters (#4)
```

---

### Task 10: Update CLAUDE.md and Final Validation

**Files:**
- Modify: `CLAUDE.md` (add analysis package to directory structure)

**Step 1: Update CLAUDE.md directory structure**

Add the `packages/analysis/` section to the annotated directory structure in `CLAUDE.md`, following the pattern of the browser package entry.

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Run lint**

Run: `pnpm lint`
Expected: No errors (or auto-fixable only)

**Step 5: Commit**

```
docs: add @sentinel/analysis to CLAUDE.md directory structure (#4)
```
