import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { SpaReadinessOptions } from '../types.js';

const DEFAULT_OPTIONS: SpaReadinessOptions = {
  stabilityTimeout: 5000,
  networkIdleTimeout: 500,
  pollInterval: 100,
};

/**
 * Wait for a page to become "ready" by polling DOM content length.
 * Resolves once the content length hasn't changed for `networkIdleTimeout` ms,
 * or when `stabilityTimeout` is reached (whichever comes first).
 */
export async function waitForPageReady(
  engine: BrowserEngine,
  page: PageHandle,
  options?: Partial<SpaReadinessOptions>,
): Promise<void> {
  const opts: SpaReadinessOptions = {
    stabilityTimeout: options?.stabilityTimeout ?? DEFAULT_OPTIONS.stabilityTimeout,
    networkIdleTimeout: options?.networkIdleTimeout ?? DEFAULT_OPTIONS.networkIdleTimeout,
    pollInterval: options?.pollInterval ?? DEFAULT_OPTIONS.pollInterval,
  };

  const deadline = Date.now() + opts.stabilityTimeout;
  let lastContentLength = -1;
  let stableStartTime = 0;

  while (Date.now() < deadline) {
    const contentLength = await engine.evaluate<number>(
      page,
      '(() => document.body ? document.body.innerHTML.length : 0)()',
    );

    if (contentLength === lastContentLength) {
      if (stableStartTime === 0) stableStartTime = Date.now();
      if (Date.now() - stableStartTime >= opts.networkIdleTimeout) return;
    } else {
      lastContentLength = contentLength;
      stableStartTime = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, opts.pollInterval));
  }
}

/**
 * Execute an action and detect whether it caused a SPA navigation
 * by comparing the URL before and after.
 */
export async function detectSpaNavigation(
  engine: BrowserEngine,
  page: PageHandle,
  action: () => Promise<void>,
  readinessOptions?: Partial<SpaReadinessOptions>,
): Promise<{ readonly navigated: boolean; readonly newUrl: string }> {
  const urlBefore = engine.currentUrl(page);
  await action();
  await waitForPageReady(engine, page, readinessOptions);
  const urlAfter = engine.currentUrl(page);
  return { navigated: urlBefore !== urlAfter, newUrl: urlAfter };
}
