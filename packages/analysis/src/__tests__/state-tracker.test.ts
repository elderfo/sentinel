import { describe, it, expect } from 'vitest';
import { StateTracker, hashDomContent } from '../state/index.js';
import type { DomNode } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(tag: string, xpath: string, overrides?: Partial<DomNode>): DomNode {
  return {
    tag,
    id: null,
    classes: [],
    attributes: {},
    textContent: '',
    children: [],
    boundingBox: null,
    isVisible: true,
    xpath,
    cssSelector: tag,
    ...overrides,
  };
}

const BASE_URL = 'https://example.com';
const rootA = makeNode('div', '/div', { textContent: 'page A' });
const rootB = makeNode('div', '/div', { textContent: 'page B' });

// ---------------------------------------------------------------------------
// hashDomContent
// ---------------------------------------------------------------------------

describe('hashDomContent', () => {
  it('produces a hex string', () => {
    const hash = hashDomContent(rootA);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for identical trees', () => {
    const copy = makeNode('div', '/div', { textContent: 'page A' });
    expect(hashDomContent(rootA)).toBe(hashDomContent(copy));
  });

  it('returns different hashes for different content', () => {
    expect(hashDomContent(rootA)).not.toBe(hashDomContent(rootB));
  });
});

// ---------------------------------------------------------------------------
// StateTracker
// ---------------------------------------------------------------------------

describe('StateTracker', () => {
  it('records an initial state', () => {
    const tracker = new StateTracker();
    tracker.recordState(BASE_URL, rootA, []);

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(1);
    expect(graph.transitions).toHaveLength(0);
    expect(graph.states[0]?.url).toBe(BASE_URL);
    expect(graph.states[0]?.id).toBe('state-0');
  });

  it('records a transition on URL change', () => {
    const tracker = new StateTracker();
    tracker.recordState(BASE_URL, rootA, []);
    tracker.recordState('https://example.com/page2', rootA, [], 'click-link');

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(2);
    expect(graph.transitions).toHaveLength(1);
    expect(graph.transitions[0]?.action).toBe('click-link');
    expect(graph.transitions[0]?.preState.url).toBe(BASE_URL);
    expect(graph.transitions[0]?.postState.url).toBe('https://example.com/page2');
  });

  it('records a transition on significant DOM change', () => {
    const tracker = new StateTracker();
    tracker.recordState(BASE_URL, rootA, []);
    tracker.recordState(BASE_URL, rootB, []);

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(2);
    expect(graph.transitions).toHaveLength(1);
    expect(graph.transitions[0]?.domDiff).not.toBeNull();
  });

  it('does not record a transition for an identical state', () => {
    const tracker = new StateTracker();
    tracker.recordState(BASE_URL, rootA, []);
    tracker.recordState(BASE_URL, rootA, []);

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(1);
    expect(graph.transitions).toHaveLength(0);
  });

  it('tracks a modal as a nested state layer', () => {
    const tracker = new StateTracker();
    tracker.recordState(BASE_URL, rootA, []);
    tracker.recordState(BASE_URL, rootA, ['confirm-dialog'], 'open-modal');

    const graph = tracker.exportGraph();
    expect(graph.states).toHaveLength(2);
    expect(graph.states[1]?.modalIndicators).toEqual(['confirm-dialog']);
    expect(graph.transitions[0]?.action).toBe('open-modal');
  });

  it('exports a JSON-serializable graph object', () => {
    const tracker = new StateTracker();
    tracker.recordState(BASE_URL, rootA, []);
    tracker.recordState('https://example.com/next', rootB, [], 'navigate');

    const graph = tracker.exportGraph();
    // If this round-trips without error the object is JSON-serializable
    const json = JSON.stringify(graph);
    const parsed = JSON.parse(json) as { states: unknown[]; transitions: unknown[] };
    expect(Array.isArray(parsed.states)).toBe(true);
    expect(Array.isArray(parsed.transitions)).toBe(true);
  });

  it('uses "navigate" as default action when none is supplied', () => {
    const tracker = new StateTracker();
    tracker.recordState(BASE_URL, rootA, []);
    tracker.recordState('https://example.com/about', rootB, []);

    const graph = tracker.exportGraph();
    expect(graph.transitions[0]?.action).toBe('navigate');
  });

  it('records the dom diff in the transition', () => {
    const tracker = new StateTracker();
    tracker.recordState(BASE_URL, rootA, []);
    tracker.recordState(BASE_URL, rootB, [], 'form-submit');

    const graph = tracker.exportGraph();
    const transition = graph.transitions[0];
    expect(transition?.domDiff).not.toBeNull();
    // rootA has textContent 'page A', rootB has 'page B' — expect a text modification
    expect(transition?.domDiff?.modified).toHaveLength(1);
    expect(transition?.domDiff?.modified[0]?.changes[0]?.type).toBe('text');
  });
});
