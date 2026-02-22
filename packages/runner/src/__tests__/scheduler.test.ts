import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { fork } from 'node:child_process';
import type { TestCase } from '@sentinel/generator';
import type { RunnerConfig, TestResult, WorkerMessage } from '../types.js';
import { Scheduler } from '../scheduler/scheduler.js';

// ---------------------------------------------------------------------------
// Mock child_process.fork
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  fork: vi.fn(),
}));

const mockFork = fork as Mock;

// ---------------------------------------------------------------------------
// Helper: create mock ChildProcess
// ---------------------------------------------------------------------------

let mockPidCounter = 1000;

interface MockChild extends EventEmitter {
  pid: number;
  send: Mock;
  kill: Mock;
  connected: boolean;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.pid = mockPidCounter++;
  child.send = vi.fn();
  child.kill = vi.fn();
  child.connected = true;
  return child;
}

/** Type-safe helper to assert a value is defined and return it. */
function defined<T>(value: T | undefined, label = 'value'): T {
  if (value === undefined) {
    throw new Error(`Expected ${label} to be defined`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseConfig: RunnerConfig = {
  outputDir: './output',
  workers: 2,
  retries: 0,
  headless: true,
  browserType: 'chromium',
  timeout: 30_000,
  reportFormats: ['json'],
  trendDbPath: './trends.json',
  baseUrl: 'http://localhost:3000',
};

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'tc-1',
    name: 'Login test',
    type: 'happy-path',
    journeyId: 'j-1',
    suite: 'auth',
    setupSteps: [],
    steps: [],
    teardownSteps: [],
    tags: [],
    ...overrides,
  };
}

function makePassedResult(testCase: TestCase, retryCount = 0): TestResult {
  return {
    testId: testCase.id,
    testName: testCase.name,
    suite: testCase.suite,
    status: retryCount > 0 ? 'passed-with-retry' : 'passed',
    duration: 100,
    retryCount,
    artifacts: { artifactDir: './output' },
  };
}

function makeFailedResult(testCase: TestCase, retryCount = 0): TestResult {
  return {
    testId: testCase.id,
    testName: testCase.name,
    suite: testCase.suite,
    status: 'failed',
    duration: 100,
    retryCount,
    error: {
      message: 'Assertion failed',
      stack: '',
      consoleErrors: [],
      failedNetworkRequests: [],
    },
    artifacts: { artifactDir: './output' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Scheduler', () => {
  let mockChildren: MockChild[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPidCounter = 1000;
    mockChildren = [];

    mockFork.mockImplementation(() => {
      const child = createMockChild();
      mockChildren.push(child);
      return child as unknown as ChildProcess;
    });
  });

  describe('constructor', () => {
    it('stores the number of workers from config', () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 4 });
      expect(scheduler.workerCount).toBe(4);
    });
  });

  describe('enqueue', () => {
    it('adds all test cases from suites to the work queue', () => {
      const scheduler = new Scheduler(baseConfig);
      const tc1 = makeTestCase({ id: 'tc-1' });
      const tc2 = makeTestCase({ id: 'tc-2' });
      const suites = [
        { name: 'auth', fileName: 'auth.test.ts', testCases: [tc1] },
        { name: 'checkout', fileName: 'checkout.test.ts', testCases: [tc2] },
      ];

      scheduler.enqueue(suites);

      expect(scheduler.queueSize).toBe(2);
    });

    it('handles empty suites', () => {
      const scheduler = new Scheduler(baseConfig);
      scheduler.enqueue([]);
      expect(scheduler.queueSize).toBe(0);
    });
  });

  describe('execute', () => {
    it('forks the configured number of worker processes', async () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 2 });
      const tc = makeTestCase();
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(2);
      });

      // Worker receives execute message, responds with result
      const child = defined(
        mockChildren.find((c) => {
          const sendFn = c.send;
          return sendFn.mock.calls.length > 0;
        }),
        'child with sent messages',
      );

      const sendCall = child.send.mock.calls[0] as [WorkerMessage];
      expect(sendCall[0].type).toBe('execute');

      // Simulate worker responding with a result
      const msg: WorkerMessage = { type: 'result', result: makePassedResult(tc) };
      child.emit('message', msg);

      const results = await promise;
      expect(results).toHaveLength(1);
      expect(defined(results[0], 'results[0]').status).toBe('passed');
    });

    it('sends execute messages to workers via IPC', async () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 1 });
      const tc = makeTestCase({ id: 'tc-1' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(1);
      });

      const child = defined(mockChildren[0], 'mockChildren[0]');
      const sendFn = child.send;

      await vi.waitFor(() => {
        expect(sendFn).toHaveBeenCalled();
      });

      const sentMsg = sendFn.mock.calls[0] as [WorkerMessage];
      expect(sentMsg[0]).toEqual({
        type: 'execute',
        testCase: tc,
        config: { ...baseConfig, workers: 1 },
      });

      // Finish test
      child.emit('message', { type: 'result', result: makePassedResult(tc) });
      await promise;
    });

    it('collects result messages from workers', async () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 1 });
      const tc1 = makeTestCase({ id: 'tc-1', name: 'Test 1' });
      const tc2 = makeTestCase({ id: 'tc-2', name: 'Test 2' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc1, tc2] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(defined(mockChildren[0], 'mockChildren[0]').send).toHaveBeenCalled();
      });

      const child = defined(mockChildren[0], 'mockChildren[0]');

      // First result
      child.emit('message', { type: 'result', result: makePassedResult(tc1) });

      // Wait for the second test to be sent
      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn.mock.calls.length).toBe(2);
      });

      // Second result
      child.emit('message', { type: 'result', result: makePassedResult(tc2) });

      const results = await promise;
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.testId)).toEqual(['tc-1', 'tc-2']);
    });

    it('resolves with all TestResult[] after queue is drained', async () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 2 });
      const tc1 = makeTestCase({ id: 'tc-1' });
      const tc2 = makeTestCase({ id: 'tc-2' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc1, tc2] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(2);
      });

      const child0 = defined(mockChildren[0], 'mockChildren[0]');
      const child1 = defined(mockChildren[1], 'mockChildren[1]');

      await vi.waitFor(() => {
        const send0 = child0.send;
        const send1 = child1.send;
        expect(send0.mock.calls.length + send1.mock.calls.length).toBe(2);
      });

      // Both workers respond
      child0.emit('message', { type: 'result', result: makePassedResult(tc1) });
      child1.emit('message', { type: 'result', result: makePassedResult(tc2) });

      const results = await promise;
      expect(results).toHaveLength(2);
    });

    it('re-queues and forks replacement worker on worker crash', async () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 1 });
      const tc = makeTestCase({ id: 'tc-crash' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(1);
      });

      const crashedChild = defined(mockChildren[0], 'mockChildren[0]');
      await vi.waitFor(() => {
        const sendFn = crashedChild.send;
        expect(sendFn).toHaveBeenCalled();
      });

      // Simulate crash (non-zero exit code)
      crashedChild.connected = false;
      crashedChild.emit('exit', 1, null);

      // A replacement worker should be forked
      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(2);
      });

      const replacementChild = defined(mockChildren[1], 'mockChildren[1]');
      await vi.waitFor(() => {
        const sendFn = replacementChild.send;
        expect(sendFn).toHaveBeenCalled();
      });

      // Replacement worker succeeds
      replacementChild.emit('message', { type: 'result', result: makePassedResult(tc) });

      const results = await promise;
      expect(results).toHaveLength(1);
      expect(defined(results[0], 'results[0]').testId).toBe('tc-crash');
    });

    it('re-enqueues on test failure with retries remaining', async () => {
      const config = { ...baseConfig, workers: 1, retries: 2 };
      const scheduler = new Scheduler(config);
      const tc = makeTestCase({ id: 'tc-retry' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(1);
      });

      const child = defined(mockChildren[0], 'mockChildren[0]');

      // First attempt: failure
      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn).toHaveBeenCalled();
      });
      child.emit('message', { type: 'result', result: makeFailedResult(tc, 0) });

      // Second attempt (retry 1): failure
      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn.mock.calls.length).toBe(2);
      });
      child.emit('message', { type: 'result', result: makeFailedResult(tc, 1) });

      // Third attempt (retry 2): pass
      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn.mock.calls.length).toBe(3);
      });
      child.emit('message', { type: 'result', result: makePassedResult(tc, 2) });

      const results = await promise;
      expect(results).toHaveLength(1);
      const result = defined(results[0], 'results[0]');
      expect(result.status).toBe('passed-with-retry');
      expect(result.retryCount).toBe(2);
    });

    it('keeps test as failed after max retries exceeded', async () => {
      const config = { ...baseConfig, workers: 1, retries: 1 };
      const scheduler = new Scheduler(config);
      const tc = makeTestCase({ id: 'tc-fail-hard' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(1);
      });
      const child = defined(mockChildren[0], 'mockChildren[0]');

      // First attempt: failure
      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn).toHaveBeenCalled();
      });
      child.emit('message', { type: 'result', result: makeFailedResult(tc, 0) });

      // Second attempt (retry 1): failure again
      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn.mock.calls.length).toBe(2);
      });
      child.emit('message', { type: 'result', result: makeFailedResult(tc, 1) });

      const results = await promise;
      expect(results).toHaveLength(1);
      const result = defined(results[0], 'results[0]');
      expect(result.status).toBe('failed');
      expect(result.retryCount).toBe(1);
    });

    it('marks test as passed-with-retry when it passes on retry', async () => {
      const config = { ...baseConfig, workers: 1, retries: 2 };
      const scheduler = new Scheduler(config);
      const tc = makeTestCase({ id: 'tc-flaky' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(1);
      });
      const child = defined(mockChildren[0], 'mockChildren[0]');

      // First attempt: failure
      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn).toHaveBeenCalled();
      });
      child.emit('message', { type: 'result', result: makeFailedResult(tc, 0) });

      // Second attempt: pass
      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn.mock.calls.length).toBe(2);
      });
      child.emit('message', { type: 'result', result: makePassedResult(tc, 1) });

      const results = await promise;
      expect(results).toHaveLength(1);
      const result = defined(results[0], 'results[0]');
      expect(result.status).toBe('passed-with-retry');
      expect(result.retryCount).toBe(1);
    });

    it('handles worker error messages by treating them as test failures', async () => {
      const config = { ...baseConfig, workers: 1, retries: 0 };
      const scheduler = new Scheduler(config);
      const tc = makeTestCase({ id: 'tc-error' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(1);
      });
      const child = defined(mockChildren[0], 'mockChildren[0]');

      await vi.waitFor(() => {
        const sendFn = child.send;
        expect(sendFn).toHaveBeenCalled();
      });

      child.emit('message', { type: 'error', error: 'Browser crashed' });

      const results = await promise;
      expect(results).toHaveLength(1);
      const result = defined(results[0], 'results[0]');
      expect(result.status).toBe('failed');
      expect(result.error?.message).toBe('Browser crashed');
    });

    it('kills all workers when execution completes', async () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 2 });
      const tc = makeTestCase({ id: 'tc-1' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(2);
      });

      // One worker gets work, the other is idle
      const workerWithWork = defined(
        mockChildren.find((c) => {
          const sendFn = c.send;
          return sendFn.mock.calls.length > 0;
        }),
        'worker with work',
      );

      workerWithWork.emit('message', { type: 'result', result: makePassedResult(tc) });

      await promise;

      // All workers should be killed
      for (const child of mockChildren) {
        const killFn = child.kill;
        expect(killFn).toHaveBeenCalled();
      }
    });

    it('distributes work across multiple workers', async () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 2 });
      const tc1 = makeTestCase({ id: 'tc-1' });
      const tc2 = makeTestCase({ id: 'tc-2' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc1, tc2] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(2);
      });

      // Wait for both workers to receive work
      await vi.waitFor(() => {
        const total = mockChildren.reduce((sum, c) => {
          const sendFn = c.send;
          return sum + sendFn.mock.calls.length;
        }, 0);
        expect(total).toBe(2);
      });

      // Each worker should have received exactly one test
      for (const child of mockChildren) {
        const sendFn = child.send;
        expect(sendFn.mock.calls.length).toBe(1);
      }

      // Both respond
      const child0 = defined(mockChildren[0], 'mockChildren[0]');
      const child1 = defined(mockChildren[1], 'mockChildren[1]');
      child0.emit('message', { type: 'result', result: makePassedResult(tc1) });
      child1.emit('message', { type: 'result', result: makePassedResult(tc2) });

      const results = await promise;
      expect(results).toHaveLength(2);
    });

    it('handles empty queue by resolving immediately', async () => {
      const scheduler = new Scheduler({ ...baseConfig, workers: 1 });
      scheduler.enqueue([]);

      const results = await scheduler.execute();
      expect(results).toHaveLength(0);
    });

    it('handles crash during retry correctly', async () => {
      const config = { ...baseConfig, workers: 1, retries: 1 };
      const scheduler = new Scheduler(config);
      const tc = makeTestCase({ id: 'tc-crash-retry' });
      scheduler.enqueue([{ name: 'auth', fileName: 'auth.test.ts', testCases: [tc] }]);

      const promise = scheduler.execute();

      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(1);
      });

      const firstChild = defined(mockChildren[0], 'mockChildren[0]');
      await vi.waitFor(() => {
        const sendFn = firstChild.send;
        expect(sendFn).toHaveBeenCalled();
      });

      // First attempt: worker crashes
      firstChild.connected = false;
      firstChild.emit('exit', 1, null);

      // Replacement worker is forked
      await vi.waitFor(() => {
        expect(mockChildren.length).toBe(2);
      });

      const secondChild = defined(mockChildren[1], 'mockChildren[1]');
      await vi.waitFor(() => {
        const sendFn = secondChild.send;
        expect(sendFn).toHaveBeenCalled();
      });

      // Second attempt: passes
      secondChild.emit('message', { type: 'result', result: makePassedResult(tc, 0) });

      const results = await promise;
      expect(results).toHaveLength(1);
      // Crash re-queues don't count as retries — the test case is just re-submitted
      const result = defined(results[0], 'results[0]');
      expect(result.status).toBe('passed');
    });
  });
});
