import type { TestCase } from '@sentinel/generator';

export class WorkQueue {
  private readonly items: TestCase[] = [];

  enqueue(testCase: TestCase): void {
    this.items.push(testCase);
  }

  enqueueSuite(testCases: readonly TestCase[]): void {
    for (const tc of testCases) {
      this.items.push(tc);
    }
  }

  dequeue(): TestCase | undefined {
    return this.items.shift();
  }

  requeue(testCase: TestCase): void {
    this.items.unshift(testCase);
  }

  get size(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }
}
