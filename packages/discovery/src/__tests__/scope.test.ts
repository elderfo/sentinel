import { describe, it, expect } from 'vitest';
import { isUrlAllowed, validateScopeConfig } from '../scope/index.js';
import type { ScopeConfig } from '../types.js';

const baseConfig: ScopeConfig = {
  allowPatterns: [],
  denyPatterns: [],
  allowExternalDomains: false,
  excludeQueryPatterns: [],
};

describe('scope-filter', () => {
  describe('isUrlAllowed', () => {
    it('allows same-domain URLs when no patterns configured', () => {
      const result = isUrlAllowed('https://example.com/about', baseConfig, 'example.com');
      expect(result.allowed).toBe(true);
    });

    it('denies external domains by default', () => {
      const result = isUrlAllowed('https://other.com/page', baseConfig, 'example.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('External domain');
    });

    it('allows external domains when configured', () => {
      const config: ScopeConfig = { ...baseConfig, allowExternalDomains: true };
      const result = isUrlAllowed('https://other.com/page', config, 'example.com');
      expect(result.allowed).toBe(true);
    });

    it('allows URLs matching allow patterns', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        allowPatterns: ['/products/'],
      };
      const result = isUrlAllowed('https://example.com/products/shoes', config, 'example.com');
      expect(result.allowed).toBe(true);
    });

    it('denies URLs not matching any allow pattern', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        allowPatterns: ['/products/'],
      };
      const result = isUrlAllowed('https://example.com/admin', config, 'example.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Does not match');
    });

    it('deny patterns take precedence over allow patterns', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        allowPatterns: ['/products/'],
        denyPatterns: ['/products/internal'],
      };
      const result = isUrlAllowed(
        'https://example.com/products/internal/secret',
        config,
        'example.com',
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('deny pattern');
    });

    it('strips excluded query parameters before matching', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        denyPatterns: ['\\?.*session='],
        excludeQueryPatterns: ['^session$'],
      };
      // After stripping `session` param, the deny pattern should not match
      const result = isUrlAllowed('https://example.com/page?session=abc', config, 'example.com');
      expect(result.allowed).toBe(true);
    });

    it('returns not-allowed for invalid URLs', () => {
      const result = isUrlAllowed('not-a-url', baseConfig, 'example.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid URL');
    });
  });

  describe('validateScopeConfig', () => {
    it('accepts valid configuration', () => {
      const result = validateScopeConfig(baseConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects invalid regex in allow patterns', () => {
      const config: ScopeConfig = { ...baseConfig, allowPatterns: ['[invalid'] };
      const result = validateScopeConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid regex in deny patterns', () => {
      const config: ScopeConfig = { ...baseConfig, denyPatterns: ['(unclosed'] };
      const result = validateScopeConfig(config);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid regex in excludeQueryPatterns', () => {
      const config: ScopeConfig = { ...baseConfig, excludeQueryPatterns: ['*bad'] };
      const result = validateScopeConfig(config);
      expect(result.valid).toBe(false);
    });

    it('reports all invalid patterns, not just the first', () => {
      const config: ScopeConfig = {
        ...baseConfig,
        allowPatterns: ['[bad1'],
        denyPatterns: ['(bad2'],
      };
      const result = validateScopeConfig(config);
      expect(result.errors.length).toBe(2);
    });
  });
});
