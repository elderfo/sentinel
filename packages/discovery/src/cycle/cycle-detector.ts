import type {
  StateFingerprint,
  CycleConfig,
  CycleDecision,
  CycleEntry,
  CycleReport,
} from '../types.js';

export function computeFingerprint(normalizedUrl: string, domHash: string): StateFingerprint {
  return { normalizedUrl, domHash };
}

export function fingerprintKey(fp: StateFingerprint): string {
  return `${fp.normalizedUrl}|${fp.domHash}`;
}

export function detectCycle(
  fingerprint: StateFingerprint,
  visited: ReadonlySet<string>,
  paramUrlCounts: ReadonlyMap<string, number>,
  config: CycleConfig,
): CycleDecision {
  const key = fingerprintKey(fingerprint);

  if (visited.has(key)) {
    return {
      isCycle: true,
      entry: { url: fingerprint.normalizedUrl, reason: 'duplicate-state', count: 1 },
    };
  }

  const urlCount = paramUrlCounts.get(fingerprint.normalizedUrl) ?? 0;
  if (urlCount >= config.parameterizedUrlLimit) {
    return {
      isCycle: true,
      entry: {
        url: fingerprint.normalizedUrl,
        reason: 'parameterized-url-limit',
        count: urlCount + 1,
      },
    };
  }

  return { isCycle: false, entry: null };
}

export function createCycleReport(entries: readonly CycleEntry[]): CycleReport {
  return {
    entries,
    totalCyclesDetected: entries.length,
  };
}
