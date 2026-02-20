import { describe, it, expect, vi } from 'vitest';
import { waitForPageReady, detectSpaNavigation } from '../spa/index.js';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';

interface MockEngine {
  engine: BrowserEngine;
  evaluateFn: ReturnType<typeof vi.fn>;
  currentUrlFn: ReturnType<typeof vi.fn>;
}

function createMockEngine(evaluateResults: unknown[]): MockEngine {
  let callIndex = 0;
  const evaluateFn = vi.fn(() => {
    const result = evaluateResults[callIndex];
    if (callIndex < evaluateResults.length - 1) callIndex++;
    return result;
  });
  const currentUrlFn = vi.fn(() => 'https://example.com');

  const engine = {
    evaluate: evaluateFn,
    currentUrl: currentUrlFn,
    navigate: vi.fn(() => Promise.resolve(undefined)),
    launch: vi.fn(() => Promise.resolve(undefined)),
    close: vi.fn(() => Promise.resolve(undefined)),
    createContext: vi.fn(),
    createPage: vi.fn(),
    closePage: vi.fn(),
    closeContext: vi.fn(),
    reload: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    selectOption: vi.fn(),
    waitForSelector: vi.fn(),
    screenshot: vi.fn(),
    startVideoRecording: vi.fn(),
    stopVideoRecording: vi.fn(),
    onRequest: vi.fn(),
    onResponse: vi.fn(),
    removeInterceptors: vi.fn(),
    exportHar: vi.fn(),
    browserType: vi.fn(() => 'chromium'),
    browserVersion: vi.fn(),
  } as unknown as BrowserEngine;

  return { engine, evaluateFn, currentUrlFn };
}

const testPage = 'page-1' as PageHandle;

describe('spa readiness', () => {
  describe('waitForPageReady', () => {
    it('resolves when DOM content length stabilizes', async () => {
      const { engine, evaluateFn } = createMockEngine([100, 100, 100]);

      await expect(
        waitForPageReady(engine, testPage, {
          stabilityTimeout: 2000,
          networkIdleTimeout: 150,
          pollInterval: 50,
        }),
      ).resolves.toBeUndefined();

      expect(evaluateFn).toHaveBeenCalled();
    });

    it('waits for DOM to stop changing before resolving', async () => {
      const { engine } = createMockEngine([100, 200, 300, 300, 300]);

      await expect(
        waitForPageReady(engine, testPage, {
          stabilityTimeout: 2000,
          networkIdleTimeout: 150,
          pollInterval: 50,
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves after stabilityTimeout even if DOM keeps changing', async () => {
      let counter = 0;
      const { engine, evaluateFn } = createMockEngine([]);
      evaluateFn.mockImplementation(() => ++counter);

      await expect(
        waitForPageReady(engine, testPage, {
          stabilityTimeout: 200,
          networkIdleTimeout: 100,
          pollInterval: 30,
        }),
      ).resolves.toBeUndefined();
    });

    it('uses default options when none provided', async () => {
      const { engine } = createMockEngine([100, 100, 100, 100, 100, 100, 100]);

      await expect(waitForPageReady(engine, testPage)).resolves.toBeUndefined();
    }, 10000);
  });

  describe('detectSpaNavigation', () => {
    it('detects URL change after action', async () => {
      let url = 'https://example.com/page1';
      const { engine, currentUrlFn } = createMockEngine([100, 100, 100]);
      currentUrlFn.mockImplementation(() => url);

      const result = await detectSpaNavigation(
        engine,
        testPage,
        () => {
          url = 'https://example.com/page2';
          return Promise.resolve();
        },
        { stabilityTimeout: 200, networkIdleTimeout: 50, pollInterval: 30 },
      );

      expect(result.navigated).toBe(true);
      expect(result.newUrl).toBe('https://example.com/page2');
    });

    it('reports no navigation when URL stays the same', async () => {
      const { engine, currentUrlFn } = createMockEngine([100, 100, 100]);
      currentUrlFn.mockReturnValue('https://example.com/page1');

      const result = await detectSpaNavigation(engine, testPage, () => Promise.resolve(), {
        stabilityTimeout: 200,
        networkIdleTimeout: 50,
        pollInterval: 30,
      });

      expect(result.navigated).toBe(false);
    });
  });
});
