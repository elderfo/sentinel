import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { TestSuite, TestCase } from '@sentinel/generator';
import type { RunnerConfig, TestResult, TestStatus, WorkerMessage } from '../types.js';
import { WorkQueue } from './work-queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKER_PATH = join(__dirname, '..', 'worker', 'worker-process.js');

interface WorkerEntry {
  readonly process: ChildProcess;
  currentTestCase: TestCase | undefined;
}

export class Scheduler {
  private readonly config: RunnerConfig;
  private readonly queue: WorkQueue;
  private readonly attemptCounts: Map<string, number> = new Map();
  private readonly crashCounts: Map<string, number> = new Map();

  constructor(config: RunnerConfig) {
    this.config = config;
    this.queue = new WorkQueue();
  }

  get workerCount(): number {
    return this.config.workers;
  }

  get queueSize(): number {
    return this.queue.size;
  }

  enqueue(suites: readonly TestSuite[]): void {
    for (const suite of suites) {
      this.queue.enqueueSuite(suite.testCases);
    }
  }

  async execute(): Promise<TestResult[]> {
    if (this.queue.isEmpty) {
      return [];
    }

    this.attemptCounts.clear();
    this.crashCounts.clear();

    return new Promise<TestResult[]>((resolve) => {
      const results: TestResult[] = [];
      const workers: Map<number, WorkerEntry> = new Map();
      let settled = false;

      const tryComplete = (): void => {
        if (settled) {
          return;
        }

        // Check if all work is done: queue is empty and no worker is busy
        if (!this.queue.isEmpty) {
          return;
        }
        const allIdle = [...workers.values()].every((w) => w.currentTestCase === undefined);
        if (!allIdle) {
          return;
        }

        settled = true;
        // Kill all workers
        for (const entry of workers.values()) {
          entry.process.kill();
        }
        resolve(results);
      };

      const dispatchWork = (workerEntry: WorkerEntry): void => {
        const testCase = this.queue.dequeue();
        if (testCase === undefined) {
          workerEntry.currentTestCase = undefined;
          tryComplete();
          return;
        }

        workerEntry.currentTestCase = testCase;
        const msg: WorkerMessage = {
          type: 'execute',
          testCase,
          config: this.config,
        };

        try {
          workerEntry.process.send(msg);
        } catch {
          // IPC channel already destroyed — re-queue the test and mark worker idle
          this.queue.requeue(testCase);
          workerEntry.currentTestCase = undefined;
          tryComplete();
        }
      };

      const handleResult = (workerEntry: WorkerEntry, result: TestResult): void => {
        const testCase = workerEntry.currentTestCase;
        if (testCase === undefined) {
          return;
        }

        const attempt = this.attemptCounts.get(testCase.id) ?? 0;

        if (result.status === 'failed' && attempt < this.config.retries) {
          // Retry: increment attempt and re-enqueue
          this.attemptCounts.set(testCase.id, attempt + 1);
          this.queue.requeue(testCase);
          workerEntry.currentTestCase = undefined;
          dispatchWork(workerEntry);
        } else {
          // Final result: adjust status and retryCount based on attempts
          const retryCount = attempt;
          const finalStatus: TestStatus =
            result.status === 'passed' && retryCount > 0 ? 'passed-with-retry' : result.status;

          const finalResult: TestResult = {
            ...result,
            status: finalStatus,
            retryCount,
          };

          results.push(finalResult);
          workerEntry.currentTestCase = undefined;
          dispatchWork(workerEntry);
        }
      };

      const handleError = (workerEntry: WorkerEntry, errorMessage: string): void => {
        const testCase = workerEntry.currentTestCase;
        if (testCase === undefined) {
          return;
        }

        const attempt = this.attemptCounts.get(testCase.id) ?? 0;

        if (attempt < this.config.retries) {
          // Retry on error
          this.attemptCounts.set(testCase.id, attempt + 1);
          this.queue.requeue(testCase);
          workerEntry.currentTestCase = undefined;
          dispatchWork(workerEntry);
        } else {
          // Final failure
          const failedResult: TestResult = {
            testId: testCase.id,
            testName: testCase.name,
            suite: testCase.suite,
            status: 'failed',
            duration: 0,
            retryCount: attempt,
            error: {
              message: errorMessage,
              stack: '',
              consoleErrors: [],
              failedNetworkRequests: [],
            },
            artifacts: { artifactDir: join(this.config.outputDir, testCase.suite, testCase.id) },
          };

          results.push(failedResult);
          workerEntry.currentTestCase = undefined;
          dispatchWork(workerEntry);
        }
      };

      const spawnWorker = (): void => {
        const child = fork(WORKER_PATH, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
        const pid = child.pid ?? -1;

        const entry: WorkerEntry = {
          process: child,
          currentTestCase: undefined,
        };

        workers.set(pid, entry);

        child.on('message', (msg: WorkerMessage) => {
          const workerEntry = workers.get(pid);
          if (workerEntry === undefined) {
            return;
          }

          if (msg.type === 'result') {
            handleResult(workerEntry, msg.result);
          } else if (msg.type === 'error') {
            handleError(workerEntry, msg.error);
          }
        });

        child.on('exit', () => {
          const workerEntry = workers.get(pid);
          if (workerEntry === undefined || settled) {
            return;
          }

          // If the worker was processing a test, re-queue it (unless crash limit reached)
          const testCase = workerEntry.currentTestCase;
          workers.delete(pid);

          if (testCase !== undefined) {
            const crashes = (this.crashCounts.get(testCase.id) ?? 0) + 1;
            this.crashCounts.set(testCase.id, crashes);

            const maxCrashes = this.config.retries + 1;
            if (crashes > maxCrashes) {
              // Crash limit exceeded — record as failed
              const attempt = this.attemptCounts.get(testCase.id) ?? 0;
              const failedResult: TestResult = {
                testId: testCase.id,
                testName: testCase.name,
                suite: testCase.suite,
                status: 'failed',
                duration: 0,
                retryCount: attempt,
                error: {
                  message: `Worker crashed ${String(crashes)} times for test "${testCase.name}"`,
                  stack: '',
                  consoleErrors: [],
                  failedNetworkRequests: [],
                },
                artifacts: {
                  artifactDir: join(this.config.outputDir, testCase.suite, testCase.id),
                },
              };
              results.push(failedResult);
            } else {
              this.queue.requeue(testCase);
            }
          }

          // Fork a replacement worker
          spawnWorker();
        });

        // Immediately dispatch work to the new worker
        dispatchWork(entry);
      };

      // Fork the configured number of workers
      for (let i = 0; i < this.config.workers; i++) {
        spawnWorker();
      }
    });
  }
}
