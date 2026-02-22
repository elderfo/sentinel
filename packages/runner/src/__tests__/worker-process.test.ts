import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  BrowserEngine,
  BrowserContextHandle,
  PageHandle,
  NetworkRequest,
  NetworkResponse,
  ResponseInterceptor,
} from '@sentinel/browser';
import type { TestCase, TestStep } from '@sentinel/generator';
import type { RunnerConfig, TestResult, WorkerMessage } from '../types.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock PlaywrightBrowserEngine constructor
const CTX_HANDLE = 'ctx-1' as BrowserContextHandle;
const PAGE_HANDLE = 'page-1' as PageHandle;

const launchFn = vi.fn<BrowserEngine['launch']>().mockResolvedValue(undefined);
const closeFn = vi.fn<BrowserEngine['close']>().mockResolvedValue(undefined);
const createContextFn = vi.fn<BrowserEngine['createContext']>().mockResolvedValue(CTX_HANDLE);
const createPageFn = vi.fn<BrowserEngine['createPage']>().mockResolvedValue(PAGE_HANDLE);
const closePageFn = vi.fn<BrowserEngine['closePage']>().mockResolvedValue(undefined);
const closeContextFn = vi.fn<BrowserEngine['closeContext']>().mockResolvedValue(undefined);
const onResponseFn = vi.fn<BrowserEngine['onResponse']>().mockResolvedValue(undefined);
const removeInterceptorsFn = vi
  .fn<BrowserEngine['removeInterceptors']>()
  .mockResolvedValue(undefined);

const mockEngineInstance: BrowserEngine = {
  launch: launchFn,
  close: closeFn,
  createContext: createContextFn,
  createPage: createPageFn,
  closePage: closePageFn,
  closeContext: closeContextFn,
  onResponse: onResponseFn,
  removeInterceptors: removeInterceptorsFn,
  navigate: vi.fn(),
  reload: vi.fn(),
  goBack: vi.fn(),
  goForward: vi.fn(),
  currentUrl: vi.fn().mockReturnValue('http://localhost:3000'),
  click: vi.fn(),
  type: vi.fn(),
  selectOption: vi.fn(),
  waitForSelector: vi.fn(),
  evaluate: vi.fn(),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
  startVideoRecording: vi.fn(),
  stopVideoRecording: vi.fn(),
  onRequest: vi.fn(),
  exportHar: vi.fn(),
  browserType: vi.fn(),
  browserVersion: vi.fn(),
} as unknown as BrowserEngine;

// Use a regular function (not arrow) so it works with `new`
vi.mock('@sentinel/browser', () => ({
  PlaywrightBrowserEngine: vi.fn().mockImplementation(function mockCtor() {
    return mockEngineInstance;
  }),
}));

// Mock executeTest
const fakeResult: TestResult = {
  testId: 'tc-1',
  testName: 'Login test',
  suite: 'auth',
  status: 'passed',
  duration: 150,
  retryCount: 0,
  artifacts: { artifactDir: './output/auth/tc-1' },
};

const executeTestFn = vi.fn().mockResolvedValue(fakeResult);

vi.mock('../worker/test-executor.js', () => ({
  executeTest: (...args: unknown[]): Promise<TestResult> =>
    executeTestFn(...args) as Promise<TestResult>,
}));

// Mock ArtifactCollector
const mockArtifactCollectorInstance = { collectArtifacts: vi.fn() };

vi.mock('../worker/artifact-collector.js', () => ({
  ArtifactCollector: vi.fn().mockImplementation(function mockCtor() {
    return mockArtifactCollectorInstance;
  }),
}));

// Mock process.send
const processSendFn = vi.fn();

// ---------------------------------------------------------------------------
// Import under test (after mocks are set up)
// ---------------------------------------------------------------------------

let handleWorkerMessage: typeof import('../worker/worker-process.js').handleWorkerMessage;

