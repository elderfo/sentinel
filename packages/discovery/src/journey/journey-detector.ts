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

function followNavigationChain(graph: AppGraph, startId: string, visited: Set<string>): AppEdge[] {
  const path: AppEdge[] = [];
  let current = startId;

  let nextEdge = getSingleNavigationEdge(graph, current, visited);
  while (nextEdge !== undefined) {
    path.push(nextEdge);
    visited.add(current);
    current = nextEdge.targetId;
    nextEdge = getSingleNavigationEdge(graph, current, visited);
  }

  return path;
}

function getSingleNavigationEdge(
  graph: AppGraph,
  nodeId: string,
  visited: Set<string>,
): AppEdge | undefined {
  const navEdges = getEdgesFrom(graph, nodeId).filter((e) => e.actionType === 'navigation');
  if (navEdges.length !== 1) return undefined;

  const edge = navEdges[0];
  if (edge === undefined || visited.has(edge.targetId)) return undefined;

  return edge;
}

function findContentNavigationJourneys(graph: AppGraph): UserJourney[] {
  const journeys: UserJourney[] = [];
  const visited = new Set<string>();

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;

    const path = followNavigationChain(graph, node.id, visited);

    if (path.length >= 2) {
      const entryNode = node;
      const lastEdge = path[path.length - 1];
      if (lastEdge === undefined) continue;
      const exitId = lastEdge.targetId;
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

  const firstEdge = steps[0];
  if (firstEdge === undefined) return 'custom';
  const sourceNode = getNode(graph, firstEdge.sourceId);

  if (sourceNode && isLoginPage(sourceNode) && isFormSubmitEdge(firstEdge)) {
    const targetNode = getNode(graph, firstEdge.targetId);
    if (!targetNode || !isLoginPage(targetNode)) {
      return 'authentication';
    }
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
