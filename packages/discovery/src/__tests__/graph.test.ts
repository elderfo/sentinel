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
