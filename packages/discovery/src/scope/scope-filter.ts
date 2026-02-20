import type { ScopeConfig, ScopeDecision } from '../types.js';

export function isUrlAllowed(url: string, config: ScopeConfig, baseDomain: string): ScopeDecision {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }

  // External domain check
  if (!config.allowExternalDomains && parsed.hostname !== baseDomain) {
    return { allowed: false, reason: `External domain: ${parsed.hostname}` };
  }

  // Strip excluded query params before pattern matching
  for (const pattern of config.excludeQueryPatterns) {
    const regex = new RegExp(pattern);
    for (const key of [...parsed.searchParams.keys()]) {
      if (regex.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
  }

  const testUrl = parsed.href;

  // Deny patterns take precedence
  for (const pattern of config.denyPatterns) {
    if (new RegExp(pattern).test(testUrl)) {
      return { allowed: false, reason: `Matches deny pattern: ${pattern}` };
    }
  }

  // If no allow patterns, allow everything not denied
  if (config.allowPatterns.length === 0) {
    return { allowed: true, reason: 'No allow patterns configured, URL not denied' };
  }

  // Check allow patterns
  for (const pattern of config.allowPatterns) {
    if (new RegExp(pattern).test(testUrl)) {
      return { allowed: true, reason: `Matches allow pattern: ${pattern}` };
    }
  }

  return { allowed: false, reason: 'Does not match any allow pattern' };
}

export function validateScopeConfig(config: ScopeConfig): {
  readonly valid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];

  for (const pattern of config.allowPatterns) {
    try {
      new RegExp(pattern);
    } catch {
      errors.push(`Invalid allow pattern: ${pattern}`);
    }
  }

  for (const pattern of config.denyPatterns) {
    try {
      new RegExp(pattern);
    } catch {
      errors.push(`Invalid deny pattern: ${pattern}`);
    }
  }

  for (const pattern of config.excludeQueryPatterns) {
    try {
      new RegExp(pattern);
    } catch {
      errors.push(`Invalid exclude query pattern: ${pattern}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
