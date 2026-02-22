import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TestSuite } from '@sentinel/generator';
import type { RunnerError } from '@sentinel/runner';

vi.mock('node:fs/promises');

import { readdir, readFile } from 'node:fs/promises';
import { loadTestSuites } from '@sentinel/runner';

const mockedReaddir = vi.mocked(readdir);
const mockedReadFile = vi.mocked(readFile);

const validSuite: TestSuite = {
  name: 'Auth Tests',
  fileName: 'auth.spec.ts',
  testCases: [
    {
      id: 'tc-1',
      name: 'Login happy path',
      type: 'happy-path',
      journeyId: 'j-1',
      suite: 'auth',
      setupSteps: [],
      steps: [],
      teardownSteps: [],
      tags: ['smoke'],
    },
  ],
};

describe('loadTestSuites', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns RunnerError with NO_TESTS_FOUND when directory does not exist', async () => {
    mockedReaddir.mockRejectedValue(new Error('ENOENT'));

    const result = await loadTestSuites('/missing/dir');

    expect(result).toEqual({
      code: 'NO_TESTS_FOUND',
      message: 'Test directory not found: /missing/dir',
    });
  });

  it('returns RunnerError when directory has no JSON files', async () => {
    mockedReaddir.mockResolvedValue(['file.txt', 'readme.md'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);

    const result = await loadTestSuites('/some/dir');

    expect(result).toEqual({
      code: 'NO_TESTS_FOUND',
      message: 'No JSON test files found in: /some/dir',
    });
  });

  it('parses a valid JSON file into TestSuite', async () => {
    mockedReaddir.mockResolvedValue(['auth.json'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
    mockedReadFile.mockResolvedValue(JSON.stringify(validSuite));

    const result = await loadTestSuites('/tests');

    expect(Array.isArray(result)).toBe(true);
    const suites = result as readonly TestSuite[];
    expect(suites).toHaveLength(1);
    expect(suites[0]?.name).toBe('Auth Tests');
    expect(suites[0]?.fileName).toBe('auth.spec.ts');
    expect(suites[0]?.testCases).toHaveLength(1);
  });

  it('loads multiple JSON files from directory', async () => {
    const secondSuite: TestSuite = {
      name: 'Dashboard Tests',
      fileName: 'dashboard.spec.ts',
      testCases: [],
    };

    mockedReaddir.mockResolvedValue(['auth.json', 'dashboard.json'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
    mockedReadFile
      .mockResolvedValueOnce(JSON.stringify(validSuite))
      .mockResolvedValueOnce(JSON.stringify(secondSuite));

    const result = await loadTestSuites('/tests');

    expect(Array.isArray(result)).toBe(true);
    const suites = result as readonly TestSuite[];
    expect(suites).toHaveLength(2);
    expect(suites[0]?.name).toBe('Auth Tests');
    expect(suites[1]?.name).toBe('Dashboard Tests');
  });

  it('skips non-JSON files in the directory', async () => {
    mockedReaddir.mockResolvedValue(['readme.md', 'auth.json', 'notes.txt'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
    mockedReadFile.mockResolvedValue(JSON.stringify(validSuite));

    const result = await loadTestSuites('/tests');

    expect(Array.isArray(result)).toBe(true);
    const suites = result as readonly TestSuite[];
    expect(suites).toHaveLength(1);
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
  });

  it('returns RunnerError when JSON is malformed', async () => {
    mockedReaddir.mockResolvedValue(['bad.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
    mockedReadFile.mockResolvedValue('{ not valid json !!!');

    const result = await loadTestSuites('/tests');

    expect((result as RunnerError).code).toBe('NO_TESTS_FOUND');
    expect((result as RunnerError).message).toBe('Failed to parse JSON file: bad.json');
  });

  it('returns RunnerError when JSON does not match TestSuite shape', async () => {
    mockedReaddir.mockResolvedValue(['invalid.json'] as unknown as Awaited<
      ReturnType<typeof readdir>
    >);
    mockedReadFile.mockResolvedValue(JSON.stringify({ foo: 'bar' }));

    const result = await loadTestSuites('/tests');

    expect((result as RunnerError).code).toBe('NO_TESTS_FOUND');
    expect((result as RunnerError).message).toBe('Invalid test suite format in: invalid.json');
  });
});
