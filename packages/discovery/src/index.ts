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
  SpaNavigationResult,
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
