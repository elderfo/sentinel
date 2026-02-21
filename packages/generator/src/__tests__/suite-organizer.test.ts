import { describe, it, expect } from 'vitest';
import { groupIntoSuites, slugifySuiteName } from '../emitter/suite-organizer.js';
import type { TestCase } from '../types.js';

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'test-1',
    name: 'Test Case',
    type: 'happy-path',
    journeyId: 'journey-1',
    suite: 'default',
    setupSteps: [],
    steps: [],
    teardownSteps: [],
    tags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// groupIntoSuites
// ---------------------------------------------------------------------------

describe('groupIntoSuites', () => {
  it('returns empty array for empty input', () => {
    const result = groupIntoSuites([]);
    expect(result).toEqual([]);
  });

  it('produces a single suite from a single test case', () => {
    const tc = makeTestCase({ suite: 'auth' });
    const result = groupIntoSuites([tc]);

    expect(result).toHaveLength(1);
    expect(result[0]?.testCases).toHaveLength(1);
    expect(result[0]?.testCases[0]).toBe(tc);
  });

  it('groups test cases with suite "auth" into a suite with fileName auth.spec.ts', () => {
    const tc = makeTestCase({ suite: 'auth' });
    const result = groupIntoSuites([tc]);

    expect(result[0]?.fileName).toBe('auth.spec.ts');
  });

  it('groups test cases with suite "checkout" into a suite with fileName checkout.spec.ts', () => {
    const tc = makeTestCase({ suite: 'checkout' });
    const result = groupIntoSuites([tc]);

    expect(result[0]?.fileName).toBe('checkout.spec.ts');
  });

  it('groups multiple test cases with the same suite into one TestSuite', () => {
    const tc1 = makeTestCase({ id: 'test-1', suite: 'auth', name: 'Login' });
    const tc2 = makeTestCase({
      id: 'test-2',
      suite: 'auth',
      name: 'Logout',
    });
    const result = groupIntoSuites([tc1, tc2]);

    expect(result).toHaveLength(1);
    expect(result[0]?.testCases).toHaveLength(2);
    expect(result[0]?.testCases).toContain(tc1);
    expect(result[0]?.testCases).toContain(tc2);
  });

  it('title-cases the suite name from the slug ("auth" -> "Auth")', () => {
    const tc = makeTestCase({ suite: 'auth' });
    const result = groupIntoSuites([tc]);

    expect(result[0]?.name).toBe('Auth');
  });

  it('title-cases multi-word slugs ("checkout-page" -> "Checkout Page")', () => {
    const tc = makeTestCase({ suite: 'checkout-page' });
    const result = groupIntoSuites([tc]);

    expect(result[0]?.name).toBe('Checkout Page');
  });

  it('groups test cases with different types but same suite into the same suite', () => {
    const happy = makeTestCase({
      id: 'test-1',
      suite: 'auth',
      type: 'happy-path',
    });
    const error = makeTestCase({
      id: 'test-2',
      suite: 'auth',
      type: 'error-path',
    });
    const result = groupIntoSuites([happy, error]);

    expect(result).toHaveLength(1);
    expect(result[0]?.testCases).toContain(happy);
    expect(result[0]?.testCases).toContain(error);
  });

  it('groups edge-case tests normally with their suite', () => {
    const edgeCase = makeTestCase({
      id: 'test-1',
      suite: 'checkout',
      type: 'edge-case',
    });
    const happy = makeTestCase({
      id: 'test-2',
      suite: 'checkout',
      type: 'happy-path',
    });
    const result = groupIntoSuites([edgeCase, happy]);

    expect(result).toHaveLength(1);
    expect(result[0]?.testCases).toHaveLength(2);
  });

  it('creates separate suites for different suite values', () => {
    const tc1 = makeTestCase({ id: 'test-1', suite: 'auth' });
    const tc2 = makeTestCase({ id: 'test-2', suite: 'checkout' });
    const result = groupIntoSuites([tc1, tc2]);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.fileName)).toEqual(['auth.spec.ts', 'checkout.spec.ts']);
  });
});

// ---------------------------------------------------------------------------
// slugifySuiteName
// ---------------------------------------------------------------------------

describe('slugifySuiteName', () => {
  it('converts "Authentication Flow" to "authentication-flow"', () => {
    expect(slugifySuiteName('Authentication Flow')).toBe('authentication-flow');
  });

  it('converts "Checkout Page" to "checkout-page"', () => {
    expect(slugifySuiteName('Checkout Page')).toBe('checkout-page');
  });

  it('strips special characters', () => {
    expect(slugifySuiteName('hello@world!')).toBe('hello-world');
  });

  it('converts spaces to hyphens', () => {
    expect(slugifySuiteName('my suite name')).toBe('my-suite-name');
  });

  it('lowercases everything', () => {
    expect(slugifySuiteName('UPPER CASE')).toBe('upper-case');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugifySuiteName('--leading-trailing--')).toBe('leading-trailing');
  });

  it('collapses multiple non-alphanumeric characters into a single hyphen', () => {
    expect(slugifySuiteName('foo   bar')).toBe('foo-bar');
    expect(slugifySuiteName('foo---bar')).toBe('foo-bar');
  });
});
