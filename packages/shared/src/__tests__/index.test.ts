import { describe, it, expect, expectTypeOf } from 'vitest';
import { SENTINEL_VERSION, type CheckResult } from '../index.js';

describe('@sentinel/shared', () => {
  describe('SENTINEL_VERSION', () => {
    it('is a non-empty string', () => {
      expect(typeof SENTINEL_VERSION).toBe('string');
      expect(SENTINEL_VERSION.length).toBeGreaterThan(0);
    });

    it('matches the expected version format', () => {
      expect(SENTINEL_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('CheckResult', () => {
    it('accepts a passing result', () => {
      const result: CheckResult = { status: 'pass' };
      expect(result.status).toBe('pass');
    });

    it('accepts a failing result with a reason', () => {
      const result: CheckResult = { status: 'fail', reason: 'element not found' };
      // The type is narrowed to the fail branch by declaration, so access reason directly
      expect(result.status).toBe('fail');
      expect(result.reason).toBe('element not found');
    });

    it('has the correct discriminated union shape', () => {
      expectTypeOf<CheckResult>().toExtend<
        { status: 'pass' } | { status: 'fail'; reason: string }
      >();
    });
  });
});
