import type { ExplorationResult, UserJourney, AppEdge } from '@sentinel/discovery';
import type { StateTransitionGraph, FormModel } from '@sentinel/analysis';
import type { TestCase, TestStep, GeneratorConfig } from '../types.js';

export function planTestCases(
  result: ExplorationResult,
  // These parameters are reserved for future enhancement (stability analysis,
  // form-aware setup steps, config-driven depth). Keeping them in the public
  // API now so callers wire them through from the start.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _stateGraph: StateTransitionGraph,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _forms: readonly FormModel[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: GeneratorConfig,
): readonly TestCase[] {
  return result.journeys.map((journey) => journeyToTestCase(journey, result));
}

function journeyToTestCase(journey: UserJourney, result: ExplorationResult): TestCase {
  const startUrl = result.graph.metadata.startUrl;
  const entryNode = result.graph.nodes.find((n) => n.id === journey.entryNodeId);

  const setupSteps: readonly TestStep[] = buildSetupSteps(entryNode, startUrl);

  const steps: readonly TestStep[] = journey.steps.map((edge) => edgeToStep(edge));

  return {
    id: `test-${journey.id}`,
    name: journey.name,
    type: 'happy-path',
    journeyId: journey.id,
    suite: deriveSuiteName(journey, result),
    setupSteps,
    steps,
    teardownSteps: [],
    tags: [],
  };
}

function buildSetupSteps(
  entryNode: ExplorationResult['graph']['nodes'][number] | undefined,
  startUrl: string,
): readonly TestStep[] {
  if (entryNode === undefined || entryNode.url === startUrl) {
    return [];
  }
  return [
    {
      action: 'navigation' as const,
      selector: entryNode.url,
      selectorStrategy: 'css' as const,
      description: `Navigate to ${entryNode.url}`,
      assertions: [],
    },
  ];
}

function edgeToStep(edge: AppEdge): TestStep {
  return {
    action: edge.actionType,
    selector: edge.selector,
    selectorStrategy: 'css',
    description: `${edge.actionType} on ${edge.selector}`,
    assertions: [],
  };
}

function deriveSuiteName(journey: UserJourney, result: ExplorationResult): string {
  if (journey.type === 'authentication') return 'auth';

  const entryNode = result.graph.nodes.find((n) => n.id === journey.entryNodeId);
  const title = entryNode?.title ?? journey.type;
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
