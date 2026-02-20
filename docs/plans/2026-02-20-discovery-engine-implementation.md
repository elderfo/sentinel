# Discovery Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `@sentinel/discovery` package — an autonomous web exploration engine that navigates applications, builds a navigation graph, detects cycles, identifies user journeys, and tracks coverage.

**Architecture:** Pure + adapters pattern (same as `@sentinel/analysis`). Pure functions for graph, cycle detection, scope enforcement, coverage, and journey identification. Thin browser adapters for SPA readiness and crawling. All domain types use `readonly` fields.

**Tech Stack:** TypeScript strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Vitest 4, `@sentinel/browser` for browser interaction, `@sentinel/analysis` for DOM parsing/classification/state tracking.

**Design doc:** `docs/plans/2026-02-20-discovery-engine-design.md`

---

## Parallelization Strategy

```
Layer 1 (parallel worktrees): Tasks 2, 3, 4  — graph, cycle, scope
Layer 2 (parallel worktrees): Tasks 5, 6, 7  — coverage, spa, journey
Layer 3 (sequential):         Task 8          — crawler orchestrator
Integration:                  Task 9          — barrel exports, config, CLAUDE.md
```

Task 1 (scaffolding) must complete first on the feature branch. Layer 1 tasks branch from that. After Layer 1 merges, Layer 2 branches. After Layer 2 merges, Layer 3. Task 9 is the final integration.

---

### Task 1: Package Scaffolding + Types

**Files:**

- Create: `packages/discovery/package.json`
- Create: `packages/discovery/tsconfig.json`
- Create: `packages/discovery/vitest.config.ts`
- Create: `packages/discovery/src/types.ts`
- Create: `packages/discovery/src/index.ts`
- Modify: `tsconfig.json` (add `@sentinel/discovery` path alias)
- Modify: `tsconfig.build.json` (add `discovery` reference)
- Modify: `vitest.config.ts` (add `@sentinel/discovery` project + alias)

**Step 1: Create `packages/discovery/package.json`**

```json
{
  "name": "@sentinel/discovery",
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
    "@sentinel/browser": "workspace:*",
    "@sentinel/analysis": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create `packages/discovery/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }, { "path": "../browser" }, { "path": "../analysis" }]
}
```

**Step 3: Create `packages/discovery/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: '@sentinel/discovery',
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
      '@sentinel/analysis': resolve(__dirname, '../analysis/src/index.ts'),
      '@sentinel/discovery': resolve(__dirname, './src/index.ts'),
    },
  },
});
```

**Step 4: Create `packages/discovery/src/types.ts`**

```typescript
// ---------------------------------------------------------------------------
// Graph model (Story 5.2)
// ---------------------------------------------------------------------------

export type ActionType = 'click' | 'form-submit' | 'navigation';

export interface AppNode {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly elementCount: number;
  readonly discoveryTimestamp: number;
  readonly domHash: string;
  readonly screenshotPath: string | null;
}

export interface AppEdge {
  readonly sourceId: string;
  readonly targetId: string;
  readonly actionType: ActionType;
  readonly selector: string;
  readonly httpStatus: number | null;
}

export interface GraphMetadata {
  readonly startUrl: string;
  readonly startedAt: number;
  readonly completedAt: number | null;
}

export interface AppGraph {
  readonly nodes: readonly AppNode[];
  readonly edges: readonly AppEdge[];
  readonly metadata: GraphMetadata;
}

// ---------------------------------------------------------------------------
// Cycle detection (Story 5.3)
// ---------------------------------------------------------------------------

export interface StateFingerprint {
  readonly normalizedUrl: string;
  readonly domHash: string;
}

export type CycleReason = 'duplicate-state' | 'parameterized-url-limit' | 'infinite-scroll';

export interface CycleEntry {
  readonly url: string;
  readonly reason: CycleReason;
  readonly count: number;
}

export interface CycleReport {
  readonly entries: readonly CycleEntry[];
  readonly totalCyclesDetected: number;
}

export interface CycleConfig {
  readonly parameterizedUrlLimit: number;
  readonly infiniteScrollThreshold: number;
}

export interface CycleDecision {
  readonly isCycle: boolean;
  readonly entry: CycleEntry | null;
}

// ---------------------------------------------------------------------------
// Scope enforcement (Story 5.7)
// ---------------------------------------------------------------------------

export interface ScopeConfig {
  readonly allowPatterns: readonly string[];
  readonly denyPatterns: readonly string[];
  readonly allowExternalDomains: boolean;
  readonly excludeQueryPatterns: readonly string[];
}

export interface ScopeDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Coverage tracking (Story 5.5)
// ---------------------------------------------------------------------------

export interface CoverageRatio {
  readonly covered: number;
  readonly total: number;
  readonly percentage: number;
}

export interface CoverageMetrics {
  readonly pageCoverage: CoverageRatio;
  readonly elementCoverage: CoverageRatio;
  readonly pathCoverage: CoverageRatio;
}

export interface CoverageThresholds {
  readonly minPageCoverage?: number | undefined;
  readonly minElementCoverage?: number | undefined;
  readonly minPathCoverage?: number | undefined;
}

export interface ThresholdResult {
  readonly met: boolean;
  readonly details: readonly string[];
}

// ---------------------------------------------------------------------------
// SPA readiness (Story 5.6)
// ---------------------------------------------------------------------------

export interface SpaReadinessOptions {
  readonly stabilityTimeout: number;
  readonly networkIdleTimeout: number;
  readonly pollInterval: number;
}

// ---------------------------------------------------------------------------
// User journey identification (Story 5.4)
// ---------------------------------------------------------------------------

export type JourneyType = 'authentication' | 'form-submission' | 'content-navigation' | 'custom';

export interface UserJourney {
  readonly id: string;
  readonly name: string;
  readonly type: JourneyType;
  readonly steps: readonly AppEdge[];
  readonly entryNodeId: string;
  readonly exitNodeId: string;
}

// ---------------------------------------------------------------------------
// Crawler / exploration engine (Story 5.1)
// ---------------------------------------------------------------------------

export type ExplorationStrategy = 'breadth-first' | 'depth-first';

export interface ExplorationConfig {
  readonly startUrl: string;
  readonly maxPages: number;
  readonly timeoutMs: number;
  readonly strategy: ExplorationStrategy;
  readonly scope: ScopeConfig;
  readonly cycleConfig: CycleConfig;
  readonly spaOptions?: SpaReadinessOptions | undefined;
  readonly coverageThresholds?: CoverageThresholds | undefined;
}

export interface ExplorationProgress {
  readonly pagesDiscovered: number;
  readonly pagesVisited: number;
  readonly pagesRemaining: number;
  readonly elementsActivated: number;
  readonly elapsedMs: number;
}

export interface ExplorationResult {
  readonly graph: AppGraph;
  readonly coverage: CoverageMetrics;
  readonly journeys: readonly UserJourney[];
  readonly cycleReport: CycleReport;
}

export interface ExplorationState {
  readonly queue: readonly string[];
  readonly visitedFingerprints: readonly string[];
  readonly graph: AppGraph;
  readonly activatedElementIds: readonly string[];
  readonly totalElementsFound: number;
  readonly startedAt: number;
}

export type ProgressCallback = (progress: ExplorationProgress) => void;
```

**Step 5: Create `packages/discovery/src/index.ts` (stub)**

```typescript
/**
 * @sentinel/discovery
 *
 * Autonomous web application exploration engine for the Sentinel QA platform.
 */

export type {
  ActionType,
  AppNode,
  AppEdge,
  GraphMetadata,
  AppGraph,
  StateFingerprint,
  CycleReason,
  CycleEntry,
  CycleReport,
  CycleConfig,
  CycleDecision,
  ScopeConfig,
  ScopeDecision,
  CoverageRatio,
  CoverageMetrics,
  CoverageThresholds,
  ThresholdResult,
  SpaReadinessOptions,
  JourneyType,
  UserJourney,
  ExplorationStrategy,
  ExplorationConfig,
  ExplorationProgress,
  ExplorationResult,
  ExplorationState,
  ProgressCallback,
} from './types.js';
```

**Step 6: Update root `tsconfig.json` — add path alias**

Add to `compilerOptions.paths`:

```json
"@sentinel/discovery": ["./packages/discovery/src/index.ts"]
```

**Step 7: Update `tsconfig.build.json` — add reference**

Add before `cli` reference:

```json
{ "path": "./packages/discovery" },
```

**Step 8: Update root `vitest.config.ts` — add project + alias**

Add to `resolve.alias`:

```typescript
'@sentinel/discovery': resolve(root, 'packages/discovery/src/index.ts'),
```

Add to `test.projects`:

```typescript
{
  extends: true,
  test: {
    name: '@sentinel/discovery',
    include: ['packages/discovery/src/**/*.test.ts'],
  },
},
```

**Step 9: Install dependencies**

Run: `pnpm install`

**Step 10: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 11: Commit**

```bash
git add packages/discovery/ tsconfig.json tsconfig.build.json vitest.config.ts pnpm-lock.yaml
git commit -m "feat(discovery): scaffold package with types"
```

---

### Task 2: Graph Module (Story 5.2)

> **Layer 1** — can run in parallel with Tasks 3 and 4.

**Files:**

- Create: `packages/discovery/src/graph/graph.ts`
- Create: `packages/discovery/src/graph/index.ts`
- Create: `packages/discovery/src/__tests__/graph.test.ts`

**Step 1: Write failing tests — `packages/discovery/src/__tests__/graph.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  createGraph,
  addNode,
  addEdge,
  getNode,
  getEdgesFrom,
  findPaths,
  completeGraph,
  serializeGraph,
  deserializeGraph,
} from '../graph/index.js';
import type { AppNode, AppEdge } from '../types.js';