beforeEach(async () => {
  vi.clearAllMocks();
  launchFn.mockResolvedValue(undefined);
  closeFn.mockResolvedValue(undefined);
  createContextFn.mockResolvedValue(CTX_HANDLE);
  createPageFn.mockResolvedValue(PAGE_HANDLE);
  closePageFn.mockResolvedValue(undefined);
  closeContextFn.mockResolvedValue(undefined);
  onResponseFn.mockResolvedValue(undefined);
  removeInterceptorsFn.mockResolvedValue(undefined);
  executeTestFn.mockResolvedValue(fakeResult);
  processSendFn.mockReturnValue(undefined);

  const mod = await import('../worker/worker-process.js');
  handleWorkerMessage = mod.handleWorkerMessage;
});

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeStep(overrides: Partial<TestStep> = {}): TestStep {
  return {
    action: 'click',
    selector: '#submit-btn',
    selectorStrategy: 'css',
    description: 'Click submit',
    assertions: [],
    ...overrides,
  };
}

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc-1',
    name: 'Login test',
    type: 'happy-path',
    journeyId: 'j-1',
    suite: 'auth',
    setupSteps: [],
    steps: [makeStep()],
    teardownSteps: [],
    tags: [],
    ...overrides,
  };
}

const baseConfig: RunnerConfig = {
  outputDir: './output',
  workers: 1,
  retries: 0,
  headless: true,
  browserType: 'chromium',
  timeout: 30_000,
  reportFormats: ['json'],
  trendDbPath: './trends.json',
  baseUrl: 'http://localhost:3000',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleWorkerMessage', () => {
  it('launches engine, creates context/page, calls executeTest, and sends result back', async () => {
    const msg: WorkerMessage = {
      type: 'execute',
      testCase: makeTestCase(),
      config: baseConfig,
    };

    await handleWorkerMessage(msg, processSendFn);

    // Engine lifecycle: launch, createContext, createPage
    expect(launchFn).toHaveBeenCalledWith({
      browserType: 'chromium',
      headless: true,
    });
    expect(createContextFn).toHaveBeenCalled();
    expect(createPageFn).toHaveBeenCalledWith(CTX_HANDLE);

    // Response interceptor registered on context
    expect(onResponseFn).toHaveBeenCalledWith(CTX_HANDLE, expect.any(Function));

    // executeTest was called with correct arguments
    expect(executeTestFn).toHaveBeenCalledWith(
      msg.testCase,
      baseConfig,
      mockEngineInstance,
      PAGE_HANDLE,
      mockArtifactCollectorInstance,
      expect.any(Array),
      expect.any(Array),
    );

    // Result sent back via process.send
    expect(processSendFn).toHaveBeenCalledWith({
      type: 'result',
      result: fakeResult,
    });
  });

  it('sends error message when engine launch fails', async () => {
    launchFn.mockRejectedValueOnce(new Error('Browser binary not found'));

    const msg: WorkerMessage = {
      type: 'execute',
      testCase: makeTestCase(),
      config: baseConfig,
    };

    await handleWorkerMessage(msg, processSendFn);

    expect(processSendFn).toHaveBeenCalledWith({
      type: 'error',
      error: 'Browser binary not found',
    });
  });

  it('sends error message with generic text for non-Error thrown values', async () => {
    launchFn.mockRejectedValueOnce('unexpected string error');

    const msg: WorkerMessage = {
      type: 'execute',
      testCase: makeTestCase(),
      config: baseConfig,
    };

    await handleWorkerMessage(msg, processSendFn);

    expect(processSendFn).toHaveBeenCalledWith({
      type: 'error',
      error: 'Unknown worker error',
    });
  });

  it('captures 4xx/5xx network requests via response interceptor', async () => {
    // Capture the response handler registered via onResponse
    let capturedHandler: ResponseInterceptor | undefined;
    onResponseFn.mockImplementation((_ctx: BrowserContextHandle, handler: ResponseInterceptor) => {
      capturedHandler = handler;
      return Promise.resolve();
    });

    // Make executeTest check that failedRequests were populated
    executeTestFn.mockImplementation(
      async (
        _tc: TestCase,
        _cfg: RunnerConfig,
        _eng: BrowserEngine,
        _page: PageHandle,
        _ac: unknown,
        _console: readonly string[],
        failedRequests: readonly { url: string; method: string; status: number }[],
      ) => {
        // Simulate network responses before returning
        if (capturedHandler === undefined) {
          throw new Error('Response handler was not registered');
        }
        const handler = capturedHandler;

        // 200 OK — should NOT be captured
        const okRequest: NetworkRequest = {
          url: 'http://localhost:3000/api/ok',
          method: 'GET',
          headers: {},
          resourceType: 'xhr',
        };
        const okResponse: NetworkResponse = {
          url: 'http://localhost:3000/api/ok',
          status: 200,
          headers: {},
        };
        await handler(okRequest, okResponse);

        // 404 — should be captured
        const notFoundRequest: NetworkRequest = {
          url: 'http://localhost:3000/api/missing',
          method: 'GET',
          headers: {},
          resourceType: 'xhr',
        };
        const notFoundResponse: NetworkResponse = {
          url: 'http://localhost:3000/api/missing',
          status: 404,
          headers: {},
        };
        await handler(notFoundRequest, notFoundResponse);

        // 500 — should be captured
        const serverErrorRequest: NetworkRequest = {
          url: 'http://localhost:3000/api/error',
          method: 'POST',
          headers: {},
          resourceType: 'xhr',
        };
        const serverErrorResponse: NetworkResponse = {
          url: 'http://localhost:3000/api/error',
          status: 500,
          headers: {},
        };
        await handler(serverErrorRequest, serverErrorResponse);

        // Verify the failed requests were captured
        expect(failedRequests).toHaveLength(2);
        expect(failedRequests[0]).toEqual({
          url: 'http://localhost:3000/api/missing',
          method: 'GET',
          status: 404,
        });
        expect(failedRequests[1]).toEqual({
          url: 'http://localhost:3000/api/error',
          method: 'POST',
          status: 500,
        });

        return fakeResult;
      },
    );

    const msg: WorkerMessage = {
      type: 'execute',
      testCase: makeTestCase(),
      config: baseConfig,
    };

    await handleWorkerMessage(msg, processSendFn);

    expect(onResponseFn).toHaveBeenCalled();
  });

  it('closes page, context, and engine after test completes', async () => {
    const msg: WorkerMessage = {
      type: 'execute',
      testCase: makeTestCase(),
      config: baseConfig,
    };

    await handleWorkerMessage(msg, processSendFn);

    expect(closePageFn).toHaveBeenCalledWith(PAGE_HANDLE);
    expect(closeContextFn).toHaveBeenCalledWith(CTX_HANDLE);
    expect(closeFn).toHaveBeenCalled();
  });

  it('still cleans up engine after executeTest throws', async () => {
    executeTestFn.mockRejectedValueOnce(new Error('Test crashed'));

    const msg: WorkerMessage = {
      type: 'execute',
      testCase: makeTestCase(),
      config: baseConfig,
    };

    await handleWorkerMessage(msg, processSendFn);

    // Should still close page, context, engine
    expect(closePageFn).toHaveBeenCalledWith(PAGE_HANDLE);
    expect(closeContextFn).toHaveBeenCalledWith(CTX_HANDLE);
    expect(closeFn).toHaveBeenCalled();

    // Should send error message
    expect(processSendFn).toHaveBeenCalledWith({
      type: 'error',
      error: 'Test crashed',
    });
  });

  it('ignores messages that are not of type execute', async () => {
    const msg: WorkerMessage = {
      type: 'result',
      result: fakeResult,
    };

    await handleWorkerMessage(msg, processSendFn);

    // Should not launch engine or send anything
    expect(launchFn).not.toHaveBeenCalled();
    expect(processSendFn).not.toHaveBeenCalled();
  });

  it('creates ArtifactCollector with outputDir from config', async () => {
    const { ArtifactCollector } = await import('../worker/artifact-collector.js');
    const ArtifactCollectorMock = vi.mocked(ArtifactCollector);

    const msg: WorkerMessage = {
      type: 'execute',
      testCase: makeTestCase(),
      config: { ...baseConfig, outputDir: '/custom/output' },
    };

    await handleWorkerMessage(msg, processSendFn);

    expect(ArtifactCollectorMock).toHaveBeenCalledWith('/custom/output');
  });
});
