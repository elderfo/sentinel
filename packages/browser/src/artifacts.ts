import { mkdir, writeFile, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactConfig } from '@sentinel/shared';
import type { BrowserEngine, PageHandle } from './types.js';

export class ArtifactManager {
  private readonly config: ArtifactConfig;

  constructor(config: ArtifactConfig) {
    this.config = config;
  }

  async captureFailureScreenshot(
    engine: BrowserEngine,
    pageHandle: PageHandle,
    metadata: { testName: string; stepName: string },
  ): Promise<string> {
    const screenshotDir = join(this.config.outputDir, 'screenshots');
    await mkdir(screenshotDir, { recursive: true });
    const filename = this.generateFilename(metadata.testName, metadata.stepName, 'png');
    const filePath = join(screenshotDir, filename);
    const buffer = await engine.screenshot(pageHandle, { fullPage: false, type: 'png' });
    await writeFile(filePath, buffer);
    return filePath;
  }

  generateFilename(testName: string, stepName: string, extension: string): string {
    const sanitize = (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, '-');
    const timestamp = Date.now();
    return `${sanitize(testName)}_${sanitize(stepName)}_${String(timestamp)}.${extension}`;
  }

  async enforceRetention(): Promise<void> {
    const screenshotDir = join(this.config.outputDir, 'screenshots');
    const videoDir = join(this.config.outputDir, 'videos');
    const files = await this.collectFiles(screenshotDir, videoDir);
    const maxBytes = this.config.maxRetentionMb * 1024 * 1024;
    let totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    files.sort((a, b) => a.mtimeMs - b.mtimeMs);
    for (const file of files) {
      if (totalBytes <= maxBytes) break;
      await unlink(file.path);
      totalBytes -= file.size;
    }
  }

  private async collectFiles(
    ...dirs: string[]
  ): Promise<Array<{ path: string; size: number; mtimeMs: number }>> {
    const results: Array<{ path: string; size: number; mtimeMs: number }> = [];
    for (const dir of dirs) {
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        const filePath = join(dir, entry);
        try {
          const fileStat = await stat(filePath);
          if (fileStat.isFile()) {
            results.push({ path: filePath, size: fileStat.size, mtimeMs: fileStat.mtimeMs });
          }
        } catch {
          continue;
        }
      }
    }
    return results;
  }
}
