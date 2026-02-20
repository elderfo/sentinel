import { describe, it, expect } from 'vitest';
import { isDynamicId } from '../stability/dynamic-id-detector.js';

describe('isDynamicId', () => {
  it('returns false for stable semantic IDs', () => {
    expect(isDynamicId('submit-btn')).toBe(false);
    expect(isDynamicId('main-nav')).toBe(false);
    expect(isDynamicId('login-form')).toBe(false);
    expect(isDynamicId('header')).toBe(false);
  });

  it('detects React-generated IDs (colon format)', () => {
    expect(isDynamicId(':r0:')).toBe(true);
    expect(isDynamicId(':r1a:')).toBe(true);
    expect(isDynamicId(':R1:')).toBe(true);
  });

  it('detects framework-prefixed IDs', () => {
    expect(isDynamicId('react-select-123')).toBe(true);
    expect(isDynamicId('ember456')).toBe(true);
    expect(isDynamicId('ng-c123456')).toBe(true);
    expect(isDynamicId('vue-component-1')).toBe(true);
  });

  it('detects UUID-like IDs', () => {
    expect(isDynamicId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('detects purely numeric IDs', () => {
    expect(isDynamicId('123')).toBe(true);
    expect(isDynamicId('0')).toBe(true);
  });

  it('detects hex-hash-like IDs', () => {
    expect(isDynamicId('css-1a2b3c')).toBe(true);
    expect(isDynamicId('sc-1x2y3z')).toBe(true);
  });

  it('detects IDs ending with long numeric suffixes', () => {
    expect(isDynamicId('component-839271649')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isDynamicId('')).toBe(false);
  });
});
