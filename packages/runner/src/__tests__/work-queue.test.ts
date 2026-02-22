import { describe, it, expect } from 'vitest';
import { WorkQueue } from '../scheduler/work-queue.js';
import type { TestCase } from '@sentinel/generator';

const makeTestCase = (id: string): TestCase => ({
  id,
  name: `Test ${id}`,
  type: 'happy-path',
  journeyId: 'j-1',
  suite: 'test-suite',
  setupSteps: [],
  steps: [],
  teardownSteps: [],
  tags: [],
});

describe('WorkQueue', () => {
  it('starts empty', () => {
    const q = new WorkQueue();
    expect(q.isEmpty).toBe(true);
    expect(q.size).toBe(0);
  });

  it('enqueue adds items and increases size', () => {
    const q = new WorkQueue();
    q.enqueue(makeTestCase('1'));
    expect(q.size).toBe(1);
    expect(q.isEmpty).toBe(false);
  });

  it('dequeue returns items in FIFO order', () => {
    const q = new WorkQueue();
    q.enqueue(makeTestCase('1'));
    q.enqueue(makeTestCase('2'));
    q.enqueue(makeTestCase('3'));
    expect(q.dequeue()?.id).toBe('1');
    expect(q.dequeue()?.id).toBe('2');
    expect(q.dequeue()?.id).toBe('3');
  });

  it('dequeue returns undefined when empty', () => {
    const q = new WorkQueue();
    expect(q.dequeue()).toBeUndefined();
  });

  it('requeue adds item to the front', () => {
    const q = new WorkQueue();
    q.enqueue(makeTestCase('1'));
    q.enqueue(makeTestCase('2'));
    q.requeue(makeTestCase('retry'));
    expect(q.dequeue()?.id).toBe('retry');
    expect(q.dequeue()?.id).toBe('1');
  });

  it('enqueueSuite adds all test cases from a suite', () => {
    const q = new WorkQueue();
    const cases = [makeTestCase('a'), makeTestCase('b'), makeTestCase('c')];
    q.enqueueSuite(cases);
    expect(q.size).toBe(3);
    expect(q.dequeue()?.id).toBe('a');
    expect(q.dequeue()?.id).toBe('b');
    expect(q.dequeue()?.id).toBe('c');
  });

  it('preserves ordering across enqueue and enqueueSuite', () => {
    const q = new WorkQueue();
    q.enqueue(makeTestCase('1'));
    q.enqueueSuite([makeTestCase('2'), makeTestCase('3')]);
    q.enqueue(makeTestCase('4'));
    expect(q.dequeue()?.id).toBe('1');
    expect(q.dequeue()?.id).toBe('2');
    expect(q.dequeue()?.id).toBe('3');
    expect(q.dequeue()?.id).toBe('4');
  });
});
