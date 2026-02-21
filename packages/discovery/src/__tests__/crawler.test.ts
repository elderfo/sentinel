import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { DomNode, InteractiveElement } from '@sentinel/analysis';
import type { ExplorationConfig, ScopeConfig, CycleConfig } from '../types.js';

// Mock @sentinel/analysis at module level
vi.mock('@sentinel/analysis', () => ({
  extractDom: vi.fn(),
  classifyInteractiveElements: vi.fn(),
  detectForms: vi.fn(),
  hashDomContent: vi.fn(),
}));

import {
  extractDom,
  classifyInteractiveElements,
  detectForms,
  hashDomContent,
} from '@sentinel/analysis';
import {
  explore,
  serializeExplorationState,
  deserializeExplorationState,
} from '../crawler/index.js';

const testPage = 'page-1' as PageHandle;

const defaultScope: ScopeConfig = {
  allowPatterns: [],
  denyPatterns: [],
  allowExternalDomains: false,
  excludeQueryPatterns: [],
};

const defaultCycleConfig: CycleConfig = {
  parameterizedUrlLimit: 5,
  infiniteScrollThreshold: 10,
};

function makeConfig(overrides?: Partial<ExplorationConfig>): ExplorationConfig {
  return {
    startUrl: 'https://example.com',
    maxPages: 10,
    timeoutMs: 30000,
    strategy: 'breadth-first',
    scope: defaultScope,
    cycleConfig: defaultCycleConfig,
    ...overrides,
  };
}

const simpleDom: DomNode = {
  tag: 'body',
  id: null,
  classes: [],
  attributes: {},
  textContent: 'Hello',
  children: [],
  boundingBox: { x: 0, y: 0, width: 800, height: 600 },
  isVisible: true,
  xpath: '/html/body',
  cssSelector: 'body',
};

interface MockEngine {
  engine: BrowserEngine;
  navigateFn: ReturnType<typeof vi.fn>;
  evaluateFn: ReturnType<typeof vi.fn>;
  currentUrlFn: ReturnType<typeof vi.fn>;
}

function createMockEngine(): MockEngine {
  let currentPage = '';
  const navigateFn = vi.fn((_page: PageHandle, url: string) => {
    currentPage = url;
    return Promise.resolve();
  });
  const currentUrlFn = vi.fn(() => currentPage);
  const evaluateFn = vi.fn(() => Promise.resolve(100));

  const engine = {
    navigate: navigateFn,
    currentUrl: currentUrlFn,
    evaluate: evaluateFn,
    launch: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createContext: vi.fn(() => Promise.resolve('ctx-1')),
    createPage: vi.fn(() => Promise.resolve('page-1')),
    closePage: vi.fn(() => Promise.resolve()),
    closeContext: vi.fn(() => Promise.resolve()),
    reload: vi.fn(() => Promise.resolve()),
    goBack: vi.fn(() => Promise.resolve()),
    goForward: vi.fn(() => Promise.resolve()),
    click: vi.fn(() => Promise.resolve()),
    type: vi.fn(() => Promise.resolve()),
    selectOption: vi.fn(() => Promise.resolve()),
    waitForSelector: vi.fn(() => Promise.resolve()),
    screenshot: vi.fn(() => Promise.resolve(Buffer.from(''))),
    startVideoRecording: vi.fn(() => Promise.resolve()),
    stopVideoRecording: vi.fn(() => Promise.resolve('')),
    onRequest: vi.fn(() => Promise.resolve()),
    onResponse: vi.fn(() => Promise.resolve()),
    removeInterceptors: vi.fn(() => Promise.resolve()),
    exportHar: vi.fn(() =>
      Promise.resolve({
        log: {
          version: '1.2',
          creator: { name: 'test', version: '0.0.0' },
          entries: [],
        },
      }),
    ),
    browserType: vi.fn(() => 'chromium' as const),
    browserVersion: vi.fn(() => Promise.resolve('1.0.0')),
  } as unknown as BrowserEngine;

  return { engine, navigateFn, evaluateFn, currentUrlFn };
}

