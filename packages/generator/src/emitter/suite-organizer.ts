import type { TestCase, TestSuite } from '../types.js';

export function groupIntoSuites(testCases: readonly TestCase[]): readonly TestSuite[] {
  if (testCases.length === 0) return [];

  const groups = new Map<string, TestCase[]>();
  for (const tc of testCases) {
    const key = tc.suite;
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.push(tc);
    } else {
      groups.set(key, [tc]);
    }
  }

  return [...groups.entries()].map(([slug, cases]) => ({
    name: titleCase(slug),
    fileName: `${slug}.spec.ts`,
    testCases: cases,
  }));
}

export function slugifySuiteName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
