import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTest } from '../worker/test-executor.js';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { TestCase, TestAssertion, TestStep } from '@sentinel/generator';
import type { RunnerConfig, FailedRequest, TestArtifacts } from '../types.js';
import type { ArtifactCollector } from '../worker/artifact-collector.js';

// ---------------------------------------------------------------------------
// Mock BrowserEngine
// ---------------------------------------------------------------------------

const clickFn = vi.fn<BrowserEngine['click']>().mockResolvedValue(undefined);
const typeFn = vi.fn<BrowserEngine['type']>().mockResolvedValue(undefined);
const navigateFn = vi.fn<BrowserEngine['navigate']>().mockResolvedValue(undefined);
const selectOptionFn = vi.fn<BrowserEngine['selectOption']>().mockResolvedValue(undefined);
const waitForSelectorFn = vi.fn<BrowserEngine['waitForSelector']>().mockResolvedValue(undefined);
const evaluateFn = vi.fn<BrowserEngine['evaluate']>().mockResolvedValue('');
const currentUrlFn = vi.fn<BrowserEngine['currentUrl']>().mockReturnValue('http://localhost:3000');
const screenshotFn = vi
  .fn<BrowserEngine['screenshot']>()
  .mockResolvedValue(Buffer.from('fake-png'));

const mockEngine: BrowserEngine = {
  click: clickFn,
  type: typeFn,
  navigate: navigateFn,
  selectOption: selectOptionFn,
  waitForSelector: waitForSelectorFn,
  evaluate: evaluateFn,
  currentUrl: currentUrlFn,
  screenshot: screenshotFn,
  launch: vi.fn(),
  close: vi.fn(),
  createContext: vi.fn(),
  createPage: vi.fn(),
  closePage: vi.fn(),
  closeContext: vi.fn(),
  reload: vi.fn(),
  goBack: vi.fn(),
  goForward: vi.fn(),
  startVideoRecording: vi.fn(),
  stopVideoRecording: vi.fn(),
  onRequest: vi.fn(),
  onResponse: vi.fn(),
  removeInterceptors: vi.fn(),
  exportHar: vi.fn(),
  browserType: vi.fn(),
  browserVersion: vi.fn(),
} as unknown as BrowserEngine;

// ---------------------------------------------------------------------------
// Mock ArtifactCollector
// ---------------------------------------------------------------------------

const defaultArtifacts: TestArtifacts = {
  screenshotPath: './output/auth/tc-1/failure-screenshot.png',
  logPath: './output/auth/tc-1/console.log',
  artifactDir: './output/auth/tc-1',
};

const collectArtifactsFn = vi.fn().mockResolvedValue(defaultArtifacts);

const mockArtifactCollector: ArtifactCollector = {
  createArtifactDir: vi.fn(),
  captureScreenshot: vi.fn(),
  captureConsoleLogs: vi.fn(),
  collectArtifacts: collectArtifactsFn,
} as unknown as ArtifactCollector;

// ---------------------------------------------------------------------------
// Shared constants & fixtures
// ---------------------------------------------------------------------------

const PAGE_HANDLE = 'page-1' as PageHandle;

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

