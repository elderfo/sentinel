import { createHash } from 'node:crypto';
import type { TestSuite, EmittedFile, TestEmitter, OutputFormat } from '../types.js';

export class JsonEmitter implements TestEmitter {
  readonly formatName: OutputFormat = 'json';

  emit(suites: readonly TestSuite[]): Promise<readonly EmittedFile[]> {
    const content = JSON.stringify({ suites }, null, 2);
    const checksum = createHash('sha256').update(content).digest('hex');
    return Promise.resolve([{ fileName: 'sentinel-tests.json', content, checksum }]);
  }
}
