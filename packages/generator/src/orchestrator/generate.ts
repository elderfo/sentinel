import type { ExplorationResult } from '@sentinel/discovery';
import type { StateTransitionGraph, FormModel, StabilizedElement } from '@sentinel/analysis';
import type {
  GeneratorConfig,
  AiProvider,
  GenerationResult,
  GeneratorError,
  TestManifest,
  GenerationStats,
  EdgeCaseContext,
  TestCase,
} from '../types.js';
import { validateConfig } from '../config/index.js';
import { planTestCases } from '../planner/index.js';
import { generateTestData } from '../data/index.js';
import { generateAssertions } from '../assertions/index.js';
import { generateEdgeCases } from '../ai/edge-case-generator.js';
import { groupIntoSuites } from '../emitter/suite-organizer.js';
import { PlaywrightTsEmitter } from '../emitter/playwright-ts.js';
import { JsonEmitter } from '../emitter/json-emitter.js';

export async function generate(
  explorationResult: ExplorationResult,
  stateGraph: StateTransitionGraph,
  forms: readonly FormModel[],
  stabilizedElements: readonly StabilizedElement[],
  config: GeneratorConfig,
  aiProvider?: AiProvider,
): Promise<GenerationResult | GeneratorError> {
  // 1. Validate config
  const configError = validateConfig(config);
  if (configError !== null) return configError;

  // 2. Check for journeys
  if (explorationResult.journeys.length === 0) {
    return { code: 'EMPTY_EXPLORATION', message: 'Exploration produced no user journeys' };
  }

  // 3. Plan -- journeys to test case outlines
  let testCases: readonly TestCase[] = planTestCases(explorationResult, stateGraph, forms, config);

  // 4. Generate data -- fill form steps with valid/invalid data
  testCases = generateTestData(testCases, forms, config);

  // 5. Generate assertions -- DomDiff to assertions on each step
  testCases = generateAssertions(testCases, stateGraph, stabilizedElements, config);

  // 6. Generate edge cases (optional, non-fatal)
  if (aiProvider !== undefined) {
    const context = buildEdgeCaseContext(explorationResult, testCases);
    testCases = await generateEdgeCases(testCases, context, aiProvider, config);
  }

  // 7. Organize into suites
  const suites = groupIntoSuites(testCases);

  // 8. Emit
  const emitter = config.outputFormat === 'json' ? new JsonEmitter() : new PlaywrightTsEmitter();
  const files = await emitter.emit(suites);

  // 9. Build manifest
  const manifest: TestManifest = {
    generatedAt: Date.now(),
    files: files.map((f) => {
      const matchingSuites = suites.filter((s) => s.fileName === f.fileName);
      return {
        fileName: f.fileName,
        journeyIds: [
          ...new Set(matchingSuites.flatMap((s) => s.testCases.map((tc) => tc.journeyId))),
        ],
        testCount: matchingSuites.reduce((sum, s) => sum + s.testCases.length, 0),
        checksum: f.checksum,
      };
    }),
  };

  // 10. Compute stats
  const stats: GenerationStats = {
    totalTests: testCases.length,
    happyPathTests: testCases.filter((tc) => tc.type === 'happy-path').length,
    errorPathTests: testCases.filter((tc) => tc.type === 'error-path').length,
    edgeCaseTests: testCases.filter((tc) => tc.type === 'edge-case').length,
    totalAssertions: testCases.reduce(
      (sum, tc) => sum + tc.steps.reduce((s, step) => s + step.assertions.length, 0),
      0,
    ),
    lowConfidenceAssertions: testCases.reduce(
      (sum, tc) =>
        sum +
        tc.steps.reduce(
          (s, step) => s + step.assertions.filter((a) => a.confidence < 0.5).length,
          0,
        ),
      0,
    ),
  };

  return { suites, manifest, stats };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildEdgeCaseContext(
  explorationResult: ExplorationResult,
  testCases: readonly TestCase[],
): EdgeCaseContext {
  const firstNode = explorationResult.graph.nodes[0];
  return {
    pageTitle: firstNode?.title ?? 'Unknown Page',
    interactiveElements: [],
    formConstraints: [],
    observedBehaviors: explorationResult.journeys.map((j) => j.name),
    existingTestNames: testCases.map((tc) => tc.name),
  };
}