function makeNode(overrides: Partial<AppNode> & { id: string }): AppNode {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    elementCount: 5,
    discoveryTimestamp: 1000,
    domHash: 'abc123',
    screenshotPath: null,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<AppEdge> & { sourceId: string; targetId: string }): AppEdge {
  return {
    actionType: 'navigation',
    selector: 'a[href]',
    httpStatus: null,
    ...overrides,
  };
}

describe('graph', () => {
  describe('createGraph', () => {
    it('returns an empty graph with start URL metadata', () => {
      const graph = createGraph('https://example.com');
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
      expect(graph.metadata.startUrl).toBe('https://example.com');
      expect(graph.metadata.startedAt).toBeGreaterThan(0);
      expect(graph.metadata.completedAt).toBeNull();
    });
  });

  describe('addNode', () => {
    it('returns a new graph with the node appended', () => {
      const graph = createGraph('https://example.com');
      const node = makeNode({ id: 'n1' });
      const updated = addNode(graph, node);

      expect(updated.nodes).toHaveLength(1);
      expect(updated.nodes[0]).toEqual(node);
      // Original graph is unchanged (immutability)
      expect(graph.nodes).toHaveLength(0);
    });
  });

  describe('addEdge', () => {
    it('returns a new graph with the edge appended', () => {
      const graph = createGraph('https://example.com');
      const edge = makeEdge({ sourceId: 'n1', targetId: 'n2' });
      const updated = addEdge(graph, edge);

      expect(updated.edges).toHaveLength(1);
      expect(updated.edges[0]).toEqual(edge);
      expect(graph.edges).toHaveLength(0);
    });
  });

  describe('getNode', () => {
    it('returns the node by ID', () => {
      const node = makeNode({ id: 'n1', title: 'Home' });
      const graph = addNode(createGraph('https://example.com'), node);

      expect(getNode(graph, 'n1')).toEqual(node);
    });

    it('returns undefined for missing ID', () => {
      const graph = createGraph('https://example.com');
      expect(getNode(graph, 'missing')).toBeUndefined();
    });
  });

  describe('getEdgesFrom', () => {
    it('returns edges originating from the given node', () => {
      let graph = createGraph('https://example.com');
      const e1 = makeEdge({ sourceId: 'n1', targetId: 'n2' });
      const e2 = makeEdge({ sourceId: 'n1', targetId: 'n3' });
      const e3 = makeEdge({ sourceId: 'n2', targetId: 'n3' });
      graph = addEdge(addEdge(addEdge(graph, e1), e2), e3);

      const fromN1 = getEdgesFrom(graph, 'n1');
      expect(fromN1).toHaveLength(2);
      expect(fromN1).toEqual([e1, e2]);
    });

    it('returns empty array when no edges match', () => {
      const graph = createGraph('https://example.com');
      expect(getEdgesFrom(graph, 'n1')).toEqual([]);
    });
  });

  describe('findPaths', () => {
    it('finds a direct path between connected nodes', () => {
      let graph = createGraph('https://example.com');
      graph = addNode(graph, makeNode({ id: 'a' }));
      graph = addNode(graph, makeNode({ id: 'b' }));
      graph = addEdge(graph, makeEdge({ sourceId: 'a', targetId: 'b' }));

      const paths = findPaths(graph, 'a', 'b');
      expect(paths).toEqual([['a', 'b']]);
    });

    it('finds multiple paths through the graph', () => {
      let graph = createGraph('https://example.com');
      graph = addNode(graph, makeNode({ id: 'a' }));
      graph = addNode(graph, makeNode({ id: 'b' }));
      graph = addNode(graph, makeNode({ id: 'c' }));
      graph = addEdge(graph, makeEdge({ sourceId: 'a', targetId: 'b' }));
      graph = addEdge(graph, makeEdge({ sourceId: 'a', targetId: 'c' }));
      graph = addEdge(graph, makeEdge({ sourceId: 'b', targetId: 'c' }));

      const paths = findPaths(graph, 'a', 'c');
      expect(paths).toHaveLength(2);
      expect(paths).toContainEqual(['a', 'c']);
      expect(paths).toContainEqual(['a', 'b', 'c']);
    });

    it('returns empty array for disconnected nodes', () => {
      let graph = createGraph('https://example.com');
      graph = addNode(graph, makeNode({ id: 'a' }));
      graph = addNode(graph, makeNode({ id: 'b' }));

      expect(findPaths(graph, 'a', 'b')).toEqual([]);
    });

    it('avoids infinite loops in cyclic graphs', () => {
      let graph = createGraph('https://example.com');
      graph = addNode(graph, makeNode({ id: 'a' }));
      graph = addNode(graph, makeNode({ id: 'b' }));
      graph = addEdge(graph, makeEdge({ sourceId: 'a', targetId: 'b' }));
      graph = addEdge(graph, makeEdge({ sourceId: 'b', targetId: 'a' }));

      const paths = findPaths(graph, 'a', 'b');
      expect(paths).toEqual([['a', 'b']]);
    });
  });

  describe('completeGraph', () => {
    it('sets completedAt timestamp', () => {
      const graph = createGraph('https://example.com');
      const completed = completeGraph(graph);
      expect(completed.metadata.completedAt).toBeGreaterThan(0);
    });
  });

  describe('serializeGraph / deserializeGraph', () => {
    it('roundtrips graph through JSON', () => {
      let graph = createGraph('https://example.com');
      graph = addNode(graph, makeNode({ id: 'n1', url: 'https://example.com', title: 'Home' }));
      graph = addNode(
        graph,
        makeNode({ id: 'n2', url: 'https://example.com/about', title: 'About' }),
      );
      graph = addEdge(graph, makeEdge({ sourceId: 'n1', targetId: 'n2' }));

      const json = serializeGraph(graph);
      const restored = deserializeGraph(json);

      expect(restored.nodes).toEqual(graph.nodes);
      expect(restored.edges).toEqual(graph.edges);
      expect(restored.metadata.startUrl).toBe(graph.metadata.startUrl);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/graph.test.ts`
Expected: FAIL — cannot resolve `../graph/index.js`

**Step 3: Implement `packages/discovery/src/graph/graph.ts`**

```typescript
import type { AppGraph, AppNode, AppEdge } from '../types.js';

export function createGraph(startUrl: string): AppGraph {
  return {
    nodes: [],
    edges: [],
    metadata: { startUrl, startedAt: Date.now(), completedAt: null },
  };
}

export function addNode(graph: AppGraph, node: AppNode): AppGraph {
  return { ...graph, nodes: [...graph.nodes, node] };
}

export function addEdge(graph: AppGraph, edge: AppEdge): AppGraph {
  return { ...graph, edges: [...graph.edges, edge] };
}

export function getNode(graph: AppGraph, nodeId: string): AppNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

export function getEdgesFrom(graph: AppGraph, nodeId: string): readonly AppEdge[] {
  return graph.edges.filter((e) => e.sourceId === nodeId);
}

/** BFS to find all acyclic paths from `fromId` to `toId`. */
export function findPaths(
  graph: AppGraph,
  fromId: string,
  toId: string,
): readonly (readonly string[])[] {
  const results: string[][] = [];
  const queue: string[][] = [[fromId]];

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1]!;

    if (current === toId) {
      results.push(path);
      continue;
    }

    for (const edge of getEdgesFrom(graph, current)) {
      if (!path.includes(edge.targetId)) {
        queue.push([...path, edge.targetId]);
      }
    }
  }

  return results;
}

export function completeGraph(graph: AppGraph): AppGraph {
  return {
    ...graph,
    metadata: { ...graph.metadata, completedAt: Date.now() },
  };
}

export function serializeGraph(graph: AppGraph): string {
  return JSON.stringify(graph);
}

export function deserializeGraph(json: string): AppGraph {
  return JSON.parse(json) as AppGraph;
}
```

**Step 4: Create barrel — `packages/discovery/src/graph/index.ts`**

```typescript
export {
  createGraph,
  addNode,
  addEdge,
  getNode,
  getEdgesFrom,
  findPaths,
  completeGraph,
  serializeGraph,
  deserializeGraph,
} from './graph.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/graph.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/discovery/src/graph/ packages/discovery/src/__tests__/graph.test.ts
git commit -m "feat(discovery): add graph module with path queries"
```

---

### Task 3: Cycle Detection (Story 5.3)

> **Layer 1** — can run in parallel with Tasks 2 and 4.

**Files:**

- Create: `packages/discovery/src/cycle/url-normalizer.ts`
- Create: `packages/discovery/src/cycle/cycle-detector.ts`
- Create: `packages/discovery/src/cycle/index.ts`
- Create: `packages/discovery/src/__tests__/cycle.test.ts`

**Step 1: Write failing tests — `packages/discovery/src/__tests__/cycle.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  computeFingerprint,
  fingerprintKey,
  detectCycle,
  createCycleReport,
} from '../cycle/index.js';
import type { CycleConfig, StateFingerprint } from '../types.js';

const defaultConfig: CycleConfig = {
  parameterizedUrlLimit: 3,
  infiniteScrollThreshold: 10,
};

describe('url-normalizer', () => {
  describe('normalizeUrl', () => {
    it('strips trailing slash', () => {
      expect(normalizeUrl('https://example.com/about/')).toBe('https://example.com/about');
    });

    it('preserves root path slash', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    });

    it('lowercases scheme and hostname', () => {
      expect(normalizeUrl('HTTPS://Example.COM/About')).toBe('https://example.com/About');
    });

    it('sorts query parameters alphabetically', () => {
      expect(normalizeUrl('https://example.com/?z=1&a=2')).toBe('https://example.com/?a=2&z=1');
    });

    it('removes tracking parameters', () => {
      const url = 'https://example.com/page?utm_source=google&id=5&fbclid=abc';
      expect(normalizeUrl(url)).toBe('https://example.com/page?id=5');
    });

    it('removes hash fragment', () => {
      expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
    });

    it('returns original string for invalid URLs', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url');
    });
  });
});

describe('cycle-detector', () => {
  describe('computeFingerprint', () => {
    it('creates fingerprint from URL and DOM hash', () => {
      const fp = computeFingerprint('https://example.com', 'hash123');
      expect(fp.normalizedUrl).toBe('https://example.com');
      expect(fp.domHash).toBe('hash123');
    });
  });

  describe('fingerprintKey', () => {
    it('produces a deterministic string key', () => {
      const fp: StateFingerprint = { normalizedUrl: 'https://example.com', domHash: 'abc' };
      const key = fingerprintKey(fp);
      expect(key).toBe('https://example.com|abc');
    });

    it('produces different keys for different inputs', () => {
      const fp1: StateFingerprint = { normalizedUrl: 'https://a.com', domHash: 'x' };
      const fp2: StateFingerprint = { normalizedUrl: 'https://b.com', domHash: 'x' };
      expect(fingerprintKey(fp1)).not.toBe(fingerprintKey(fp2));
    });
  });

  describe('detectCycle', () => {
    it('allows a new fingerprint', () => {
      const fp = computeFingerprint('https://example.com', 'hash1');
      const visited = new Set<string>();
      const paramCounts = new Map<string, number>();

      const result = detectCycle(fp, visited, paramCounts, defaultConfig);
      expect(result.isCycle).toBe(false);
      expect(result.entry).toBeNull();
    });

    it('detects duplicate state when fingerprint was already visited', () => {
      const fp = computeFingerprint('https://example.com', 'hash1');
      const visited = new Set([fingerprintKey(fp)]);
      const paramCounts = new Map<string, number>();

      const result = detectCycle(fp, visited, paramCounts, defaultConfig);
      expect(result.isCycle).toBe(true);
      expect(result.entry?.reason).toBe('duplicate-state');
    });

    it('detects parameterized URL limit exceeded', () => {
      const fp = computeFingerprint('https://example.com/page', 'newHash');
      const visited = new Set<string>();
      const paramCounts = new Map([['https://example.com/page', 3]]);

      const result = detectCycle(fp, visited, paramCounts, defaultConfig);
      expect(result.isCycle).toBe(true);
      expect(result.entry?.reason).toBe('parameterized-url-limit');
    });

    it('allows URL below parameterized limit', () => {
      const fp = computeFingerprint('https://example.com/page', 'newHash');
      const visited = new Set<string>();
      const paramCounts = new Map([['https://example.com/page', 2]]);

      const result = detectCycle(fp, visited, paramCounts, defaultConfig);
      expect(result.isCycle).toBe(false);
    });
  });

  describe('createCycleReport', () => {
    it('aggregates entries and counts total', () => {
      const entries = [
        { url: 'https://example.com/a', reason: 'duplicate-state' as const, count: 1 },
        { url: 'https://example.com/b', reason: 'parameterized-url-limit' as const, count: 4 },
      ];

      const report = createCycleReport(entries);
      expect(report.entries).toEqual(entries);
      expect(report.totalCyclesDetected).toBe(2);
    });

    it('returns empty report for no entries', () => {
      const report = createCycleReport([]);
      expect(report.entries).toEqual([]);
      expect(report.totalCyclesDetected).toBe(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/cycle.test.ts`
Expected: FAIL — cannot resolve `../cycle/index.js`

**Step 3: Implement `packages/discovery/src/cycle/url-normalizer.ts`**

```typescript
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
]);

export function normalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  for (const param of TRACKING_PARAMS) {
    parsed.searchParams.delete(param);
  }

  parsed.searchParams.sort();
  parsed.hash = '';

  return parsed.href;
}
```

**Step 4: Implement `packages/discovery/src/cycle/cycle-detector.ts`**

```typescript
import type {
  StateFingerprint,
  CycleConfig,
  CycleDecision,
  CycleEntry,
  CycleReport,
} from '../types.js';

export function computeFingerprint(normalizedUrl: string, domHash: string): StateFingerprint {
  return { normalizedUrl, domHash };
}

export function fingerprintKey(fp: StateFingerprint): string {
  return `${fp.normalizedUrl}|${fp.domHash}`;
}

export function detectCycle(
  fingerprint: StateFingerprint,
  visited: ReadonlySet<string>,
  paramUrlCounts: ReadonlyMap<string, number>,
  config: CycleConfig,
): CycleDecision {
  const key = fingerprintKey(fingerprint);

  if (visited.has(key)) {
    return {
      isCycle: true,
      entry: { url: fingerprint.normalizedUrl, reason: 'duplicate-state', count: 1 },
    };
  }

  const urlCount = paramUrlCounts.get(fingerprint.normalizedUrl) ?? 0;
  if (urlCount >= config.parameterizedUrlLimit) {
    return {
      isCycle: true,
      entry: {
        url: fingerprint.normalizedUrl,
        reason: 'parameterized-url-limit',
        count: urlCount + 1,
      },
    };
  }

  return { isCycle: false, entry: null };
}

export function createCycleReport(entries: readonly CycleEntry[]): CycleReport {
  return {
    entries,
    totalCyclesDetected: entries.length,
  };
}
```

**Step 5: Create barrel — `packages/discovery/src/cycle/index.ts`**

```typescript
export { normalizeUrl } from './url-normalizer.js';
export {
  computeFingerprint,
  fingerprintKey,
  detectCycle,
  createCycleReport,
} from './cycle-detector.js';
```

**Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/cycle.test.ts`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add packages/discovery/src/cycle/ packages/discovery/src/__tests__/cycle.test.ts
git commit -m "feat(discovery): add cycle detection with URL normalization"
```

---

### Task 4: Scope Enforcement (Story 5.7)

> **Layer 1** — can run in parallel with Tasks 2 and 3.

**Files:**

- Create: `packages/discovery/src/scope/scope-filter.ts`
- Create: `packages/discovery/src/scope/index.ts`
- Create: `packages/discovery/src/__tests__/scope.test.ts`

**Step 1: Write failing tests — `packages/discovery/src/__tests__/scope.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { isUrlAllowed, validateScopeConfig } from '../scope/index.js';
import type { ScopeConfig } from '../types.js';

const baseConfig: ScopeConfig = {
  allowPatterns: [],
  denyPatterns: [],
  allowExternalDomains: false,
  excludeQueryPatterns: [],
};

describe('scope-filter', () => {
  describe('isUrlAllowed', () => {
    it('allows same-domain URLs when no patterns configured', () => {
      const result = isUrlAllowed('https://example.com/about', baseConfig, 'example.com');
      expect(result.allowed).toBe(true);
    });

    it('denies external domains by default', () => {
      const result = isUrlAllowed('https://other.com/page', baseConfig, 'example.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('External domain');
    });

    it('allows external domains when configured', () => {
      const config: ScopeConfig = { ...baseConfig, allowExternalDomains: true };
      const result = isUrlAllowed('https://other.com/page', config, 'example.com');
      expect(result.allowed).toBe(true);
    });

    it('allows URLs matching allow patterns', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        allowPatterns: ['/products/'],
      };
      const result = isUrlAllowed('https://example.com/products/shoes', config, 'example.com');
      expect(result.allowed).toBe(true);
    });

    it('denies URLs not matching any allow pattern', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        allowPatterns: ['/products/'],
      };
      const result = isUrlAllowed('https://example.com/admin', config, 'example.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Does not match');
    });

    it('deny patterns take precedence over allow patterns', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        allowPatterns: ['/products/'],
        denyPatterns: ['/products/internal'],
      };
      const result = isUrlAllowed(
        'https://example.com/products/internal/secret',
        config,
        'example.com',
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('deny pattern');
    });

    it('strips excluded query parameters before matching', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        denyPatterns: ['\\?.*session='],
        excludeQueryPatterns: ['^session$'],
      };
      // After stripping `session` param, the deny pattern should not match
      const result = isUrlAllowed('https://example.com/page?session=abc', config, 'example.com');
      expect(result.allowed).toBe(true);
    });

    it('returns not-allowed for invalid URLs', () => {
      const result = isUrlAllowed('not-a-url', baseConfig, 'example.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid URL');
    });
  });

  describe('validateScopeConfig', () => {
    it('accepts valid configuration', () => {
      const result = validateScopeConfig(baseConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects invalid regex in allow patterns', () => {
      const config: ScopeConfig = { ...baseConfig, allowPatterns: ['[invalid'] };
      const result = validateScopeConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid regex in deny patterns', () => {
      const config: ScopeConfig = { ...baseConfig, denyPatterns: ['(unclosed'] };
      const result = validateScopeConfig(config);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid regex in excludeQueryPatterns', () => {
      const config: ScopeConfig = { ...baseConfig, excludeQueryPatterns: ['*bad'] };
      const result = validateScopeConfig(config);
      expect(result.valid).toBe(false);
    });

    it('reports all invalid patterns, not just the first', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        allowPatterns: ['[bad1'],
        denyPatterns: ['(bad2'],
      };
      const result = validateScopeConfig(config);
      expect(result.errors.length).toBe(2);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/scope.test.ts`
Expected: FAIL — cannot resolve `../scope/index.js`

**Step 3: Implement `packages/discovery/src/scope/scope-filter.ts`**

```typescript
import type { ScopeConfig, ScopeDecision } from '../types.js';

export function isUrlAllowed(url: string, config: ScopeConfig, baseDomain: string): ScopeDecision {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }

  // External domain check
  if (!config.allowExternalDomains && parsed.hostname !== baseDomain) {
    return { allowed: false, reason: `External domain: ${parsed.hostname}` };
  }

  // Strip excluded query params before pattern matching
  for (const pattern of config.excludeQueryPatterns) {
    const regex = new RegExp(pattern);
    for (const key of [...parsed.searchParams.keys()]) {
      if (regex.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
  }

  const testUrl = parsed.href;

  // Deny patterns take precedence
  for (const pattern of config.denyPatterns) {
    if (new RegExp(pattern).test(testUrl)) {
      return { allowed: false, reason: `Matches deny pattern: ${pattern}` };
    }
  }

  // If no allow patterns, allow everything not denied
  if (config.allowPatterns.length === 0) {
    return { allowed: true, reason: 'No allow patterns configured, URL not denied' };
  }

  // Check allow patterns
  for (const pattern of config.allowPatterns) {
    if (new RegExp(pattern).test(testUrl)) {
      return { allowed: true, reason: `Matches allow pattern: ${pattern}` };
    }
  }

  return { allowed: false, reason: 'Does not match any allow pattern' };
}

export function validateScopeConfig(config: ScopeConfig): {
  readonly valid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];

  for (const pattern of config.allowPatterns) {
    try {
      new RegExp(pattern);
    } catch {
      errors.push(`Invalid allow pattern: ${pattern}`);
    }
  }

  for (const pattern of config.denyPatterns) {
    try {
      new RegExp(pattern);
    } catch {
      errors.push(`Invalid deny pattern: ${pattern}`);
    }
  }

  for (const pattern of config.excludeQueryPatterns) {
    try {
      new RegExp(pattern);
    } catch {
      errors.push(`Invalid exclude query pattern: ${pattern}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

**Step 4: Create barrel — `packages/discovery/src/scope/index.ts`**

```typescript
export { isUrlAllowed, validateScopeConfig } from './scope-filter.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/scope.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/discovery/src/scope/ packages/discovery/src/__tests__/scope.test.ts
git commit -m "feat(discovery): add scope enforcement with URL filtering"
```

---

### Task 5: Coverage Tracking (Story 5.5)

> **Layer 2** — can run in parallel with Tasks 6 and 7.

**Files:**

- Create: `packages/discovery/src/coverage/coverage-calculator.ts`
- Create: `packages/discovery/src/coverage/index.ts`
- Create: `packages/discovery/src/__tests__/coverage.test.ts`

**Step 1: Write failing tests — `packages/discovery/src/__tests__/coverage.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateCoverage, checkThresholds } from '../coverage/index.js';
import type { CoverageThresholds } from '../types.js';

describe('coverage-calculator', () => {
  describe('calculateCoverage', () => {
    it('calculates correct percentages', () => {
      const metrics = calculateCoverage(5, 10, 20, 100, 8, 15);

      expect(metrics.pageCoverage.covered).toBe(5);
      expect(metrics.pageCoverage.total).toBe(10);
      expect(metrics.pageCoverage.percentage).toBe(50);

      expect(metrics.elementCoverage.covered).toBe(20);
      expect(metrics.elementCoverage.total).toBe(100);
      expect(metrics.elementCoverage.percentage).toBe(20);

      expect(metrics.pathCoverage.covered).toBe(8);
      expect(metrics.pathCoverage.total).toBe(15);
      expect(metrics.pathCoverage.percentage).toBeCloseTo(53.33, 1);
    });

    it('handles zero totals without division errors', () => {
      const metrics = calculateCoverage(0, 0, 0, 0, 0, 0);

      expect(metrics.pageCoverage.percentage).toBe(0);
      expect(metrics.elementCoverage.percentage).toBe(0);
      expect(metrics.pathCoverage.percentage).toBe(0);
    });

    it('returns 100% when covered equals total', () => {
      const metrics = calculateCoverage(10, 10, 50, 50, 20, 20);
      expect(metrics.pageCoverage.percentage).toBe(100);
      expect(metrics.elementCoverage.percentage).toBe(100);
      expect(metrics.pathCoverage.percentage).toBe(100);
    });
  });

  describe('checkThresholds', () => {
    it('returns met when all percentages are above thresholds', () => {
      const metrics = calculateCoverage(8, 10, 80, 100, 15, 20);
      const thresholds: CoverageThresholds = {
        minPageCoverage: 70,
        minElementCoverage: 70,
        minPathCoverage: 70,
      };

      const result = checkThresholds(metrics, thresholds);
      expect(result.met).toBe(true);
      expect(result.details).toEqual([]);
    });

    it('returns not-met with details when below thresholds', () => {
      const metrics = calculateCoverage(3, 10, 20, 100, 5, 20);
      const thresholds: CoverageThresholds = {
        minPageCoverage: 50,
        minElementCoverage: 50,
      };

      const result = checkThresholds(metrics, thresholds);
      expect(result.met).toBe(false);
      expect(result.details.length).toBe(2);
    });

    it('checks only specified thresholds', () => {
      const metrics = calculateCoverage(3, 10, 20, 100, 5, 20);
      const thresholds: CoverageThresholds = {
        minPageCoverage: 20,
      };

      const result = checkThresholds(metrics, thresholds);
      expect(result.met).toBe(true);
    });

    it('returns met when no thresholds are specified', () => {
      const metrics = calculateCoverage(1, 10, 1, 100, 1, 20);
      const thresholds: CoverageThresholds = {};

      const result = checkThresholds(metrics, thresholds);
      expect(result.met).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/coverage.test.ts`
Expected: FAIL

**Step 3: Implement `packages/discovery/src/coverage/coverage-calculator.ts`**

```typescript
import type {
  CoverageRatio,
  CoverageMetrics,
  CoverageThresholds,
  ThresholdResult,
} from '../types.js';

function ratio(covered: number, total: number): CoverageRatio {
  return {
    covered,
    total,
    percentage: total === 0 ? 0 : (covered / total) * 100,
  };
}

export function calculateCoverage(
  pagesVisited: number,
  pagesDiscovered: number,
  elementsActivated: number,
  elementsFound: number,
  edgesTraversed: number,
  edgesDiscovered: number,
): CoverageMetrics {
  return {
    pageCoverage: ratio(pagesVisited, pagesDiscovered),
    elementCoverage: ratio(elementsActivated, elementsFound),
    pathCoverage: ratio(edgesTraversed, edgesDiscovered),
  };
}

export function checkThresholds(
  metrics: CoverageMetrics,
  thresholds: CoverageThresholds,
): ThresholdResult {
  const details: string[] = [];
  let met = true;

  if (
    thresholds.minPageCoverage !== undefined &&
    metrics.pageCoverage.percentage < thresholds.minPageCoverage
  ) {
    met = false;
    details.push(
      `Page coverage ${metrics.pageCoverage.percentage.toFixed(1)}% below ${String(thresholds.minPageCoverage)}% threshold`,
    );
  }

  if (
    thresholds.minElementCoverage !== undefined &&
    metrics.elementCoverage.percentage < thresholds.minElementCoverage
  ) {
    met = false;
    details.push(
      `Element coverage ${metrics.elementCoverage.percentage.toFixed(1)}% below ${String(thresholds.minElementCoverage)}% threshold`,
    );
  }

  if (
    thresholds.minPathCoverage !== undefined &&
    metrics.pathCoverage.percentage < thresholds.minPathCoverage
  ) {
    met = false;
    details.push(
      `Path coverage ${metrics.pathCoverage.percentage.toFixed(1)}% below ${String(thresholds.minPathCoverage)}% threshold`,
    );
  }

  return { met, details };
}
```

**Step 4: Create barrel — `packages/discovery/src/coverage/index.ts`**

```typescript
export { calculateCoverage, checkThresholds } from './coverage-calculator.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/coverage.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/discovery/src/coverage/ packages/discovery/src/__tests__/coverage.test.ts
git commit -m "feat(discovery): add coverage tracking with threshold checks"
```

---

### Task 6: SPA Readiness (Story 5.6)

> **Layer 2** — can run in parallel with Tasks 5 and 7.

**Files:**

- Create: `packages/discovery/src/spa/page-readiness.ts`
- Create: `packages/discovery/src/spa/index.ts`
- Create: `packages/discovery/src/__tests__/spa.test.ts`

**Context:** This module uses `BrowserEngine` from `@sentinel/browser`. Tests mock the engine. The `evaluate()` method is used to check DOM stability by comparing content length across polling intervals.

**Step 1: Write failing tests — `packages/discovery/src/__tests__/spa.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitForPageReady, detectSpaNavigation } from '../spa/index.js';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';

function createMockEngine(evaluateResults: unknown[]): BrowserEngine {
  let callIndex = 0;
  return {
    evaluate: vi.fn(async () => {
      const result = evaluateResults[callIndex];
      if (callIndex < evaluateResults.length - 1) callIndex++;
      return result;
    }),
    currentUrl: vi.fn(() => 'https://example.com'),
    navigate: vi.fn(async () => undefined),
    launch: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    createContext: vi.fn(),
    createPage: vi.fn(),
    closePage: vi.fn(),
    closeContext: vi.fn(),
    reload: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    selectOption: vi.fn(),
    waitForSelector: vi.fn(),
    screenshot: vi.fn(),
    startVideoRecording: vi.fn(),
    stopVideoRecording: vi.fn(),
    onRequest: vi.fn(),
    onResponse: vi.fn(),
    removeInterceptors: vi.fn(),
    exportHar: vi.fn(),
    browserType: vi.fn(() => 'chromium'),
    browserVersion: vi.fn(),
  } as unknown as BrowserEngine;
}

const testPage = 'page-1' as PageHandle;

describe('spa readiness', () => {
  describe('waitForPageReady', () => {
    it('resolves when DOM content length stabilizes', async () => {
      // Returns same length 3 times → stable
      const engine = createMockEngine([100, 100, 100]);

      await expect(
        waitForPageReady(engine, testPage, {
          stabilityTimeout: 2000,
          networkIdleTimeout: 150,
          pollInterval: 50,
        }),
      ).resolves.toBeUndefined();

      expect(engine.evaluate).toHaveBeenCalled();
    });

    it('waits for DOM to stop changing before resolving', async () => {
      // Content changes then stabilizes
      const engine = createMockEngine([100, 200, 300, 300, 300]);

      await expect(
        waitForPageReady(engine, testPage, {
          stabilityTimeout: 2000,
          networkIdleTimeout: 150,
          pollInterval: 50,
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves after stabilityTimeout even if DOM keeps changing', async () => {
      // Content keeps changing — should resolve when timeout hit
      let counter = 0;
      const engine = createMockEngine([]);
      vi.mocked(engine.evaluate).mockImplementation(async () => ++counter);

      await expect(
        waitForPageReady(engine, testPage, {
          stabilityTimeout: 200,
          networkIdleTimeout: 100,
          pollInterval: 30,
        }),
      ).resolves.toBeUndefined();
    });

    it('uses default options when none provided', async () => {
      const engine = createMockEngine([100, 100, 100, 100, 100, 100, 100]);

      // Should not throw
      await expect(waitForPageReady(engine, testPage)).resolves.toBeUndefined();
    }, 10000);
  });

  describe('detectSpaNavigation', () => {
    it('detects URL change after action', async () => {
      let url = 'https://example.com/page1';
      const engine = createMockEngine([100, 100, 100]);
      vi.mocked(engine.currentUrl).mockImplementation(() => url);

      const result = await detectSpaNavigation(
        engine,
        testPage,
        async () => {
          url = 'https://example.com/page2';
        },
        { stabilityTimeout: 200, networkIdleTimeout: 50, pollInterval: 30 },
      );

      expect(result.navigated).toBe(true);
      expect(result.newUrl).toBe('https://example.com/page2');
    });

    it('reports no navigation when URL stays the same', async () => {
      const engine = createMockEngine([100, 100, 100]);
      vi.mocked(engine.currentUrl).mockReturnValue('https://example.com/page1');

      const result = await detectSpaNavigation(
        engine,
        testPage,
        async () => {
          /* no-op */
        },
        { stabilityTimeout: 200, networkIdleTimeout: 50, pollInterval: 30 },
      );

      expect(result.navigated).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/spa.test.ts`
Expected: FAIL

**Step 3: Implement `packages/discovery/src/spa/page-readiness.ts`**

```typescript
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { SpaReadinessOptions } from '../types.js';

const DEFAULT_OPTIONS: SpaReadinessOptions = {
  stabilityTimeout: 5000,
  networkIdleTimeout: 500,
  pollInterval: 100,
};

/**
 * Wait for a page to become "ready" by polling DOM content length.
 * Resolves once the content length hasn't changed for `networkIdleTimeout` ms,
 * or when `stabilityTimeout` is reached (whichever comes first).
 */
export async function waitForPageReady(
  engine: BrowserEngine,
  page: PageHandle,
  options?: Partial<SpaReadinessOptions>,
): Promise<void> {
  const opts: SpaReadinessOptions = {
    stabilityTimeout: options?.stabilityTimeout ?? DEFAULT_OPTIONS.stabilityTimeout,
    networkIdleTimeout: options?.networkIdleTimeout ?? DEFAULT_OPTIONS.networkIdleTimeout,
    pollInterval: options?.pollInterval ?? DEFAULT_OPTIONS.pollInterval,
  };

  const deadline = Date.now() + opts.stabilityTimeout;
  let lastContentLength = -1;
  let stableStartTime = 0;

  while (Date.now() < deadline) {
    const contentLength = await engine.evaluate<number>(
      page,
      '(() => document.body ? document.body.innerHTML.length : 0)()',
    );

    if (contentLength === lastContentLength) {
      if (stableStartTime === 0) stableStartTime = Date.now();
      if (Date.now() - stableStartTime >= opts.networkIdleTimeout) return;
    } else {
      lastContentLength = contentLength;
      stableStartTime = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, opts.pollInterval));
  }
}

/**
 * Execute an action and detect whether it caused a SPA navigation
 * by comparing the URL before and after.
 */
export async function detectSpaNavigation(
  engine: BrowserEngine,
  page: PageHandle,
  action: () => Promise<void>,
  readinessOptions?: Partial<SpaReadinessOptions>,
): Promise<{ readonly navigated: boolean; readonly newUrl: string }> {
  const urlBefore = engine.currentUrl(page);
  await action();
  await waitForPageReady(engine, page, readinessOptions);
  const urlAfter = engine.currentUrl(page);
  return { navigated: urlBefore !== urlAfter, newUrl: urlAfter };
}
```

**Step 4: Create barrel — `packages/discovery/src/spa/index.ts`**

```typescript
export { waitForPageReady, detectSpaNavigation } from './page-readiness.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/spa.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/discovery/src/spa/ packages/discovery/src/__tests__/spa.test.ts
git commit -m "feat(discovery): add SPA readiness detection"
```

---

### Task 7: Journey Identification (Story 5.4)

> **Layer 2** — can run in parallel with Tasks 5 and 6.

**Files:**

- Create: `packages/discovery/src/journey/journey-detector.ts`
- Create: `packages/discovery/src/journey/index.ts`
- Create: `packages/discovery/src/__tests__/journey.test.ts`

**Context:** This module depends on the graph module's `getNode` and `getEdgesFrom` functions. It uses heuristics to classify sequences of edges as authentication flows, form submissions, or content navigation.

**Step 1: Write failing tests — `packages/discovery/src/__tests__/journey.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { identifyJourneys, classifyJourneyType, generateJourneyName } from '../journey/index.js';
import { createGraph, addNode, addEdge } from '../graph/index.js';
import type { AppNode, AppEdge, AppGraph } from '../types.js';

function makeNode(overrides: Partial<AppNode> & { id: string }): AppNode {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    elementCount: 5,
    discoveryTimestamp: 1000,
    domHash: 'abc123',
    screenshotPath: null,
    ...overrides,
  };
}

function makeEdge(overrides: Partial<AppEdge> & { sourceId: string; targetId: string }): AppEdge {
  return {
    actionType: 'navigation',
    selector: 'a[href]',
    httpStatus: null,
    ...overrides,
  };
}

function buildGraph(nodes: AppNode[], edges: AppEdge[]): AppGraph {
  let graph = createGraph('https://example.com');
  for (const node of nodes) graph = addNode(graph, node);
  for (const edge of edges) graph = addEdge(graph, edge);
  return graph;
}

describe('journey-detector', () => {
  describe('identifyJourneys', () => {
    it('identifies authentication journey (login → dashboard)', () => {
      const graph = buildGraph(
        [
          makeNode({ id: 'n1', url: 'https://example.com/login', title: 'Login' }),
          makeNode({ id: 'n2', url: 'https://example.com/dashboard', title: 'Dashboard' }),
        ],
        [makeEdge({ sourceId: 'n1', targetId: 'n2', actionType: 'form-submit' })],
      );

      const journeys = identifyJourneys(graph);
      const authJourneys = journeys.filter((j) => j.type === 'authentication');

      expect(authJourneys.length).toBeGreaterThanOrEqual(1);
      expect(authJourneys[0]?.entryNodeId).toBe('n1');
      expect(authJourneys[0]?.exitNodeId).toBe('n2');
    });

    it('identifies form submission journey (non-login form)', () => {
      const graph = buildGraph(
        [
          makeNode({ id: 'n1', url: 'https://example.com/contact', title: 'Contact Us' }),
          makeNode({ id: 'n2', url: 'https://example.com/thank-you', title: 'Thank You' }),
        ],
        [makeEdge({ sourceId: 'n1', targetId: 'n2', actionType: 'form-submit' })],
      );

      const journeys = identifyJourneys(graph);
      const formJourneys = journeys.filter((j) => j.type === 'form-submission');

      expect(formJourneys.length).toBeGreaterThanOrEqual(1);
    });

    it('identifies content navigation journey (3+ sequential page links)', () => {
      const graph = buildGraph(
        [
          makeNode({ id: 'n1', url: 'https://example.com/blog', title: 'Blog' }),
          makeNode({ id: 'n2', url: 'https://example.com/blog/page2', title: 'Blog Page 2' }),
          makeNode({ id: 'n3', url: 'https://example.com/blog/page3', title: 'Blog Page 3' }),
        ],
        [
          makeEdge({ sourceId: 'n1', targetId: 'n2', actionType: 'navigation' }),
          makeEdge({ sourceId: 'n2', targetId: 'n3', actionType: 'navigation' }),
        ],
      );

      const journeys = identifyJourneys(graph);
      const contentJourneys = journeys.filter((j) => j.type === 'content-navigation');

      expect(contentJourneys.length).toBeGreaterThanOrEqual(1);
      expect(contentJourneys[0]?.steps.length).toBe(2);
    });

    it('returns empty array for graph with no recognizable journeys', () => {
      const graph = buildGraph(
        [makeNode({ id: 'n1', url: 'https://example.com', title: 'Home' })],
        [],
      );

      const journeys = identifyJourneys(graph);
      expect(journeys).toEqual([]);
    });
  });

  describe('classifyJourneyType', () => {
    it('classifies auth flow when source is login page with form-submit', () => {
      const graph = buildGraph(
        [
          makeNode({ id: 'n1', url: 'https://example.com/login', title: 'Login' }),
          makeNode({ id: 'n2', url: 'https://example.com/home', title: 'Home' }),
        ],
        [],
      );
      const steps = [makeEdge({ sourceId: 'n1', targetId: 'n2', actionType: 'form-submit' })];

      expect(classifyJourneyType(steps, graph)).toBe('authentication');
    });

    it('classifies form submission when form-submit edge from non-login page', () => {
      const graph = buildGraph(
        [
          makeNode({ id: 'n1', url: 'https://example.com/survey', title: 'Survey' }),
          makeNode({ id: 'n2', url: 'https://example.com/results', title: 'Results' }),
        ],
        [],
      );
      const steps = [makeEdge({ sourceId: 'n1', targetId: 'n2', actionType: 'form-submit' })];

      expect(classifyJourneyType(steps, graph)).toBe('form-submission');
    });

    it('classifies content navigation for all-navigation edges', () => {
      const graph = buildGraph([], []);
      const steps = [
        makeEdge({ sourceId: 'n1', targetId: 'n2', actionType: 'navigation' }),
        makeEdge({ sourceId: 'n2', targetId: 'n3', actionType: 'navigation' }),
      ];

      expect(classifyJourneyType(steps, graph)).toBe('content-navigation');
    });

    it('returns custom for empty steps', () => {
      const graph = buildGraph([], []);
      expect(classifyJourneyType([], graph)).toBe('custom');
    });
  });

  describe('generateJourneyName', () => {
    it('creates descriptive name using type and node titles', () => {
      const entry = makeNode({ id: 'n1', title: 'Login' });
      const exit = makeNode({ id: 'n2', title: 'Dashboard' });

      const name = generateJourneyName('authentication', entry, exit);
      expect(name).toContain('Authentication');
      expect(name).toContain('Login');
      expect(name).toContain('Dashboard');
    });

    it('uses URL when title is empty', () => {
      const entry = makeNode({ id: 'n1', title: '', url: 'https://example.com/login' });
      const exit = makeNode({ id: 'n2', title: '', url: 'https://example.com/home' });

      const name = generateJourneyName('authentication', entry, exit);
      expect(name).toContain('https://example.com/login');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/journey.test.ts`
Expected: FAIL

**Step 3: Implement `packages/discovery/src/journey/journey-detector.ts`**

```typescript
import type { AppGraph, AppNode, AppEdge, UserJourney, JourneyType } from '../types.js';
import { getNode, getEdgesFrom } from '../graph/graph.js';

function isLoginPage(node: AppNode): boolean {
  const url = node.url.toLowerCase();
  const title = node.title.toLowerCase();
  return (
    url.includes('login') ||
    url.includes('signin') ||
    url.includes('sign-in') ||
    url.includes('/auth') ||
    title.includes('login') ||
    title.includes('sign in')
  );
}

function isFormSubmitEdge(edge: AppEdge): boolean {
  return edge.actionType === 'form-submit';
}

function findAuthenticationJourneys(graph: AppGraph): UserJourney[] {
  const journeys: UserJourney[] = [];

  for (const node of graph.nodes) {
    if (!isLoginPage(node)) continue;

    const edges = getEdgesFrom(graph, node.id);
    const formSubmits = edges.filter(isFormSubmitEdge);

    for (const edge of formSubmits) {
      const targetNode = getNode(graph, edge.targetId);
      if (targetNode && !isLoginPage(targetNode)) {
        journeys.push({
          id: `journey-auth-${String(journeys.length)}`,
          name: generateJourneyName('authentication', node, targetNode),
          type: 'authentication',
          steps: [edge],
          entryNodeId: node.id,
          exitNodeId: targetNode.id,
        });
      }
    }
  }

  return journeys;
}

function findFormSubmissionJourneys(graph: AppGraph): UserJourney[] {
  const journeys: UserJourney[] = [];

  for (const edge of graph.edges) {
    if (edge.actionType !== 'form-submit') continue;

    const sourceNode = getNode(graph, edge.sourceId);
    const targetNode = getNode(graph, edge.targetId);
    if (!sourceNode || !targetNode) continue;
    if (isLoginPage(sourceNode)) continue;

    journeys.push({
      id: `journey-form-${String(journeys.length)}`,
      name: generateJourneyName('form-submission', sourceNode, targetNode),
      type: 'form-submission',
      steps: [edge],
      entryNodeId: sourceNode.id,
      exitNodeId: targetNode.id,
    });
  }

  return journeys;
}

function findContentNavigationJourneys(graph: AppGraph): UserJourney[] {
  const journeys: UserJourney[] = [];
  const visited = new Set<string>();

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;

    const path: AppEdge[] = [];
    let current = node.id;

    while (true) {
      const navEdges = getEdgesFrom(graph, current).filter((e) => e.actionType === 'navigation');
      if (navEdges.length !== 1) break;

      const edge = navEdges[0]!;
      if (visited.has(edge.targetId)) break;

      path.push(edge);
      visited.add(current);
      current = edge.targetId;
    }

    if (path.length >= 2) {
      const entryNode = node;
      const exitId = path[path.length - 1]!.targetId;
      const exitNode = getNode(graph, exitId);

      journeys.push({
        id: `journey-content-${String(journeys.length)}`,
        name: generateJourneyName('content-navigation', entryNode, exitNode ?? entryNode),
        type: 'content-navigation',
        steps: path,
        entryNodeId: entryNode.id,
        exitNodeId: exitId,
      });
    }
  }

  return journeys;
}

export function identifyJourneys(graph: AppGraph): readonly UserJourney[] {
  return [
    ...findAuthenticationJourneys(graph),
    ...findFormSubmissionJourneys(graph),
    ...findContentNavigationJourneys(graph),
  ];
}

export function classifyJourneyType(steps: readonly AppEdge[], graph: AppGraph): JourneyType {
  if (steps.length === 0) return 'custom';

  const firstEdge = steps[0]!;
  const sourceNode = getNode(graph, firstEdge.sourceId);

  if (sourceNode && isLoginPage(sourceNode) && isFormSubmitEdge(firstEdge)) {
    return 'authentication';
  }

  if (steps.some(isFormSubmitEdge)) {
    return 'form-submission';
  }

  if (steps.every((e) => e.actionType === 'navigation')) {
    return 'content-navigation';
  }

  return 'custom';
}

export function generateJourneyName(
  type: JourneyType,
  entryNode: AppNode,
  exitNode: AppNode,
): string {
  const entry = entryNode.title || entryNode.url;
  const exit = exitNode.title || exitNode.url;

  const labels: Record<JourneyType, string> = {
    authentication: 'Authentication',
    'form-submission': 'Form Submission',
    'content-navigation': 'Content Navigation',
    custom: 'Custom Journey',
  };

  return `${labels[type]}: ${entry} \u2192 ${exit}`;
}
```

**Step 4: Create barrel — `packages/discovery/src/journey/index.ts`**

```typescript
export { identifyJourneys, classifyJourneyType, generateJourneyName } from './journey-detector.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/journey.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/discovery/src/journey/ packages/discovery/src/__tests__/journey.test.ts
git commit -m "feat(discovery): add user journey identification"
```

---

### Task 8: Crawler Orchestrator (Story 5.1)

> **Layer 3** — requires all Layer 1 and Layer 2 modules merged first.

**Files:**

- Create: `packages/discovery/src/crawler/explorer.ts`
- Create: `packages/discovery/src/crawler/index.ts`
- Create: `packages/discovery/src/__tests__/crawler.test.ts`

**Context:** The crawler orchestrates all other modules. It uses `BrowserEngine` for navigation, `@sentinel/analysis` for DOM extraction/classification, and all discovery modules for graph building, cycle detection, scope filtering, coverage tracking, SPA readiness, and journey identification.

Tests mock both `BrowserEngine` and `@sentinel/analysis` functions at the module level.

**Step 1: Write failing tests — `packages/discovery/src/__tests__/crawler.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { DomNode, InteractiveElement, FormModel } from '@sentinel/analysis';
import type { ExplorationConfig, ScopeConfig, CycleConfig } from '../types.js';

// Mock @sentinel/analysis at module level
vi.mock('@sentinel/analysis', () => ({
  extractDom: vi.fn(),
  classifyInteractiveElements: vi.fn(),
  detectForms: vi.fn(),
  hashDomContent: vi.fn(),
}));

import {
  extractDom,
  classifyInteractiveElements,
  detectForms,
  hashDomContent,
} from '@sentinel/analysis';
import {
  explore,
  serializeExplorationState,
  deserializeExplorationState,
} from '../crawler/index.js';

const testPage = 'page-1' as PageHandle;

const defaultScope: ScopeConfig = {
  allowPatterns: [],
  denyPatterns: [],
  allowExternalDomains: false,
  excludeQueryPatterns: [],
};

const defaultCycleConfig: CycleConfig = {
  parameterizedUrlLimit: 5,
  infiniteScrollThreshold: 10,
};

function makeConfig(overrides?: Partial<ExplorationConfig>): ExplorationConfig {
  return {
    startUrl: 'https://example.com',
    maxPages: 10,
    timeoutMs: 30000,
    strategy: 'breadth-first',
    scope: defaultScope,
    cycleConfig: defaultCycleConfig,
    ...overrides,
  };
}

const simpleDom: DomNode = {
  tag: 'body',
  id: null,
  classes: [],
  attributes: {},
  textContent: 'Hello',
  children: [],
  boundingBox: { x: 0, y: 0, width: 800, height: 600 },
  isVisible: true,
  xpath: '/html/body',
  cssSelector: 'body',
};

function createMockEngine(pages: Record<string, string>): BrowserEngine {
  let currentPage = '';
  return {
    navigate: vi.fn(async (_page: PageHandle, url: string) => {
      currentPage = url;
    }),
    currentUrl: vi.fn(() => currentPage),
    evaluate: vi.fn(async () => 100),
    launch: vi.fn(),
    close: vi.fn(),
    createContext: vi.fn(),
    createPage: vi.fn(),
    closePage: vi.fn(),
    closeContext: vi.fn(),
    reload: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    selectOption: vi.fn(),
    waitForSelector: vi.fn(),
    screenshot: vi.fn(),
    startVideoRecording: vi.fn(),
    stopVideoRecording: vi.fn(),
    onRequest: vi.fn(),
    onResponse: vi.fn(),
    removeInterceptors: vi.fn(),
    exportHar: vi.fn(),
    browserType: vi.fn(() => 'chromium'),
    browserVersion: vi.fn(),
  } as unknown as BrowserEngine;
}

describe('crawler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: extractDom returns simpleDom
    vi.mocked(extractDom).mockResolvedValue(simpleDom);
    vi.mocked(classifyInteractiveElements).mockReturnValue([]);
    vi.mocked(detectForms).mockReturnValue([]);
    vi.mocked(hashDomContent).mockReturnValue('hash-default');
  });

  describe('explore', () => {
    it('visits start URL and creates initial node', async () => {
      const engine = createMockEngine({ 'https://example.com': 'Home' });
      // Return page title
      vi.mocked(engine.evaluate)
        .mockResolvedValueOnce(100) // waitForPageReady poll 1
        .mockResolvedValueOnce(100) // waitForPageReady poll 2
        .mockResolvedValueOnce('Home'); // document.title

      const result = await explore(engine, testPage, makeConfig({ maxPages: 1 }));

      expect(result.graph.nodes).toHaveLength(1);
      expect(result.graph.nodes[0]?.url).toBe('https://example.com');
      expect(engine.navigate).toHaveBeenCalledWith(testPage, 'https://example.com');
    });

    it('follows links breadth-first', async () => {
      const engine = createMockEngine({});
      let callCount = 0;

      // Provide links on first page
      vi.mocked(classifyInteractiveElements).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return [
            {
              node: { ...simpleDom, attributes: { href: '/about' }, cssSelector: 'a.about' },
              category: 'navigation-link',
              isDisabled: false,
              accessibilityInfo: null,
            },
          ] as unknown as InteractiveElement[];
        }
        return [];
      });

      // Different hash per page to avoid cycle detection
      let hashCount = 0;
      vi.mocked(hashDomContent).mockImplementation(() => `hash-${String(++hashCount)}`);

      const result = await explore(engine, testPage, makeConfig({ maxPages: 5 }));

      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('respects maxPages limit', async () => {
      const engine = createMockEngine({});

      // Every page has a link to another page
      let pageNum = 0;
      vi.mocked(classifyInteractiveElements).mockImplementation(() => {
        pageNum++;
        return [
          {
            node: {
              ...simpleDom,
              attributes: { href: `/page${String(pageNum)}` },
              cssSelector: `a.page${String(pageNum)}`,
            },
            category: 'navigation-link',
            isDisabled: false,
            accessibilityInfo: null,
          },
        ] as unknown as InteractiveElement[];
      });

      let hashCount = 0;
      vi.mocked(hashDomContent).mockImplementation(() => `hash-${String(++hashCount)}`);

      const result = await explore(engine, testPage, makeConfig({ maxPages: 3 }));
      expect(result.graph.nodes.length).toBeLessThanOrEqual(3);
    });

    it('calls progress callback after each page', async () => {
      const engine = createMockEngine({});
      const onProgress = vi.fn();

      let hashCount = 0;
      vi.mocked(hashDomContent).mockImplementation(() => `hash-${String(++hashCount)}`);

      await explore(engine, testPage, makeConfig({ maxPages: 1 }), { onProgress });

      expect(onProgress).toHaveBeenCalled();
      const progress = onProgress.mock.calls[0]?.[0];
      expect(progress).toHaveProperty('pagesVisited');
      expect(progress).toHaveProperty('elapsedMs');
    });

    it('skips out-of-scope URLs', async () => {
      const engine = createMockEngine({});

      vi.mocked(classifyInteractiveElements).mockReturnValueOnce([
        {
          node: {
            ...simpleDom,
            attributes: { href: 'https://external.com/page' },
            cssSelector: 'a.ext',
          },
          category: 'navigation-link',
          isDisabled: false,
          accessibilityInfo: null,
        },
      ] as unknown as InteractiveElement[]);

      let hashCount = 0;
      vi.mocked(hashDomContent).mockImplementation(() => `hash-${String(++hashCount)}`);

      const result = await explore(engine, testPage, makeConfig({ maxPages: 5 }));

      // Should only have the start page — external link was filtered
      expect(result.graph.nodes).toHaveLength(1);
    });

    it('returns coverage metrics in result', async () => {
      const engine = createMockEngine({});

      const result = await explore(engine, testPage, makeConfig({ maxPages: 1 }));

      expect(result.coverage).toHaveProperty('pageCoverage');
      expect(result.coverage).toHaveProperty('elementCoverage');
      expect(result.coverage).toHaveProperty('pathCoverage');
    });

    it('returns cycle report in result', async () => {
      const engine = createMockEngine({});

      const result = await explore(engine, testPage, makeConfig({ maxPages: 1 }));

      expect(result.cycleReport).toHaveProperty('entries');
      expect(result.cycleReport).toHaveProperty('totalCyclesDetected');
    });

    it('returns journeys in result', async () => {
      const engine = createMockEngine({});

      const result = await explore(engine, testPage, makeConfig({ maxPages: 1 }));

      expect(Array.isArray(result.journeys)).toBe(true);
    });
  });

  describe('serializeExplorationState / deserializeExplorationState', () => {
    it('roundtrips exploration state through JSON', () => {
      const state = {
        queue: ['https://example.com/a', 'https://example.com/b'],
        visitedFingerprints: ['fp1', 'fp2'],
        graph: {
          nodes: [],
          edges: [],
          metadata: { startUrl: 'https://example.com', startedAt: 1000, completedAt: null },
        },
        activatedElementIds: ['el-1'],
        totalElementsFound: 10,
        startedAt: 1000,
      };

      const json = serializeExplorationState(state);
      const restored = deserializeExplorationState(json);

      expect(restored.queue).toEqual(state.queue);
      expect(restored.visitedFingerprints).toEqual(state.visitedFingerprints);
      expect(restored.startedAt).toBe(state.startedAt);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/crawler.test.ts`
Expected: FAIL

**Step 3: Implement `packages/discovery/src/crawler/explorer.ts`**

```typescript
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import {
  extractDom,
  classifyInteractiveElements,
  detectForms,
  hashDomContent,
} from '@sentinel/analysis';
import type {
  ExplorationConfig,
  ExplorationProgress,
  ExplorationResult,
  ExplorationState,
  ProgressCallback,
  AppNode,
  CycleEntry,
} from '../types.js';
import { createGraph, addNode, addEdge, completeGraph } from '../graph/graph.js';
import { normalizeUrl } from '../cycle/url-normalizer.js';
import {
  computeFingerprint,
  fingerprintKey,
  detectCycle,
  createCycleReport,
} from '../cycle/cycle-detector.js';
import { isUrlAllowed } from '../scope/scope-filter.js';
import { calculateCoverage, checkThresholds } from '../coverage/coverage-calculator.js';
import { waitForPageReady } from '../spa/page-readiness.js';
import { identifyJourneys } from '../journey/journey-detector.js';

export async function explore(
  engine: BrowserEngine,
  page: PageHandle,
  config: ExplorationConfig,
  callbacks?: { readonly onProgress?: ProgressCallback },
): Promise<ExplorationResult> {
  let graph = createGraph(config.startUrl);
  const visited = new Set<string>();
  const paramUrlCounts = new Map<string, number>();
  const queue: string[] = [config.startUrl];
  const cycleEntries: CycleEntry[] = [];
  const activatedElementIds = new Set<string>();
  let totalElementsFound = 0;
  const startTime = Date.now();
  const baseDomain = new URL(config.startUrl).hostname;

  while (queue.length > 0) {
    if (graph.nodes.length >= config.maxPages) break;
    if (Date.now() - startTime >= config.timeoutMs) break;

    const url = config.strategy === 'breadth-first' ? queue.shift()! : queue.pop()!;

    const scopeDecision = isUrlAllowed(url, config.scope, baseDomain);
    if (!scopeDecision.allowed) continue;

    try {
      await engine.navigate(page, url);
    } catch {
      continue;
    }

    await waitForPageReady(engine, page, config.spaOptions);

    const currentUrl = engine.currentUrl(page);

    let dom;
    try {
      dom = await extractDom(engine, page);
    } catch {
      continue;
    }

    const domHash = hashDomContent(dom);
    const normalized = normalizeUrl(currentUrl);
    const fp = computeFingerprint(normalized, domHash);
    const cycleDecision = detectCycle(fp, visited, paramUrlCounts, config.cycleConfig);

    if (cycleDecision.isCycle) {
      if (cycleDecision.entry) cycleEntries.push(cycleDecision.entry);
      continue;
    }

    visited.add(fingerprintKey(fp));
    paramUrlCounts.set(normalized, (paramUrlCounts.get(normalized) ?? 0) + 1);

    const elements = classifyInteractiveElements(dom);
    detectForms(dom);
    totalElementsFound += elements.length;

    let title = '';
    try {
      title = await engine.evaluate<string>(page, '(() => document.title)()');
    } catch {
      // title stays empty
    }

    const node: AppNode = {
      id: `node-${String(graph.nodes.length)}`,
      url: currentUrl,
      title,
      elementCount: elements.length,
      discoveryTimestamp: Date.now(),
      domHash,
      screenshotPath: null,
    };
    graph = addNode(graph, node);

    // Extract links and queue them
    for (const el of elements) {
      if (el.category === 'navigation-link') {
        const href = el.node.attributes['href'];
        if (href) {
          try {
            const fullUrl = new URL(href, currentUrl).href;
            const linkScope = isUrlAllowed(fullUrl, config.scope, baseDomain);
            if (linkScope.allowed) {
              queue.push(fullUrl);
              graph = addEdge(graph, {
                sourceId: node.id,
                targetId: '',
                actionType: 'navigation',
                selector: el.node.cssSelector,
                httpStatus: null,
              });
            }
          } catch {
            // Skip invalid URLs
          }
        }
      }
    }

    callbacks?.onProgress?.({
      pagesDiscovered: graph.nodes.length + queue.length,
      pagesVisited: graph.nodes.length,
      pagesRemaining: queue.length,
      elementsActivated: activatedElementIds.size,
      elapsedMs: Date.now() - startTime,
    });

    if (config.coverageThresholds) {
      const coverage = calculateCoverage(
        graph.nodes.length,
        graph.nodes.length + queue.length,
        activatedElementIds.size,
        totalElementsFound,
        graph.edges.length,
        graph.edges.length,
      );
      if (checkThresholds(coverage, config.coverageThresholds).met) break;
    }
  }

  const finalCoverage = calculateCoverage(
    graph.nodes.length,
    graph.nodes.length + queue.length,
    activatedElementIds.size,
    totalElementsFound,
    graph.edges.length,
    graph.edges.length,
  );

  return {
    graph: completeGraph(graph),
    coverage: finalCoverage,
    journeys: identifyJourneys(graph),
    cycleReport: createCycleReport(cycleEntries),
  };
}

export function serializeExplorationState(state: ExplorationState): string {
  return JSON.stringify(state);
}

export function deserializeExplorationState(json: string): ExplorationState {
  return JSON.parse(json) as ExplorationState;
}
```

**Step 4: Create barrel — `packages/discovery/src/crawler/index.ts`**

```typescript
export { explore, serializeExplorationState, deserializeExplorationState } from './explorer.js';
```

**Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/discovery/src/__tests__/crawler.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/discovery/src/crawler/ packages/discovery/src/__tests__/crawler.test.ts
git commit -m "feat(discovery): add crawler orchestrator with exploration loop"
```

---

### Task 9: Integration — Public API + Config + CLAUDE.md

**Files:**

- Modify: `packages/discovery/src/index.ts` (wire up all barrel exports)
- Modify: `CLAUDE.md` (add `@sentinel/discovery` to directory structure)

**Step 1: Update `packages/discovery/src/index.ts` with all exports**

```typescript
/**
 * @sentinel/discovery
 *
 * Autonomous web application exploration engine for the Sentinel QA platform.
 * Provides graph-based app modeling, cycle detection, scope enforcement,
 * coverage tracking, SPA readiness detection, user journey identification,
 * and a crawler orchestrator.
 */

export type {
  ActionType,
  AppNode,
  AppEdge,
  GraphMetadata,
  AppGraph,
  StateFingerprint,
  CycleReason,
  CycleEntry,
  CycleReport,
  CycleConfig,
  CycleDecision,
  ScopeConfig,
  ScopeDecision,
  CoverageRatio,
  CoverageMetrics,
  CoverageThresholds,
  ThresholdResult,
  SpaReadinessOptions,
  JourneyType,
  UserJourney,
  ExplorationStrategy,
  ExplorationConfig,
  ExplorationProgress,
  ExplorationResult,
  ExplorationState,
  ProgressCallback,
} from './types.js';

// Graph
export {
  createGraph,
  addNode,
  addEdge,
  getNode,
  getEdgesFrom,
  findPaths,
  completeGraph,
  serializeGraph,
  deserializeGraph,
} from './graph/index.js';

// Cycle detection
export {
  normalizeUrl,
  computeFingerprint,
  fingerprintKey,
  detectCycle,
  createCycleReport,
} from './cycle/index.js';

// Scope enforcement
export { isUrlAllowed, validateScopeConfig } from './scope/index.js';

// Coverage tracking
export { calculateCoverage, checkThresholds } from './coverage/index.js';

// SPA readiness
export { waitForPageReady, detectSpaNavigation } from './spa/index.js';

// Journey identification
export { identifyJourneys, classifyJourneyType, generateJourneyName } from './journey/index.js';

// Crawler
export {
  explore,
  serializeExplorationState,
  deserializeExplorationState,
} from './crawler/index.js';
```

**Step 2: Update `CLAUDE.md`**

Add to the annotated directory structure under `packages/`, after the `analysis/` section:

```markdown
│ ├── discovery/ # @sentinel/discovery — autonomous web exploration engine (depends on shared + browser + analysis)
│ │ └── src/
│ │ ├── index.ts # Public API: types, graph, cycle, scope, coverage, spa, journey, crawler
│ │ ├── types.ts # All discovery domain types: AppGraph, ExplorationConfig, CoverageMetrics, etc.
│ │ ├── graph/
│ │ │ ├── graph.ts # createGraph, addNode, addEdge, findPaths, serialize/deserialize
│ │ │ └── index.ts # Barrel re-export for graph/
│ │ ├── cycle/
│ │ │ ├── url-normalizer.ts # normalizeUrl() — strip tracking params, sort query, lowercase
│ │ │ ├── cycle-detector.ts # computeFingerprint, detectCycle, createCycleReport
│ │ │ └── index.ts # Barrel re-export for cycle/
│ │ ├── scope/
│ │ │ ├── scope-filter.ts # isUrlAllowed, validateScopeConfig — URL boundary enforcement
│ │ │ └── index.ts # Barrel re-export for scope/
│ │ ├── coverage/
│ │ │ ├── coverage-calculator.ts # calculateCoverage, checkThresholds
│ │ │ └── index.ts # Barrel re-export for coverage/
│ │ ├── spa/
│ │ │ ├── page-readiness.ts # waitForPageReady, detectSpaNavigation — DOM stability polling
│ │ │ └── index.ts # Barrel re-export for spa/
│ │ ├── journey/
│ │ │ ├── journey-detector.ts # identifyJourneys, classifyJourneyType, generateJourneyName
│ │ │ └── index.ts # Barrel re-export for journey/
│ │ ├── crawler/
│ │ │ ├── explorer.ts # explore() — main orchestrator, serializeExplorationState, deserialize
│ │ │ └── index.ts # Barrel re-export for crawler/
│ │ └── **tests**/
│ │ ├── graph.test.ts # Graph module unit tests
│ │ ├── cycle.test.ts # Cycle detection unit tests
│ │ ├── scope.test.ts # Scope enforcement unit tests
│ │ ├── coverage.test.ts # Coverage tracking unit tests
│ │ ├── spa.test.ts # SPA readiness unit tests (mocked BrowserEngine)
│ │ ├── journey.test.ts # Journey identification unit tests
│ │ └── crawler.test.ts # Crawler orchestrator unit tests (mocked BrowserEngine + analysis)
```

**Step 3: Run full typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Run full test suite for discovery package**

Run: `pnpm exec vitest run packages/discovery/src`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/discovery/src/index.ts CLAUDE.md
git commit -m "feat(discovery): wire up public API and update CLAUDE.md"
```
