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
