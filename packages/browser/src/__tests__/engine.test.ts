import { describe, it, expect, vi } from 'vitest';
import type { Browser, BrowserContext, Page, Video } from 'playwright';
import { PlaywrightBrowserEngine } from '../playwright/engine.js';
import type { BrowserContextHandle, PageHandle } from '../types.js';

// ---------------------------------------------------------------------------
// Mock factories
// Each factory returns both the typed object AND the underlying vi.fn() refs
// so tests can assert on them without triggering @typescript-eslint/unbound-method.
// ---------------------------------------------------------------------------

interface MockVideo {
  video: Video;
  pathFn: ReturnType<typeof vi.fn>;
}

function makeMockVideo(path = '/tmp/video.webm'): MockVideo {
  const pathFn = vi.fn().mockResolvedValue(path);
  const video: Video = {
    path: pathFn,
    saveAs: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as Video;
  return { video, pathFn };
}

interface MockPage {
  page: Page;
  gotoFn: ReturnType<typeof vi.fn>;
  reloadFn: ReturnType<typeof vi.fn>;
  goBackFn: ReturnType<typeof vi.fn>;
  goForwardFn: ReturnType<typeof vi.fn>;
  urlFn: ReturnType<typeof vi.fn>;
  clickFn: ReturnType<typeof vi.fn>;
  fillFn: ReturnType<typeof vi.fn>;
  selectOptionFn: ReturnType<typeof vi.fn>;
  waitForSelectorFn: ReturnType<typeof vi.fn>;
  evaluateFn: ReturnType<typeof vi.fn>;
  screenshotFn: ReturnType<typeof vi.fn>;
  closeFn: ReturnType<typeof vi.fn>;
  videoFn: ReturnType<typeof vi.fn>;
}

function makeMockPage(url = 'https://example.com'): MockPage {
  const gotoFn = vi.fn().mockResolvedValue(null);
  const reloadFn = vi.fn().mockResolvedValue(null);
  const goBackFn = vi.fn().mockResolvedValue(null);
  const goForwardFn = vi.fn().mockResolvedValue(null);
  const urlFn = vi.fn().mockReturnValue(url);
  const clickFn = vi.fn().mockResolvedValue(undefined);
  const fillFn = vi.fn().mockResolvedValue(undefined);
  const selectOptionFn = vi.fn().mockResolvedValue([]);
  const waitForSelectorFn = vi.fn().mockResolvedValue(null);
  const evaluateFn = vi.fn().mockResolvedValue(42);
  const screenshotFn = vi.fn().mockResolvedValue(Buffer.from('png'));
  const closeFn = vi.fn().mockResolvedValue(undefined);
  const videoFn = vi.fn().mockReturnValue(null);

  const page: Page = {
    goto: gotoFn,
    reload: reloadFn,
    goBack: goBackFn,
    goForward: goForwardFn,
    url: urlFn,
    click: clickFn,
    fill: fillFn,
    selectOption: selectOptionFn,
    waitForSelector: waitForSelectorFn,
    evaluate: evaluateFn,
    screenshot: screenshotFn,
    close: closeFn,
    video: videoFn,
  } as unknown as Page;

  return {
    page,
    gotoFn,
    reloadFn,
    goBackFn,
    goForwardFn,
    urlFn,
    clickFn,
    fillFn,
    selectOptionFn,
    waitForSelectorFn,
    evaluateFn,
    screenshotFn,
    closeFn,
    videoFn,
  };
}

interface MockContext {
  context: BrowserContext;
  newPageFn: ReturnType<typeof vi.fn>;
  closeFn: ReturnType<typeof vi.fn>;
  routeFn: ReturnType<typeof vi.fn>;
  unrouteAllFn: ReturnType<typeof vi.fn>;
  onFn: ReturnType<typeof vi.fn>;
  pagesFn: ReturnType<typeof vi.fn>;
}

function makeMockContext(page: Page): MockContext {
  const newPageFn = vi.fn().mockResolvedValue(page);
  const closeFn = vi.fn().mockResolvedValue(undefined);
  const routeFn = vi.fn().mockResolvedValue(undefined);
  const unrouteAllFn = vi.fn().mockResolvedValue(undefined);
  const onFn = vi.fn();
  const pagesFn = vi.fn().mockReturnValue([page]);

  const context: BrowserContext = {
    newPage: newPageFn,
    close: closeFn,
    route: routeFn,
    unrouteAll: unrouteAllFn,
    on: onFn,
    pages: pagesFn,
  } as unknown as BrowserContext;

  return { context, newPageFn, closeFn, routeFn, unrouteAllFn, onFn, pagesFn };
}

interface MockBrowser {
  browser: Browser;
  newContextFn: ReturnType<typeof vi.fn>;
  closeFn: ReturnType<typeof vi.fn>;
  versionFn: ReturnType<typeof vi.fn>;
}

function makeMockBrowser(context: BrowserContext): MockBrowser {
  const newContextFn = vi.fn().mockResolvedValue(context);
  const closeFn = vi.fn().mockResolvedValue(undefined);
  const versionFn = vi.fn().mockReturnValue('120.0.0');

  const browser: Browser = {
    newContext: newContextFn,
    close: closeFn,
    version: versionFn,
  } as unknown as Browser;

  return { browser, newContextFn, closeFn, versionFn };
}

// ---------------------------------------------------------------------------
// Helpers — compose mocks into a launched engine in dependency order:
//   page -> context -> browser -> engine
// ---------------------------------------------------------------------------

async function launchedEngine(mockBrowser: MockBrowser): Promise<PlaywrightBrowserEngine> {
  const engine = new PlaywrightBrowserEngine({
    launchFn: vi.fn().mockResolvedValue(mockBrowser.browser),
  });
  await engine.launch({ browserType: 'chromium', headless: true });
  return engine;
}

async function engineWithContext(mockPage: MockPage): Promise<{
  engine: PlaywrightBrowserEngine;
  mockBrowser: MockBrowser;
  mockContext: MockContext;
  contextHandle: BrowserContextHandle;
}> {
  const mockContext = makeMockContext(mockPage.page);
  const mockBrowser = makeMockBrowser(mockContext.context);
  const engine = await launchedEngine(mockBrowser);
  const contextHandle = await engine.createContext();
  return { engine, mockBrowser, mockContext, contextHandle };
}

async function engineWithPage(pageUrl?: string): Promise<{
  engine: PlaywrightBrowserEngine;
  mockBrowser: MockBrowser;
  mockContext: MockContext;
  mockPage: MockPage;
  contextHandle: BrowserContextHandle;
  pageHandle: PageHandle;
}> {
  const mockPage = makeMockPage(pageUrl);
  const { engine, mockBrowser, mockContext, contextHandle } = await engineWithContext(mockPage);
  const pageHandle = await engine.createPage(contextHandle);
  return { engine, mockBrowser, mockContext, mockPage, contextHandle, pageHandle };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlaywrightBrowserEngine', () => {
  describe('Lifecycle', () => {
    it('launch creates browser via launchFn', async () => {
      const defaultPage = makeMockPage();
      const defaultContext = makeMockContext(defaultPage.page);
      const mockBrowser = makeMockBrowser(defaultContext.context);
      const launchFn = vi.fn().mockResolvedValue(mockBrowser.browser);
      const engine = new PlaywrightBrowserEngine({ launchFn });

      await engine.launch({ browserType: 'chromium', headless: true });

      expect(launchFn).toHaveBeenCalledOnce();
      expect(launchFn).toHaveBeenCalledWith({ headless: true });
    });

    it('launch passes headless: false when configured', async () => {
      const defaultPage = makeMockPage();
      const defaultContext = makeMockContext(defaultPage.page);
      const mockBrowser = makeMockBrowser(defaultContext.context);
      const launchFn = vi.fn().mockResolvedValue(mockBrowser.browser);
      const engine = new PlaywrightBrowserEngine({ launchFn });

      await engine.launch({ browserType: 'firefox', headless: false });

      expect(launchFn).toHaveBeenCalledWith({ headless: false });
    });

    it('close shuts down the browser', async () => {
      const defaultPage = makeMockPage();
      const defaultContext = makeMockContext(defaultPage.page);
      const mockBrowser = makeMockBrowser(defaultContext.context);
      const engine = await launchedEngine(mockBrowser);

      await engine.close();

      expect(mockBrowser.closeFn).toHaveBeenCalledOnce();
    });

    it('close before launch is a no-op', async () => {
      const engine = new PlaywrightBrowserEngine();

      await expect(engine.close()).resolves.toBeUndefined();
    });

    it('browserType returns the configured browser type', async () => {
      const defaultPage = makeMockPage();
      const defaultContext = makeMockContext(defaultPage.page);
      const mockBrowser = makeMockBrowser(defaultContext.context);
      const engine = new PlaywrightBrowserEngine({
        launchFn: vi.fn().mockResolvedValue(mockBrowser.browser),
      });
      await engine.launch({ browserType: 'firefox', headless: true });

      expect(engine.browserType()).toBe('firefox');
    });

    it('browserType defaults to chromium before launch', () => {
      const engine = new PlaywrightBrowserEngine();

      expect(engine.browserType()).toBe('chromium');
    });

    it('browserVersion returns version string from browser', async () => {
      const defaultPage = makeMockPage();
      const defaultContext = makeMockContext(defaultPage.page);
      const mockBrowser = makeMockBrowser(defaultContext.context);
      const engine = await launchedEngine(mockBrowser);
      mockBrowser.versionFn.mockReturnValue('120.0.5');

      const version = await engine.browserVersion();

      expect(version).toBe('120.0.5');
    });

    it('browserVersion throws when browser is not launched', async () => {
      const engine = new PlaywrightBrowserEngine();

      await expect(engine.browserVersion()).rejects.toThrow(
        'Browser is not launched. Call launch() first.',
      );
    });
  });

  describe('Context & page management', () => {
    it('createContext returns a handle', async () => {
      const { engine } = await engineWithPage();

      const handle = await engine.createContext();

      expect(typeof handle).toBe('string');
      expect(handle.length).toBeGreaterThan(0);
    });

    it('createContext passes options to Playwright', async () => {
      const { engine, mockBrowser } = await engineWithPage();

      await engine.createContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'TestAgent/1.0',
      });

      expect(mockBrowser.newContextFn).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { width: 1280, height: 720 },
          userAgent: 'TestAgent/1.0',
        }),
      );
    });

    it('createPage returns a handle', async () => {
      const { engine, contextHandle } = await engineWithPage();

      const pageHandle = await engine.createPage(contextHandle);

      expect(typeof pageHandle).toBe('string');
      expect(pageHandle.length).toBeGreaterThan(0);
    });

    it('closePage calls page.close()', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.closePage(pageHandle);

      expect(mockPage.closeFn).toHaveBeenCalledOnce();
    });

    it('closeContext calls context.close()', async () => {
      const { engine, mockContext, contextHandle } = await engineWithPage();

      await engine.closeContext(contextHandle);

      expect(mockContext.closeFn).toHaveBeenCalledOnce();
    });

    it('throws on invalid page handle', async () => {
      const { engine } = await engineWithPage();
      const badHandle = 'nonexistent-handle' as PageHandle;

      await expect(engine.closePage(badHandle)).rejects.toThrow(
        'No page found for handle: nonexistent-handle',
      );
    });

    it('throws on invalid context handle', async () => {
      const { engine } = await engineWithPage();
      const badHandle = 'nonexistent-handle' as BrowserContextHandle;

      await expect(engine.closeContext(badHandle)).rejects.toThrow(
        'No browser context found for handle: nonexistent-handle',
      );
    });

    it('throws creating page for invalid context handle', async () => {
      const { engine } = await engineWithPage();
      const badHandle = 'bad-context' as BrowserContextHandle;

      await expect(engine.createPage(badHandle)).rejects.toThrow(
        'No browser context found for handle: bad-context',
      );
    });
  });

  describe('Navigation', () => {
    it('navigate calls page.goto with the url', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.navigate(pageHandle, 'https://example.com');

      expect(mockPage.gotoFn).toHaveBeenCalledWith('https://example.com', {});
    });

    it('navigate passes timeout and waitUntil options', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.navigate(pageHandle, 'https://example.com', {
        timeout: 5000,
        waitUntil: 'networkidle',
      });

      expect(mockPage.gotoFn).toHaveBeenCalledWith('https://example.com', {
        timeout: 5000,
        waitUntil: 'networkidle',
      });
    });

    it('reload delegates to page.reload()', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.reload(pageHandle);

      expect(mockPage.reloadFn).toHaveBeenCalledOnce();
    });

    it('goBack delegates to page.goBack()', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.goBack(pageHandle);

      expect(mockPage.goBackFn).toHaveBeenCalledOnce();
    });

    it('goForward delegates to page.goForward()', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.goForward(pageHandle);

      expect(mockPage.goForwardFn).toHaveBeenCalledOnce();
    });

    it('currentUrl returns page.url()', async () => {
      const mockPageMocks = makeMockPage('https://current.example.com');
      const { engine, contextHandle } = await engineWithContext(mockPageMocks);
      const pgHandle = await engine.createPage(contextHandle);

      const url = engine.currentUrl(pgHandle);

      expect(url).toBe('https://current.example.com');
      expect(mockPageMocks.urlFn).toHaveBeenCalledOnce();
    });

    it('navigate throws for invalid page handle', async () => {
      const { engine } = await engineWithPage();
      const bad = 'no-page' as PageHandle;

      await expect(engine.navigate(bad, 'https://x.com')).rejects.toThrow(
        'No page found for handle: no-page',
      );
    });
  });

  describe('Interaction', () => {
    it('click delegates to page.click', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.click(pageHandle, '#btn');

      expect(mockPage.clickFn).toHaveBeenCalledWith('#btn', {});
    });

    it('click passes options to page.click', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.click(pageHandle, '#btn', { timeout: 3000, clickCount: 2, button: 'right' });

      expect(mockPage.clickFn).toHaveBeenCalledWith('#btn', {
        timeout: 3000,
        clickCount: 2,
        button: 'right',
      });
    });

    it('type delegates to page.fill', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.type(pageHandle, '#input', 'hello');

      expect(mockPage.fillFn).toHaveBeenCalledWith('#input', 'hello', {});
    });

    it('type passes timeout option to page.fill', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.type(pageHandle, '#input', 'hello', { timeout: 2000 });

      expect(mockPage.fillFn).toHaveBeenCalledWith('#input', 'hello', { timeout: 2000 });
    });

    it('selectOption delegates to page.selectOption', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.selectOption(pageHandle, 'select', ['opt1', 'opt2']);

      expect(mockPage.selectOptionFn).toHaveBeenCalledWith('select', ['opt1', 'opt2']);
    });

    it('waitForSelector delegates to page.waitForSelector', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.waitForSelector(pageHandle, '.ready', { timeout: 4000, state: 'visible' });

      expect(mockPage.waitForSelectorFn).toHaveBeenCalledWith('.ready', {
        timeout: 4000,
        state: 'visible',
      });
    });

    it('evaluate delegates to page.evaluate and returns result', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();
      mockPage.evaluateFn.mockResolvedValue(99);

      const result = await engine.evaluate(pageHandle, () => 99);

      expect(result).toBe(99);
      expect(mockPage.evaluateFn).toHaveBeenCalledOnce();
    });

    it('screenshot returns Buffer', async () => {
      const expectedBuffer = Buffer.from('screenshot-data');
      const freshPageMocks = makeMockPage();
      freshPageMocks.screenshotFn.mockResolvedValue(expectedBuffer);
      const { engine, contextHandle } = await engineWithContext(freshPageMocks);
      const freshPageHandle = await engine.createPage(contextHandle);

      const buffer = await engine.screenshot(freshPageHandle, { type: 'png', fullPage: true });

      expect(buffer).toBe(expectedBuffer);
      expect(freshPageMocks.screenshotFn).toHaveBeenCalledWith({
        type: 'png',
        fullPage: true,
      });
    });

    it('screenshot with no options calls page.screenshot with empty object', async () => {
      const { engine, mockPage, pageHandle } = await engineWithPage();

      await engine.screenshot(pageHandle);

      expect(mockPage.screenshotFn).toHaveBeenCalledWith({});
    });
  });

  describe('Video recording', () => {
    it('startVideoRecording resolves without error (placeholder)', async () => {
      const { engine, contextHandle } = await engineWithPage();

      await expect(
        engine.startVideoRecording(contextHandle, { outputDir: '/tmp/video' }),
      ).resolves.toBeUndefined();
    });

    it('stopVideoRecording returns video path from page.video()', async () => {
      const { video } = makeMockVideo('/recordings/test.webm');
      const mockPageMocks = makeMockPage();
      mockPageMocks.videoFn.mockReturnValue(video);
      const { engine, contextHandle } = await engineWithContext(mockPageMocks);

      const path = await engine.stopVideoRecording(contextHandle);

      expect(path).toBe('/recordings/test.webm');
    });

    it('stopVideoRecording returns empty string when no video', async () => {
      const { engine, contextHandle } = await engineWithPage();

      const path = await engine.stopVideoRecording(contextHandle);

      expect(path).toBe('');
    });
  });

  describe('Network interception', () => {
    it('onRequest stores handler and calls context.route', async () => {
      const { engine, mockContext, contextHandle } = await engineWithPage();
      const handler = vi.fn().mockResolvedValue({ action: 'continue' });

      await engine.onRequest(contextHandle, handler);

      expect(mockContext.routeFn).toHaveBeenCalledOnce();
    });

    it('onResponse stores handler and calls context.on', async () => {
      const { engine, mockContext, contextHandle } = await engineWithPage();
      const handler = vi.fn().mockResolvedValue(undefined);

      await engine.onResponse(contextHandle, handler);

      expect(mockContext.onFn).toHaveBeenCalledWith('response', expect.any(Function));
    });

    it('removeInterceptors calls context.unrouteAll()', async () => {
      const { engine, mockContext, contextHandle } = await engineWithPage();

      await engine.removeInterceptors(contextHandle);

      expect(mockContext.unrouteAllFn).toHaveBeenCalledOnce();
    });

    it('exportHar returns empty entries when no network log', async () => {
      const { engine, contextHandle } = await engineWithPage();

      const har = await engine.exportHar(contextHandle);

      expect(har.log.version).toBe('1.2');
      expect(har.log.creator.name).toBe('@sentinel/browser');
      expect(har.log.entries).toHaveLength(0);
    });

    it('exportHar returns empty entries for unknown context handle', async () => {
      const { engine } = await engineWithPage();
      const bad = 'no-context' as BrowserContextHandle;

      // exportHar uses the network log map, not requireContext — returns empty for missing key
      const har = await engine.exportHar(bad);
      expect(har.log.entries).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('throws when calling createContext before launch', async () => {
      const engine = new PlaywrightBrowserEngine();

      await expect(engine.createContext()).rejects.toThrow(
        'Browser is not launched. Call launch() first.',
      );
    });

    it('throws on unknown page handle for navigate', async () => {
      const { engine } = await engineWithPage();

      await expect(engine.navigate('unknown' as PageHandle, 'https://x.com')).rejects.toThrow(
        'No page found for handle: unknown',
      );
    });

    it('throws on unknown context handle for onRequest', async () => {
      const { engine } = await engineWithPage();

      await expect(engine.onRequest('bad' as BrowserContextHandle, vi.fn())).rejects.toThrow(
        'No browser context found for handle: bad',
      );
    });

    it('throws on unknown context handle for removeInterceptors', async () => {
      const { engine } = await engineWithPage();

      await expect(engine.removeInterceptors('bad' as BrowserContextHandle)).rejects.toThrow(
        'No browser context found for handle: bad',
      );
    });
  });
});