function makeAssertion(overrides: Partial<TestAssertion> = {}): TestAssertion {
  return {
    type: 'visibility',
    selector: '#success',
    selectorStrategy: 'css',
    expected: 'true',
    confidence: 0.9,
    description: 'Success message visible',
    ...overrides,
  };
}

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc-1',
    name: 'Login happy path',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUrlFn.mockReturnValue('http://localhost:3000');
    evaluateFn.mockResolvedValue('');
    waitForSelectorFn.mockResolvedValue(undefined);
    collectArtifactsFn.mockResolvedValue(defaultArtifacts);
  });

  it('navigates to baseUrl if provided in config', async () => {
    const tc = makeTestCase({ steps: [] });

    await executeTest(tc, baseConfig, mockEngine, PAGE_HANDLE, mockArtifactCollector, [], []);

    expect(navigateFn).toHaveBeenCalledWith(PAGE_HANDLE, 'http://localhost:3000');
  });

  it('does not navigate to baseUrl when not provided', async () => {
    const configWithoutBase: RunnerConfig = { ...baseConfig, baseUrl: undefined };
    const tc = makeTestCase({ steps: [] });

    await executeTest(
      tc,
      configWithoutBase,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(navigateFn).not.toHaveBeenCalled();
  });

  it('executes click action by calling engine.click()', async () => {
    const tc = makeTestCase({
      steps: [makeStep({ action: 'click', selector: '#login-btn' })],
    });

    await executeTest(tc, baseConfig, mockEngine, PAGE_HANDLE, mockArtifactCollector, [], []);

    expect(clickFn).toHaveBeenCalledWith(PAGE_HANDLE, '#login-btn');
  });

  it('executes navigation action by calling engine.navigate()', async () => {
    const tc = makeTestCase({
      steps: [makeStep({ action: 'navigation', selector: '/dashboard' })],
    });

    await executeTest(tc, baseConfig, mockEngine, PAGE_HANDLE, mockArtifactCollector, [], []);

    // First call is baseUrl navigation, second is the step navigation
    expect(navigateFn).toHaveBeenCalledWith(PAGE_HANDLE, '/dashboard');
  });

  it('executes form-submit action by calling engine.click()', async () => {
    const tc = makeTestCase({
      steps: [makeStep({ action: 'form-submit', selector: '#submit-form' })],
    });

    await executeTest(tc, baseConfig, mockEngine, PAGE_HANDLE, mockArtifactCollector, [], []);

    expect(clickFn).toHaveBeenCalledWith(PAGE_HANDLE, '#submit-form');
  });

  it('returns TestResult with status passed when all steps succeed', async () => {
    const tc = makeTestCase();

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(result.status).toBe('passed');
    expect(result.testId).toBe('tc-1');
    expect(result.testName).toBe('Login happy path');
    expect(result.suite).toBe('auth');
    expect(result.retryCount).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('returns TestResult with status failed and TestError when assertion fails', async () => {
    waitForSelectorFn.mockRejectedValueOnce(new Error('Timeout'));

    const assertion = makeAssertion({
      type: 'visibility',
      selector: '#success',
      expected: 'true',
      description: 'Success message visible',
    });
    const tc = makeTestCase({
      steps: [makeStep({ assertions: [assertion] })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Assertion failed');
    expect(result.error?.assertionDetails).toEqual({
      expected: 'true',
      actual: 'false',
      selector: '#success',
      assertionType: 'visibility',
    });
  });

  it('captures artifacts on failure via ArtifactCollector', async () => {
    waitForSelectorFn.mockRejectedValueOnce(new Error('Timeout'));

    const assertion = makeAssertion({ expected: 'true' });
    const tc = makeTestCase({
      steps: [makeStep({ assertions: [assertion] })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      ['Console error 1'],
      [],
    );

    expect(collectArtifactsFn).toHaveBeenCalledWith(mockEngine, PAGE_HANDLE, 'auth', 'tc-1', [
      'Console error 1',
    ]);
    expect(result.artifacts.screenshotPath).toContain('failure-screenshot.png');
  });

  it('evaluates visibility assertion via waitForSelector', async () => {
    // waitForSelector succeeds = element visible
    waitForSelectorFn.mockResolvedValueOnce(undefined);

    const assertion = makeAssertion({
      type: 'visibility',
      selector: '#visible-element',
      expected: 'true',
    });
    const tc = makeTestCase({
      steps: [makeStep({ assertions: [assertion] })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(waitForSelectorFn).toHaveBeenCalledWith(PAGE_HANDLE, '#visible-element', {
      timeout: 5000,
    });
    expect(result.status).toBe('passed');
  });

  it('evaluates text-content assertion via evaluate', async () => {
    evaluateFn.mockResolvedValueOnce('Welcome back');

    const assertion = makeAssertion({
      type: 'text-content',
      selector: '#greeting',
      expected: 'Welcome back',
      description: 'Greeting text matches',
    });
    const tc = makeTestCase({
      steps: [makeStep({ assertions: [assertion] })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(evaluateFn).toHaveBeenCalledWith(
      PAGE_HANDLE,
      "document.querySelector('#greeting')?.textContent ?? ''",
    );
    expect(result.status).toBe('passed');
  });

  it('evaluates url-match assertion via currentUrl', async () => {
    currentUrlFn.mockReturnValue('http://localhost:3000/dashboard');

    const assertion = makeAssertion({
      type: 'url-match',
      selector: '',
      expected: '/dashboard',
      description: 'URL contains /dashboard',
    });
    const tc = makeTestCase({
      steps: [makeStep({ assertions: [assertion] })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(result.status).toBe('passed');
  });

  it('evaluates element-count assertion via evaluate', async () => {
    evaluateFn.mockResolvedValueOnce(3);

    const assertion = makeAssertion({
      type: 'element-count',
      selector: '.item',
      expected: '3',
      description: 'Three items present',
    });
    const tc = makeTestCase({
      steps: [makeStep({ assertions: [assertion] })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(result.status).toBe('passed');
  });

  it('evaluates attribute-value assertion via evaluate', async () => {
    evaluateFn.mockResolvedValueOnce('user@example.com');

    const assertion = makeAssertion({
      type: 'attribute-value',
      selector: '#email',
      expected: 'user@example.com',
      description: 'Email field has correct value',
    });
    const tc = makeTestCase({
      steps: [makeStep({ assertions: [assertion] })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(result.status).toBe('passed');
  });

  it('handles unexpected errors gracefully', async () => {
    clickFn.mockRejectedValueOnce(new Error('Browser crashed'));

    const tc = makeTestCase({
      steps: [makeStep({ action: 'click', selector: '#broken' })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      ['Error in console'],
      [{ url: '/api/fail', method: 'GET', status: 500 }],
    );

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('Browser crashed');
    expect(result.error?.consoleErrors).toEqual(['Error in console']);
    expect(result.error?.failedNetworkRequests).toEqual([
      { url: '/api/fail', method: 'GET', status: 500 },
    ]);
    expect(collectArtifactsFn).toHaveBeenCalled();
  });

  it('handles non-Error thrown values gracefully', async () => {
    clickFn.mockRejectedValueOnce('string error');

    const tc = makeTestCase({
      steps: [makeStep({ action: 'click', selector: '#broken' })],
    });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('Unknown error');
    expect(result.error?.stack).toBe('');
  });

  it('executes setup, main, and teardown steps in order', async () => {
    const callOrder: string[] = [];
    clickFn.mockImplementation((_page, selector: string) => {
      callOrder.push(`click:${selector}`);
      return Promise.resolve();
    });
    navigateFn.mockImplementation((_page, url: string) => {
      callOrder.push(`navigate:${url}`);
      return Promise.resolve();
    });

    const tc = makeTestCase({
      setupSteps: [makeStep({ action: 'navigation', selector: '/setup' })],
      steps: [makeStep({ action: 'click', selector: '#action' })],
      teardownSteps: [makeStep({ action: 'click', selector: '#logout' })],
    });

    await executeTest(tc, baseConfig, mockEngine, PAGE_HANDLE, mockArtifactCollector, [], []);

    // baseUrl navigation, then setup navigation, then main click, then teardown click
    expect(callOrder).toEqual([
      'navigate:http://localhost:3000',
      'navigate:/setup',
      'click:#action',
      'click:#logout',
    ]);
  });

  it('includes console errors and failed requests in assertion failure error', async () => {
    waitForSelectorFn.mockRejectedValueOnce(new Error('Timeout'));

    const assertion = makeAssertion({ expected: 'true' });
    const tc = makeTestCase({
      steps: [makeStep({ assertions: [assertion] })],
    });

    const consoleErrors = ['TypeError: undefined is not a function'];
    const failedReqs: FailedRequest[] = [{ url: '/api/data', method: 'POST', status: 422 }];

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      consoleErrors,
      failedReqs,
    );

    expect(result.error?.consoleErrors).toEqual(consoleErrors);
    expect(result.error?.failedNetworkRequests).toEqual(failedReqs);
  });

  it('builds correct artifactDir path for passed tests', async () => {
    const tc = makeTestCase({ suite: 'checkout', id: 'tc-42' });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(result.artifacts.artifactDir).toBe('./output/checkout/tc-42');
  });

  it('skips unknown action types without error', async () => {
    // Force an unrecognized action to exercise the default branch.
    // This simulates a future ActionType expansion.
    const step = makeStep({ action: 'hover' as TestStep['action'], selector: '#menu' });
    const tc = makeTestCase({ steps: [step] });

    const result = await executeTest(
      tc,
      baseConfig,
      mockEngine,
      PAGE_HANDLE,
      mockArtifactCollector,
      [],
      [],
    );

    expect(result.status).toBe('passed');
    expect(clickFn).not.toHaveBeenCalledWith(PAGE_HANDLE, '#menu');
  });
});
