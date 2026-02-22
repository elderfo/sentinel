import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';
import type { TestArtifacts } from '../types.js';

export class ArtifactCollector {
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async createArtifactDir(suite: string, testId: string): Promise<string> {
    const dir = join(this.outputDir, suite, testId);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async captureScreenshot(
    engine: BrowserEngine,
    pageHandle: PageHandle,
    artifactDir: string,
  ): Promise<string> {
    const buffer = await engine.screenshot(pageHandle);
    const filePath = join(artifactDir, 'failure-screenshot.png');
    await writeFile(filePath, buffer);
    return filePath;
  }

  async captureConsoleLogs(
    artifactDir: string,
    consoleErrors: readonly string[],
  ): Promise<string | undefined> {
    if (consoleErrors.length === 0) return undefined;
    const filePath = join(artifactDir, 'console.log');
    await writeFile(filePath, consoleErrors.join('\n'), 'utf-8');
    return filePath;
  }

  async collectArtifacts(
    engine: BrowserEngine,
    pageHandle: PageHandle,
    suite: string,
    testId: string,
    consoleErrors: readonly string[],
  ): Promise<TestArtifacts> {
    const artifactDir = await this.createArtifactDir(suite, testId);
    const screenshotPath = await this.captureScreenshot(engine, pageHandle, artifactDir);
    const logPath = await this.captureConsoleLogs(artifactDir, consoleErrors);

    return {
      screenshotPath,
      logPath,
      artifactDir,
    };
  }
}
