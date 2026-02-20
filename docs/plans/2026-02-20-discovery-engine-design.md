# Discovery Engine Design

**Goal:** Build the autonomous exploration engine that navigates web applications, discovers pages, builds a navigation graph, identifies user journeys, and tracks coverage — without human guidance.

**Architecture:** Pure + adapters pattern (same as `@sentinel/analysis`). Pure functions for graph, cycle detection, journeys, and coverage. Thin browser adapters for crawling and SPA readiness. A simple progress callback for real-time reporting.

**Tech Stack:** TypeScript strict mode, `@sentinel/browser` for browser interaction, `@sentinel/analysis` for DOM parsing/classification/state tracking.

---

## Package Structure

New package: `@sentinel/discovery` — depends on `@sentinel/analysis`, `@sentinel/browser`, and `@sentinel/shared`.

```
packages/discovery/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts          # Public API barrel
    ├── types.ts          # All discovery domain types
    ├── graph/            # App graph model + path queries
    ├── crawler/          # Exploration queue + orchestrator
    ├── cycle/            # Cycle detection + URL normalization
    ├── journey/          # User journey identification
    ├── coverage/         # Coverage metrics calculation
    ├── spa/              # SPA readiness detection
    ├── scope/            # URL boundary enforcement
    └── __tests__/        # All test files
```

## Core Types

### Graph Model (Story 5.2)

- `AppNode` — id, url, title, elementCount, discoveryTimestamp, domHash, screenshotPath
- `AppEdge` — sourceId, targetId, actionType (`'click' | 'form-submit' | 'navigation'`), selector, httpStatus
- `AppGraph` — nodes, edges, metadata (startUrl, startedAt, completedAt)

### Crawler (Story 5.1)

- `ExplorationConfig` — startUrl, maxPages, timeoutMs, strategy (`'breadth-first' | 'depth-first'`), scope rules, coverageThresholds
- `ExplorationProgress` — pagesDiscovered, pagesVisited, pagesRemaining, elementsActivated, elapsedMs
- `ExplorationResult` — graph, coverage, journeys, cycleReport
- `ExplorationState` — serializable snapshot for pause/resume: queue, visitedFingerprints, graph-so-far
- `ProgressCallback` — `(progress: ExplorationProgress) => void`

### Cycle Detection (Story 5.3)

- `StateFingerprint` — normalizedUrl + domHash
- `CycleReport` — entries array of { url, reason (`'duplicate-state' | 'parameterized-url-limit' | 'infinite-scroll'`), count }

### Journey (Story 5.4)

- `JourneyType` — `'authentication' | 'form-submission' | 'content-navigation' | 'custom'`
- `UserJourney` — id, name, type, steps (array of AppEdge references), entryNodeId, exitNodeId

### Coverage (Story 5.5)

- `CoverageMetrics` — pageCoverage (explored/total), elementCoverage (activated/total), pathCoverage (executed/total)
- `CoverageThresholds` — optional min percentages that halt exploration when met

### Scope (Story 5.7)

- `ScopeConfig` — allowPatterns, denyPatterns, allowExternalDomains, excludeQueryPatterns
- `ScopeDecision` — { allowed: boolean, reason: string }

All types use `readonly` fields following existing project conventions.

## Data Flow

```
ExplorationConfig + BrowserEngine
        │
        ▼
    crawler/explorer.ts  (orchestrator)
        │
        ├── scope/    → filter URLs before queueing
        ├── spa/      → wait for page readiness after navigation
        ├── cycle/    → check fingerprint before exploring a page
        ├── analysis  → extractDom, classifyElements, detectForms (from @sentinel/analysis)
        ├── graph/    → add nodes/edges as pages are discovered
        ├── coverage/ → recalculate metrics after each page
        └── journey/  → run detection after exploration completes
```

### Per-Page Loop

1. Dequeue next URL from exploration queue
2. **Scope check** — `isUrlAllowed(url, scopeConfig)` → skip if denied, log reason
3. **Navigate** — `engine.navigate(page, url)`
4. **SPA readiness** — `waitForPageReady(engine, page, stabilityTimeout)` — waits for network idle + DOM stability
5. **Fingerprint** — compute `StateFingerprint` using URL + `hashDomContent()` from `@sentinel/analysis`
6. **Cycle check** — `detectCycle(fingerprint, visitedSet, config)` → skip if duplicate
7. **Analyze page** — `extractDom`, `classifyInteractiveElements`, `detectForms` from `@sentinel/analysis`
8. **Add to graph** — create `AppNode`, extract links/buttons as `AppEdge` candidates
9. **Queue new URLs** — discovered links that pass scope check get queued
10. **Interact with elements** — click buttons, submit forms with representative values, record resulting transitions as edges
11. **Update coverage** — `calculateCoverage(graph, activatedElements)`
12. **Report progress** — call `progressCallback`
13. **Check stop conditions** — maxPages reached? timeout? coverage threshold met?

### Post-Exploration

- `identifyJourneys(graph)` — pure function analyzes the completed graph
- Return `ExplorationResult` with graph, coverage, journeys, cycleReport

### Pause/Resume

The orchestrator serializes `ExplorationState` (queue + visited set + graph-so-far) to JSON. Resume loads that state and continues the loop.

## Story-to-Module Mapping & Parallelization

### Layer 1 — Foundation (no cross-dependencies, all parallel)

- **Story 5.2** (`graph/`) — AppGraph with addNode, addEdge, findPaths, serialize/deserialize
- **Story 5.3** (`cycle/`) — computeFingerprint, detectCycle, normalizeUrl, infinite scroll detection
- **Story 5.7** (`scope/`) — createScopeFilter, isUrlAllowed, validateScopeConfig

### Layer 2 — Depends on Layer 1

- **Story 5.5** (`coverage/`) — calculateCoverage, checkThresholds (depends on graph types)
- **Story 5.6** (`spa/`) — waitForPageReady, interceptSpaNavigation (browser adapter)
- **Story 5.4** (`journey/`) — identifyJourneys, classifyJourneyType, generateJourneyName (depends on graph)

### Layer 3 — Integrates everything

- **Story 5.1** (`crawler/`) — The orchestrator wiring all modules together

### Worktree Strategy

- 3 parallel worktrees for Layer 1: graph, cycle, scope
- 2-3 parallel worktrees for Layer 2: coverage, spa, journey
- 1 worktree for Layer 3: crawler

## Testing Strategy

**Pure function modules** (graph, cycle, scope, coverage, journey): direct unit tests with constructed data.

**Browser adapter modules** (spa, crawler): mock `BrowserEngine` interface.

| Story        | Key test cases                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------- |
| 5.2 Graph    | addNode/addEdge, findPaths BFS, serialize/deserialize roundtrip, load+extend                    |
| 5.3 Cycle    | duplicate fingerprint, parameterized URL collapse, infinite scroll threshold, cycle report      |
| 5.4 Journey  | auth flow detection, form submission flow, content nav flow, journey naming                     |
| 5.5 Coverage | page/element/path percentages, threshold halt, JSON report                                      |
| 5.6 SPA      | network idle, history pushState, hash change, stability timeout                                 |
| 5.7 Scope    | allow/deny patterns, external domain exclusion, query param filter, config validation           |
| 5.1 Crawler  | full loop with mock app, pause/resume roundtrip, maxPages stop, timeout stop, progress callback |

All tests in `src/__tests__/` following `*.test.ts` convention. 80% coverage threshold.
