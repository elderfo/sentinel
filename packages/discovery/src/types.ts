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

export interface SpaNavigationResult {
  readonly navigated: boolean;
  readonly newUrl: string;
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
