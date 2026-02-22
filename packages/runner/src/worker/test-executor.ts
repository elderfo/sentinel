import type { TestCase, TestStep, TestAssertion } from '@sentinel/generator';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { RunnerConfig, TestResult, TestError, FailedRequest } from '../types.js';
import type { ArtifactCollector } from './artifact-collector.js';

async function executeStep(
  step: TestStep,
  engine: BrowserEngine,
  pageHandle: PageHandle,
): Promise<void> {
  switch (step.action) {
    case 'click':
      await engine.click(pageHandle, step.selector);
      break;
    case 'navigation':
      await engine.navigate(pageHandle, step.selector);
      break;
    case 'form-submit':
      await engine.click(pageHandle, step.selector);
      break;
    default:
      // For unknown or future actions, skip
      break;
  }
}

async function evaluateAssertion(
  assertion: TestAssertion,
  engine: BrowserEngine,
  pageHandle: PageHandle,
): Promise<{ passed: boolean; actual: string }> {
  switch (assertion.type) {
    case 'visibility': {
      try {
        await engine.waitForSelector(pageHandle, assertion.selector, { timeout: 5000 });
        return { passed: assertion.expected === 'true', actual: 'true' };
      } catch {
        return { passed: assertion.expected === 'false', actual: 'false' };
      }
    }
    case 'text-content': {
      const sel = JSON.stringify(assertion.selector);
      const text = await engine.evaluate<string>(
        pageHandle,
        `document.querySelector(${sel})?.textContent ?? ''`,
      );
      return { passed: text === assertion.expected, actual: text };
    }
    case 'url-match': {
      const url = engine.currentUrl(pageHandle);
      return { passed: url.includes(assertion.expected), actual: url };
    }
    case 'element-count': {
      const sel = JSON.stringify(assertion.selector);
      const count = await engine.evaluate<number>(
        pageHandle,
        `document.querySelectorAll(${sel}).length`,
      );
      const countStr = String(count);
      return { passed: countStr === assertion.expected, actual: countStr };
    }
    case 'attribute-value': {
      const sel = JSON.stringify(assertion.selector);
      const value = await engine.evaluate<string>(
        pageHandle,
        `document.querySelector(${sel})?.getAttribute('value') ?? ''`,
      );
      return { passed: value === assertion.expected, actual: value };
    }
  }
}

export async function executeTest(
  testCase: TestCase,
  config: RunnerConfig,
  engine: BrowserEngine,
  pageHandle: PageHandle,
  artifactCollector: ArtifactCollector,
  consoleErrors: readonly string[],
  failedRequests: readonly FailedRequest[],
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Navigate to baseUrl if provided
    if (config.baseUrl !== undefined) {
      await engine.navigate(pageHandle, config.baseUrl);
    }

    // Execute all step groups in order
    const allSteps = [...testCase.setupSteps, ...testCase.steps, ...testCase.teardownSteps];
    for (const step of allSteps) {
      await executeStep(step, engine, pageHandle);

      // Evaluate assertions for this step
      for (const assertion of step.assertions) {
        const result = await evaluateAssertion(assertion, engine, pageHandle);
        if (!result.passed) {
          // Assertion failed — capture artifacts and return failure
          const artifacts = await artifactCollector.collectArtifacts(
            engine,
            pageHandle,
            testCase.suite,
            testCase.id,
            [...consoleErrors],
          );

          const error: TestError = {
            message: `Assertion failed: ${assertion.description}`,
            stack: `Expected ${assertion.expected}, got ${result.actual} at selector "${assertion.selector}"`,
            assertionDetails: {
              expected: assertion.expected,
              actual: result.actual,
              selector: assertion.selector,
              assertionType: assertion.type,
            },
            consoleErrors: [...consoleErrors],
            failedNetworkRequests: [...failedRequests],
          };

          return {
            testId: testCase.id,
            testName: testCase.name,
            suite: testCase.suite,
            status: 'failed',
            duration: Date.now() - startTime,
            retryCount: 0,
            error,
            artifacts,
          };
        }
      }
    }

    // All steps and assertions passed
    return {
      testId: testCase.id,
      testName: testCase.name,
      suite: testCase.suite,
      status: 'passed',
      duration: Date.now() - startTime,
      retryCount: 0,
      artifacts: {
        artifactDir: `${config.outputDir}/${testCase.suite}/${testCase.id}`,
      },
    };
  } catch (err) {
    // Unexpected error — capture artifacts and return failure
    const artifacts = await artifactCollector.collectArtifacts(
      engine,
      pageHandle,
      testCase.suite,
      testCase.id,
      [...consoleErrors],
    );

    return {
      testId: testCase.id,
      testName: testCase.name,
      suite: testCase.suite,
      status: 'failed',
      duration: Date.now() - startTime,
      retryCount: 0,
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? (err.stack ?? '') : '',
        consoleErrors: [...consoleErrors],
        failedNetworkRequests: [...failedRequests],
      },
      artifacts,
    };
  }
}
