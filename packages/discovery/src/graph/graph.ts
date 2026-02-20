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
    const path = queue.shift();
    if (path === undefined) break;
    const current = path[path.length - 1];
    if (current === undefined) continue;

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
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('nodes' in parsed) ||
    !('edges' in parsed) ||
    !('metadata' in parsed)
  ) {
    throw new Error('Invalid graph JSON: missing required fields (nodes, edges, metadata)');
  }
  return parsed as AppGraph;
}