describe('crawler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(extractDom).mockResolvedValue(simpleDom);
    vi.mocked(classifyInteractiveElements).mockReturnValue([]);
    vi.mocked(detectForms).mockReturnValue([]);
    vi.mocked(hashDomContent).mockReturnValue('hash-default');
  });

  describe('explore', () => {
    it('visits start URL and creates initial node', async () => {
      const { engine, evaluateFn, navigateFn } = createMockEngine();
      evaluateFn
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce('Home');

      const result = await explore(engine, testPage, makeConfig({ maxPages: 1 }));

      expect(result.graph.nodes).toHaveLength(1);
      expect(result.graph.nodes[0]?.url).toBe('https://example.com');
      expect(navigateFn).toHaveBeenCalledWith(testPage, 'https://example.com');
    });

    it('follows links breadth-first', async () => {
      const { engine } = createMockEngine();
      let callCount = 0;

      vi.mocked(classifyInteractiveElements).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return [
            {
              node: { ...simpleDom, attributes: { href: '/about' }, cssSelector: 'a.about' },
              category: 'navigation-link',
              isDisabled: false,
              accessibilityInfo: null,
            },
          ] as unknown as InteractiveElement[];
        }
        return [];
      });

      let hashCount = 0;
      vi.mocked(hashDomContent).mockImplementation(() => `hash-${String(++hashCount)}`);

      const result = await explore(engine, testPage, makeConfig({ maxPages: 5 }));

      expect(result.graph.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('respects maxPages limit', async () => {
      const { engine } = createMockEngine();

      let pageNum = 0;
      vi.mocked(classifyInteractiveElements).mockImplementation(() => {
        pageNum++;
        return [
          {
            node: {
              ...simpleDom,
              attributes: { href: `/page${String(pageNum)}` },
              cssSelector: `a.page${String(pageNum)}`,
            },
            category: 'navigation-link',
            isDisabled: false,
            accessibilityInfo: null,
          },
        ] as unknown as InteractiveElement[];
      });

      let hashCount = 0;
      vi.mocked(hashDomContent).mockImplementation(() => `hash-${String(++hashCount)}`);

      const result = await explore(engine, testPage, makeConfig({ maxPages: 3 }));
      expect(result.graph.nodes.length).toBeLessThanOrEqual(3);
    });

    it('calls progress callback after each page', async () => {
      const { engine } = createMockEngine();
      const onProgress = vi.fn();

      let hashCount = 0;
      vi.mocked(hashDomContent).mockImplementation(() => `hash-${String(++hashCount)}`);

      await explore(engine, testPage, makeConfig({ maxPages: 1 }), { onProgress });

      expect(onProgress).toHaveBeenCalled();
      const progress = onProgress.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(progress).toHaveProperty('pagesVisited');
      expect(progress).toHaveProperty('elapsedMs');
    });

    it('skips out-of-scope URLs', async () => {
      const { engine } = createMockEngine();

      vi.mocked(classifyInteractiveElements).mockReturnValueOnce([
        {
          node: {
            ...simpleDom,
            attributes: { href: 'https://external.com/page' },
            cssSelector: 'a.ext',
          },
          category: 'navigation-link',
          isDisabled: false,
          accessibilityInfo: null,
        },
      ] as unknown as InteractiveElement[]);

      let hashCount = 0;
      vi.mocked(hashDomContent).mockImplementation(() => `hash-${String(++hashCount)}`);

      const result = await explore(engine, testPage, makeConfig({ maxPages: 5 }));

      expect(result.graph.nodes).toHaveLength(1);
    });

    it('returns coverage metrics in result', async () => {
      const { engine } = createMockEngine();

      const result = await explore(engine, testPage, makeConfig({ maxPages: 1 }));

      expect(result.coverage).toHaveProperty('pageCoverage');
      expect(result.coverage).toHaveProperty('elementCoverage');
      expect(result.coverage).toHaveProperty('pathCoverage');
    });

    it('returns cycle report in result', async () => {
      const { engine } = createMockEngine();

      const result = await explore(engine, testPage, makeConfig({ maxPages: 1 }));

      expect(result.cycleReport).toHaveProperty('entries');
      expect(result.cycleReport).toHaveProperty('totalCyclesDetected');
    });

    it('returns journeys in result', async () => {
      const { engine } = createMockEngine();

      const result = await explore(engine, testPage, makeConfig({ maxPages: 1 }));

      expect(Array.isArray(result.journeys)).toBe(true);
    });
  });

  describe('serializeExplorationState / deserializeExplorationState', () => {
    it('roundtrips exploration state through JSON', () => {
      const state = {
        queue: ['https://example.com/a', 'https://example.com/b'],
        visitedFingerprints: ['fp1', 'fp2'],
        graph: {
          nodes: [],
          edges: [],
          metadata: { startUrl: 'https://example.com', startedAt: 1000, completedAt: null },
        },
        activatedElementIds: ['el-1'],
        totalElementsFound: 10,
        startedAt: 1000,
      };

      const json = serializeExplorationState(state);
      const restored = deserializeExplorationState(json);

      expect(restored.queue).toEqual(state.queue);
      expect(restored.visitedFingerprints).toEqual(state.visitedFingerprints);
      expect(restored.startedAt).toBe(state.startedAt);
    });
  });
});
