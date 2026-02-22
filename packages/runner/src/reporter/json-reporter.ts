import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Reporter, RunResult } from '../types.js';

export class JsonReporter implements Reporter {
  readonly format = 'json' as const;

  async write(result: RunResult, outputDir: string): Promise<string> {
    await mkdir(outputDir, { recursive: true });
    const filePath = join(outputDir, 'sentinel-report.json');
    const report = {
      schemaVersion: '1.0',
      ...result,
    };
    await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    return filePath;
  }
}
