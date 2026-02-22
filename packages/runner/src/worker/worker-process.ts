import { PlaywrightBrowserEngine } from '@sentinel/browser';
import type { BrowserContextHandle, PageHandle } from '@sentinel/browser';
import type { WorkerMessage, FailedRequest } from '../types.js';
import { executeTest } from './test-executor.js';
import { ArtifactCollector } from './artifact-collector.js';

type SendFn = (message: WorkerMessage) => void;

/**
 * Handles an IPC message received by the worker child process.
 *
 * When the message type is `'execute'`, the function:
 * 1. Creates and launches a PlaywrightBrowserEngine
 * 2. Creates a browser context and page
 * 3. Registers a response interceptor to capture 4xx/5xx network failures
 * 4. Calls executeTest() with the test case and config
 * 5. Sends the result (or error) back via the provided send function
 * 6. Closes the page, context, and engine
 *
 * The `send` parameter is injectable for testability (defaults to `process.send`).
 */
export async function handleWorkerMessage(message: WorkerMessage, send: SendFn): Promise<void> {
  if (message.type !== 'execute') {
    return;
  }

  const { testCase, config } = message;
  const engine = new PlaywrightBrowserEngine();

  let contextHandle: BrowserContextHandle | undefined;
  let pageHandle: PageHandle | undefined;

  try {
    await engine.launch({
      browserType: config.browserType,
      headless: config.headless,
    });
  } catch (err) {
    send({
      type: 'error',
      error: err instanceof Error ? err.message : 'Unknown worker error',
    });
    return;
  }

  try {
    contextHandle = await engine.createContext();
    pageHandle = await engine.createPage(contextHandle);

    // Track failed network requests (4xx/5xx)
    const failedRequests: FailedRequest[] = [];
    await engine.onResponse(contextHandle, (request, response) => {
      if (response.status >= 400) {
        failedRequests.push({
          url: response.url,
          method: request.method,
          status: response.status,
        });
      }
      return Promise.resolve();
    });

    // Console errors — passed as empty mutable array for now.
    // Actual console error capture will be wired in a future task.
    const consoleErrors: string[] = [];

    const artifactCollector = new ArtifactCollector(config.outputDir);

    const result = await executeTest(
      testCase,
      config,
      engine,
      pageHandle,
      artifactCollector,
      consoleErrors,
      failedRequests,
    );

    send({ type: 'result', result });
  } catch (err) {
    send({
      type: 'error',
      error: err instanceof Error ? err.message : 'Unknown worker error',
    });
  } finally {
    // Clean up in reverse order: page -> context -> engine
    if (pageHandle !== undefined) {
      try {
        await engine.closePage(pageHandle);
      } catch {
        /* cleanup failure */
      }
    }
    if (contextHandle !== undefined) {
      try {
        await engine.closeContext(contextHandle);
      } catch {
        /* cleanup failure */
      }
    }
    try {
      await engine.close();
    } catch {
      /* cleanup failure */
    }
  }
}

// ---------------------------------------------------------------------------
// Top-level IPC listener — only activates when running as a child process
// ---------------------------------------------------------------------------

if (process.send !== undefined) {
  const send = process.send.bind(process) as SendFn;
  process.on('message', (msg: WorkerMessage) => {
    handleWorkerMessage(msg, send).catch((err: unknown) => {
      send({
        type: 'error',
        error: err instanceof Error ? err.message : 'Unhandled worker error',
      });
    });
  });
}
