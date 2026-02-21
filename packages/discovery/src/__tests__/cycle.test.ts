import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  computeFingerprint,
  fingerprintKey,
  detectCycle,
  createCycleReport,
} from '../cycle/index.js';
import type { CycleConfig, StateFingerprint } from '../types.js';

const defaultConfig: CycleConfig = {
  parameterizedUrlLimit: 3,
  infiniteScrollThreshold: 10,
};

describe('url-normalizer', () => {
  describe('normalizeUrl', () => {
    it('strips trailing slash', () => {
      expect(normalizeUrl('https://example.com/about/')).toBe('https://example.com/about');
    });

    it('preserves root path slash', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    });

    it('lowercases scheme and hostname', () => {
      expect(normalizeUrl('HTTPS://Example.COM/About')).toBe('https://example.com/About');
    });

    it('sorts query parameters alphabetically', () => {
      expect(normalizeUrl('https://example.com/?z=1&a=2')).toBe('https://example.com/?a=2&z=1');
    });

    it('removes tracking parameters', () => {
      const url = 'https://example.com/page?utm_source=google&id=5&fbclid=abc';
      expect(normalizeUrl(url)).toBe('https://example.com/page?id=5');
    });

    it('removes hash fragment', () => {
      expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
    });

    it('returns original string for invalid URLs', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url');
    });
  });
});

describe('cycle-detector', () => {
  describe('computeFingerprint', () => {
    it('creates fingerprint from URL and DOM hash', () => {
      const fp = computeFingerprint('https://example.com', 'hash123');
      expect(fp.normalizedUrl).toBe('https://example.com');
      expect(fp.domHash).toBe('hash123');
    });
  });

  describe('fingerprintKey', () => {
    it('produces a deterministic string key', () => {
      const fp: StateFingerprint = { normalizedUrl: 'https://example.com', domHash: 'abc' };
      const key = fingerprintKey(fp);
      expect(key).toBe('https://example.com|abc');
    });

    it('produces different keys for different inputs', () => {
      const fp1: StateFingerprint = { normalizedUrl: 'https://a.com', domHash: 'x' };
      const fp2: StateFingerprint = { normalizedUrl: 'https://b.com', domHash: 'x' };
      expect(fingerprintKey(fp1)).not.toBe(fingerprintKey(fp2));
    });
  });

  describe('detectCycle', () => {
    it('allows a new fingerprint', () => {
      const fp = computeFingerprint('https://example.com', 'hash1');
      const visited = new Set<string>();
      const paramCounts = new Map<string, number>();

      const result = detectCycle(fp, visited, paramCounts, defaultConfig);
      expect(result.isCycle).toBe(false);
      expect(result.entry).toBeNull();
    });

    it('detects duplicate state when fingerprint was already visited', () => {
      const fp = computeFingerprint('https://example.com', 'hash1');
      const visited = new Set([fingerprintKey(fp)]);
      const paramCounts = new Map<string, number>();

      const result = detectCycle(fp, visited, paramCounts, defaultConfig);
      expect(result.isCycle).toBe(true);
      expect(result.entry?.reason).toBe('duplicate-state');
    });

    it('detects parameterized URL limit exceeded', () => {
      const fp = computeFingerprint('https://example.com/page', 'newHash');
      const visited = new Set<string>();
      const paramCounts = new Map([['https://example.com/page', 3]]);

      const result = detectCycle(fp, visited, paramCounts, defaultConfig);
      expect(result.isCycle).toBe(true);
      expect(result.entry?.reason).toBe('parameterized-url-limit');
    });

    it('allows URL below parameterized limit', () => {
      const fp = computeFingerprint('https://example.com/page', 'newHash');
      const visited = new Set<string>();
      const paramCounts = new Map([['https://example.com/page', 2]]);

      const result = detectCycle(fp, visited, paramCounts, defaultConfig);
      expect(result.isCycle).toBe(false);
    });
  });

  describe('createCycleReport', () => {
    it('aggregates entries and counts total', () => {
      const entries = [
        { url: 'https://example.com/a', reason: 'duplicate-state' as const, count: 1 },
        { url: 'https://example.com/b', reason: 'parameterized-url-limit' as const, count: 4 },
      ];

      const report = createCycleReport(entries);
      expect(report.entries).toEqual(entries);
      expect(report.totalCyclesDetected).toBe(2);
    });

    it('returns empty report for no entries', () => {
      const report = createCycleReport([]);
      expect(report.entries).toEqual([]);
      expect(report.totalCyclesDetected).toBe(0);
    });
  });
});
