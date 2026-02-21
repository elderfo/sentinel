import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { JsonEmitter } from '../emitter/json-emitter.js';
import type { TestCase, TestSuite } from '../types.js';

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    id: 'test-1',
    name: 'Test Case',
    type: 'happy-path',
    journeyId: 'j-1',
    suite: 'default',
    setupSteps: [],
    steps: [
      {
        action: 'click' as const,
        selector: '#btn',
        selectorStrategy: 'css' as const,
        description: 'Click button',
        assertions: [
          {
            type: 'visibility' as const,
            selector: '.result',
            selectorStrategy: 'css' as const,
            expected: 'true',
            confidence: 1.0,
            description: 'Result is visible',
          },
        ],
      },
    ],
    teardownSteps: [],
    tags: [],
    ...overrides,
  };
}

function makeSuite(overrides: Partial<TestSuite> = {}): TestSuite {
  return {
    name: 'Default',
    fileName: 'default.spec.ts',
    testCases: [makeTestCase()],
    ...overrides,
  };
}

/** Helper to get the single emitted file, asserting length first. */
async function emitSingle(
  emitter: JsonEmitter,
  suites: readonly TestSuite[],
): Promise<{ fileName: string; content: string; checksum: string }> {
  const result = await emitter.emit(suites);
  expect(result).toHaveLength(1);
  return result[0] as { fileName: string; content: string; checksum: string };
}

interface ParsedSuites {
  suites: Array<{
    name: string;
    fileName: string;
    testCases: Array<Record<string, unknown>>;
  }>;
}

// ---------------------------------------------------------------------------
// JsonEmitter
// ---------------------------------------------------------------------------

describe('JsonEmitter', () => {
  const emitter = new JsonEmitter();

  it('has formatName "json"', () => {
    expect(emitter.formatName).toBe('json');
  });

  // -------------------------------------------------------------------------
  // Output validity
  // -------------------------------------------------------------------------

  it('produces valid JSON that can be parsed with JSON.parse', async () => {
    const file = await emitSingle(emitter, [makeSuite()]);

    expect(() => JSON.parse(file.content) as unknown).not.toThrow();
  });

  it('JSON structure contains a "suites" array at the top level', async () => {
    const file = await emitSingle(emitter, [makeSuite()]);
    const parsed = JSON.parse(file.content) as Record<string, unknown>;

    expect(parsed).toHaveProperty('suites');
    expect(Array.isArray(parsed['suites'])).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Suite structure
  // -------------------------------------------------------------------------

  it('each suite in JSON has name, fileName, and testCases fields', async () => {
    const file = await emitSingle(emitter, [makeSuite({ name: 'Auth', fileName: 'auth.spec.ts' })]);
    const parsed = JSON.parse(file.content) as ParsedSuites;
    const suite = parsed.suites[0];

    expect(suite).toHaveProperty('name', 'Auth');
    expect(suite).toHaveProperty('fileName', 'auth.spec.ts');
    expect(suite).toHaveProperty('testCases');
    expect(Array.isArray(suite?.testCases)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test case fields
  // -------------------------------------------------------------------------

  it('test cases retain all fields including steps and assertions', async () => {
    const tc = makeTestCase({
      id: 'tc-42',
      name: 'Verify login',
      type: 'error-path',
      journeyId: 'j-99',
      tags: ['smoke', 'auth'],
    });
    const file = await emitSingle(emitter, [makeSuite({ testCases: [tc] })]);
    const parsed = JSON.parse(file.content) as ParsedSuites;
    const outputTc = parsed.suites[0]?.testCases[0];

    expect(outputTc).toHaveProperty('id', 'tc-42');
    expect(outputTc).toHaveProperty('name', 'Verify login');
    expect(outputTc).toHaveProperty('type', 'error-path');
    expect(outputTc).toHaveProperty('journeyId', 'j-99');
    expect(outputTc).toHaveProperty('suite', 'default');
    expect(outputTc).toHaveProperty('setupSteps');
    expect(outputTc).toHaveProperty('steps');
    expect(outputTc).toHaveProperty('teardownSteps');
    expect(outputTc).toHaveProperty('tags');
    expect(outputTc?.['tags']).toEqual(['smoke', 'auth']);

    // Verify step assertions round-trip
    const steps = outputTc?.['steps'] as Array<Record<string, unknown>> | undefined;
    const step = steps?.[0];
    expect(step).toHaveProperty('action', 'click');
    expect(step).toHaveProperty('selector', '#btn');
    const assertions = step?.['assertions'] as Array<Record<string, unknown>> | undefined;
    const assertion = assertions?.[0];
    expect(assertion).toHaveProperty('type', 'visibility');
    expect(assertion).toHaveProperty('expected', 'true');
    expect(assertion).toHaveProperty('confidence', 1.0);
  });

  // -------------------------------------------------------------------------
  // EmittedFile shape
  // -------------------------------------------------------------------------

  it('returns exactly one EmittedFile', async () => {
    const result = await emitter.emit([makeSuite()]);

    expect(result).toHaveLength(1);
  });

  it('EmittedFile.fileName is "sentinel-tests.json"', async () => {
    const file = await emitSingle(emitter, [makeSuite()]);

    expect(file.fileName).toBe('sentinel-tests.json');
  });

  // -------------------------------------------------------------------------
  // Checksum
  // -------------------------------------------------------------------------

  it('checksum is a 64-character hex string (SHA-256)', async () => {
    const file = await emitSingle(emitter, [makeSuite()]);

    expect(file.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('checksum is deterministic for the same input', async () => {
    const suites = [makeSuite()];
    const first = await emitSingle(emitter, suites);
    const second = await emitSingle(emitter, suites);

    expect(first.checksum).toBe(second.checksum);
  });

  it('checksum matches independently computed SHA-256 of content', async () => {
    const file = await emitSingle(emitter, [makeSuite()]);
    const expected = createHash('sha256').update(file.content).digest('hex');

    expect(file.checksum).toBe(expected);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('empty suites array produces valid JSON with empty suites array', async () => {
    const file = await emitSingle(emitter, []);
    const parsed = JSON.parse(file.content) as ParsedSuites;

    expect(parsed.suites).toEqual([]);
  });

  it('multiple suites are all present in the output', async () => {
    const suites = [
      makeSuite({ name: 'Auth', fileName: 'auth.spec.ts' }),
      makeSuite({ name: 'Checkout', fileName: 'checkout.spec.ts' }),
      makeSuite({ name: 'Profile', fileName: 'profile.spec.ts' }),
    ];
    const file = await emitSingle(emitter, suites);
    const parsed = JSON.parse(file.content) as ParsedSuites;

    expect(parsed.suites).toHaveLength(3);
    expect(parsed.suites.map((s) => s.name)).toEqual(['Auth', 'Checkout', 'Profile']);
    expect(parsed.suites.map((s) => s.fileName)).toEqual([
      'auth.spec.ts',
      'checkout.spec.ts',
      'profile.spec.ts',
    ]);
  });
});
