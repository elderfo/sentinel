import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestSuite } from '@sentinel/generator';
import type { RunnerError } from '../types.js';

export async function loadTestSuites(
  inputDir: string,
): Promise<readonly TestSuite[] | RunnerError> {
  let entries: string[];
  try {
    entries = await readdir(inputDir);
  } catch {
    return { code: 'NO_TESTS_FOUND', message: `Test directory not found: ${inputDir}` };
  }

  const jsonFiles = entries.filter((f) => f.endsWith('.json'));
  if (jsonFiles.length === 0) {
    return { code: 'NO_TESTS_FOUND', message: `No JSON test files found in: ${inputDir}` };
  }

  const suites: TestSuite[] = [];
  for (const file of jsonFiles) {
    const filePath = join(inputDir, file);
    const raw = await readFile(filePath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        code: 'NO_TESTS_FOUND',
        message: `Failed to parse JSON file: ${file}`,
      };
    }

    if (!isTestSuite(parsed)) {
      return {
        code: 'NO_TESTS_FOUND',
        message: `Invalid test suite format in: ${file}`,
      };
    }

    suites.push(parsed);
  }

  return suites;
}

function isTestSuite(value: unknown): value is TestSuite {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['name'] === 'string' &&
    typeof obj['fileName'] === 'string' &&
    Array.isArray(obj['testCases'])
  );
}
