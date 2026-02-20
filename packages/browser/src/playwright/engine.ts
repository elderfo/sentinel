import { randomBytes } from 'crypto';
import type {
  BrowserType as PlaywrightBrowserType,
  Browser,
  BrowserContext,
  Page,
} from 'playwright';
import type { BrowserType } from '@sentinel/shared';
import type {
  BrowserEngine,
  BrowserLaunchConfig,
  BrowserContextHandle,
  PageHandle,
  ContextOptions,
  NavigationOptions,
  ClickOptions,
  TypeOptions,
  WaitOptions,
  ScreenshotOptions,
  VideoOptions,
  RequestInterceptor,
  ResponseInterceptor,
  HarArchive,
  NetworkRequest,
  NetworkResponse,
} from '../types.js';
import { NetworkLog } from './network.js';

/** Function signature matching Playwright's browser launcher methods. */
export type LaunchFn = (options: { headless: boolean }) => Promise<Browser>;

/** Options for configuring the PlaywrightBrowserEngine, primarily for testing. */
export interface PlaywrightEngineOptions {
  /**
   * Override the Playwright browser launcher. Injected in tests to avoid launching
   * real browsers; in production the engine resolves the launcher from the playwright module.
   */
  readonly launchFn?: LaunchFn;
}

/**
 * Playwright-backed implementation of the BrowserEngine interface.
 *
 * Uses opaque string handles to expose Playwright's Page and BrowserContext objects
 * without leaking the underlying driver types through the public API.
 */
export class PlaywrightBrowserEngine implements BrowserEngine {
  private browser: Browser | undefined;
  private configuredBrowserType: BrowserType = 'chromium';
  private readonly launchFn: LaunchFn | undefined;

  private readonly contexts = new Map<string, BrowserContext>();
  private readonly pages = new Map<string, Page>();
  private readonly networkLogs = new Map<string, NetworkLog>();
  private readonly requestInterceptors = new Map<string, RequestInterceptor>();
  private readonly responseInterceptors = new Map<string, ResponseInterceptor>();

  constructor(options?: PlaywrightEngineOptions) {
    this.launchFn = options?.launchFn;
  }

  // ---------------------------------------------------------------------------
  // Handle helpers
  // ---------------------------------------------------------------------------

  private generateHandle(): string {
    return randomBytes(8).toString('hex');
  }

  private requireContext(handle: BrowserContextHandle): BrowserContext {
    const context = this.contexts.get(handle);
    if (context === undefined) {
      throw new Error(`No browser context found for handle: ${handle}`);
    }
    return context;
  }

  private requirePage(handle: PageHandle): Page {
    const page = this.pages.get(handle);
    if (page === undefined) {
      throw new Error(`No page found for handle: ${handle}`);
    }
    return page;
  }

  private requireBrowser(): Browser {
    if (this.browser === undefined) {
      throw new Error('Browser is not launched. Call launch() first.');
    }
    return this.browser;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async launch(config: BrowserLaunchConfig): Promise<void> {
    this.configuredBrowserType = config.browserType;

    if (this.launchFn !== undefined) {
      this.browser = await this.launchFn({ headless: config.headless });
      return;
    }

    const playwright = await import('playwright');
    const launchers: Record<BrowserType, PlaywrightBrowserType> = {
      chromium: playwright.chromium,
      firefox: playwright.firefox,
      webkit: playwright.webkit,
    };
    const launcher = launchers[config.browserType];
    this.browser = await launcher.launch({ headless: config.headless });
  }

  async close(): Promise<void> {
    if (this.browser === undefined) {
      return;
    }
    await this.browser.close();
    this.browser = undefined;
  }

  // ---------------------------------------------------------------------------
  // Context & page management
  // ---------------------------------------------------------------------------

  async createContext(options?: ContextOptions): Promise<BrowserContextHandle> {
    const browser = this.requireBrowser();

    const context = await browser.newContext({
      ...(options?.viewport !== undefined && { viewport: options.viewport }),
      ...(options?.userAgent !== undefined && { userAgent: options.userAgent }),
      ...(options?.deviceScaleFactor !== undefined && {
        deviceScaleFactor: options.deviceScaleFactor,
      }),
      ...(options?.isMobile !== undefined && { isMobile: options.isMobile }),
      ...(options?.hasTouch !== undefined && { hasTouch: options.hasTouch }),
      ...(options?.locale !== undefined && { locale: options.locale }),
      ...(options?.timezoneId !== undefined && { timezoneId: options.timezoneId }),
      ...(options?.recordVideo === true && { recordVideo: { dir: './artifacts/video' } }),
    });

    const handle = this.generateHandle() as BrowserContextHandle;
    this.contexts.set(handle, context);
    this.networkLogs.set(handle, new NetworkLog());
    return handle;
  }

  async createPage(contextHandle: BrowserContextHandle): Promise<PageHandle> {
    const context = this.requireContext(contextHandle);
    const page = await context.newPage();
    const handle = this.generateHandle() as PageHandle;
    this.pages.set(handle, page);
    return handle;
  }

  async closePage(pageHandle: PageHandle): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.close();
    this.pages.delete(pageHandle);
  }

