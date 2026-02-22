import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Reporter, RunResult, TestResult } from '../types.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function groupBySuite(results: readonly TestResult[]): Map<string, TestResult[]> {
  const groups = new Map<string, TestResult[]>();
  for (const result of results) {
    const existing = groups.get(result.suite);
    if (existing !== undefined) {
      existing.push(result);
    } else {
      groups.set(result.suite, [result]);
    }
  }
  return groups;
}

function renderTestCase(result: TestResult): string {
  const time = (result.duration / 1000).toFixed(3);
  let inner = '';
  if (result.status === 'failed' && result.error !== undefined) {
    inner = `\n      <failure message="${escapeXml(result.error.message)}">${escapeXml(result.error.stack)}</failure>`;
  } else if (result.status === 'skipped') {
    inner = '\n      <skipped/>';
  }
  return `    <testcase name="${escapeXml(result.testName)}" classname="${escapeXml(result.suite)}" time="${time}">${inner}\n    </testcase>`;
}

export class JunitReporter implements Reporter {
  readonly format = 'junit' as const;

  async write(result: RunResult, outputDir: string): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const filePath = join(outputDir, 'sentinel-report.xml');

    const suiteGroups = groupBySuite(result.results);
    const suitesXml: string[] = [];

    for (const [suiteName, tests] of suiteGroups) {
      const failures = tests.filter((t) => t.status === 'failed').length;
      const skipped = tests.filter((t) => t.status === 'skipped').length;
      const time = (tests.reduce((sum, t) => sum + t.duration, 0) / 1000).toFixed(3);

      const testCases = tests.map(renderTestCase).join('\n');
      suitesXml.push(
        `  <testsuite name="${escapeXml(suiteName)}" tests="${String(tests.length)}" failures="${String(failures)}" skipped="${String(skipped)}" time="${time}">\n${testCases}\n  </testsuite>`,
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n${suitesXml.join('\n')}\n</testsuites>\n`;
    await writeFile(filePath, xml, 'utf-8');
    return filePath;
  }
}