  async closeContext(contextHandle: BrowserContextHandle): Promise<void> {
    const context = this.requireContext(contextHandle);
    await context.close();
    this.contexts.delete(contextHandle);
    this.networkLogs.delete(contextHandle);
    this.requestInterceptors.delete(contextHandle);
    this.responseInterceptors.delete(contextHandle);
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async navigate(pageHandle: PageHandle, url: string, options?: NavigationOptions): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.goto(url, {
      ...(options?.timeout !== undefined && { timeout: options.timeout }),
      ...(options?.waitUntil !== undefined && { waitUntil: options.waitUntil }),
    });
  }

  async reload(pageHandle: PageHandle): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.reload();
  }

  async goBack(pageHandle: PageHandle): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.goBack();
  }

  async goForward(pageHandle: PageHandle): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.goForward();
  }

  currentUrl(pageHandle: PageHandle): string {
    const page = this.requirePage(pageHandle);
    return page.url();
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  async click(pageHandle: PageHandle, selector: string, options?: ClickOptions): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.click(selector, {
      ...(options?.timeout !== undefined && { timeout: options.timeout }),
      ...(options?.clickCount !== undefined && { clickCount: options.clickCount }),
      ...(options?.delay !== undefined && { delay: options.delay }),
      ...(options?.button !== undefined && { button: options.button }),
      ...(options?.force !== undefined && { force: options.force }),
    });
  }

  async type(
    pageHandle: PageHandle,
    selector: string,
    text: string,
    options?: TypeOptions,
  ): Promise<void> {
    const page = this.requirePage(pageHandle);
    // fill() is preferred over type() for reliability; it clears and sets the value atomically.
    await page.fill(selector, text, {
      ...(options?.timeout !== undefined && { timeout: options.timeout }),
    });
  }

  async selectOption(pageHandle: PageHandle, selector: string, values: string[]): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.selectOption(selector, values);
  }

  async waitForSelector(
    pageHandle: PageHandle,
    selector: string,
    options?: WaitOptions,
  ): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.waitForSelector(selector, {
      ...(options?.timeout !== undefined && { timeout: options.timeout }),
      ...(options?.state !== undefined && { state: options.state }),
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async evaluate<T>(pageHandle: PageHandle, fn: string | (() => T)): Promise<T> {
    const page = this.requirePage(pageHandle);
    return page.evaluate(fn) as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // Artifacts
  // ---------------------------------------------------------------------------

  async screenshot(pageHandle: PageHandle, options?: ScreenshotOptions): Promise<Buffer> {
    const page = this.requirePage(pageHandle);
    const buffer = await page.screenshot({
      ...(options?.fullPage !== undefined && { fullPage: options.fullPage }),
      ...(options?.type !== undefined && { type: options.type }),
      ...(options?.quality !== undefined && { quality: options.quality }),
      ...(options?.clip !== undefined && { clip: options.clip }),
    });
    return buffer;
  }

  async startVideoRecording(
    _contextHandle: BrowserContextHandle, // eslint-disable-line @typescript-eslint/no-unused-vars
    _options?: VideoOptions, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<void> {
    // Playwright records video at context creation time via the `recordVideo` option.
    // This method is a placeholder for interface compatibility; configure video
    // through ContextOptions.recordVideo when calling createContext() instead.
  }

  async stopVideoRecording(contextHandle: BrowserContextHandle): Promise<string> {
    const context = this.requireContext(contextHandle);
    const contextPages = context.pages();
    for (const page of contextPages) {
      const video = page.video();
      if (video !== null) {
        const path = await video.path();
        return path;
      }
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // Network interception
  // ---------------------------------------------------------------------------

  async onRequest(contextHandle: BrowserContextHandle, handler: RequestInterceptor): Promise<void> {
    this.requestInterceptors.set(contextHandle, handler);
    const context = this.requireContext(contextHandle);

    await context.route('**/*', async (route) => {
      const playwrightRequest = route.request();
      const request: NetworkRequest = {
        url: playwrightRequest.url(),
        method: playwrightRequest.method(),
        headers: playwrightRequest.headers() as Record<string, string>,
        resourceType: playwrightRequest.resourceType(),
      };

      const interceptor = this.requestInterceptors.get(contextHandle);
      if (interceptor === undefined) {
        await route.continue();
        return;
      }

      const action = await interceptor(request);

      if (action.action === 'abort') {
        await route.abort(action.reason);
        return;
      }

      if (action.action === 'fulfill') {
        const fulfillOptions: Parameters<typeof route.fulfill>[0] = {
          status: action.status,
        };
        if (action.headers !== undefined) fulfillOptions.headers = action.headers;
        if (action.body !== undefined) fulfillOptions.body = action.body;
        await route.fulfill(fulfillOptions);
        return;
      }

      // action === 'continue' — may carry overrides
      if ('overrides' in action) {
        const continueOptions: Parameters<typeof route.continue>[0] = {};
        if (action.overrides.url !== undefined) continueOptions.url = action.overrides.url;
        if (action.overrides.method !== undefined) continueOptions.method = action.overrides.method;
        if (action.overrides.headers !== undefined)
          continueOptions.headers = action.overrides.headers;
        if (action.overrides.body !== undefined) continueOptions.postData = action.overrides.body;
        await route.continue(continueOptions);
        return;
      }

      await route.continue();
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onResponse(
    contextHandle: BrowserContextHandle,
    handler: ResponseInterceptor,
  ): Promise<void> {
    this.responseInterceptors.set(contextHandle, handler);
    const context = this.requireContext(contextHandle);

    context.on('response', (playwrightResponse) => {
      const responseInterceptor = this.responseInterceptors.get(contextHandle);
      if (responseInterceptor === undefined) return;

      const playwrightRequest = playwrightResponse.request();
      const request: NetworkRequest = {
        url: playwrightRequest.url(),
        method: playwrightRequest.method(),
        headers: playwrightRequest.headers() as Record<string, string>,
        resourceType: playwrightRequest.resourceType(),
      };

      const response: NetworkResponse = {
        url: playwrightResponse.url(),
        status: playwrightResponse.status(),
        headers: playwrightResponse.headers() as Record<string, string>,
      };

      void responseInterceptor(request, response);
    });
  }

  async removeInterceptors(contextHandle: BrowserContextHandle): Promise<void> {
    const context = this.requireContext(contextHandle);
    this.requestInterceptors.delete(contextHandle);
    this.responseInterceptors.delete(contextHandle);
    await context.unrouteAll();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async exportHar(contextHandle: BrowserContextHandle): Promise<HarArchive> {
    const log = this.networkLogs.get(contextHandle);
    if (log === undefined) {
      return {
        log: {
          version: '1.2',
          creator: { name: '@sentinel/browser', version: '0.1.0' },
          entries: [],
        },
      };
    }
    return log.exportHar();
  }

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  browserType(): BrowserType {
    return this.configuredBrowserType;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async browserVersion(): Promise<string> {
    const browser = this.requireBrowser();
    return browser.version();
  }
}
