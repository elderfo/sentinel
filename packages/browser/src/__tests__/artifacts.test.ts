import { describe, it, expect, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, access, mkdir, writeFile } from 'node:fs/promises';
import { ArtifactManager } from '../artifacts.js';
import type { BrowserEngine, PageHandle } from '../types.js';
import type { ArtifactConfig } from '@sentinel/shared';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface MockEngineResult {
  engine: BrowserEngine;
  screenshotMock: ReturnType<typeof vi.fn>;
}

function makeMockEngine(): MockEngineResult {
  const screenshotMock = vi.fn().mockResolvedValue(Buffer.from('fake-screenshot-data'));
  const engine: BrowserEngine = {
    launch: vi.fn(),
    close: vi.fn(),
    createContext: vi.fn(),
    createPage: vi.fn(),
    closePage: vi.fn(),
    closeContext: vi.fn(),
    navigate: vi.fn(),
    reload: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    currentUrl: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    selectOption: vi.fn(),
    waitForSelector: vi.fn(),
    evaluate: vi.fn(),
    screenshot: screenshotMock,
    startVideoRecording: vi.fn(),
    stopVideoRecording: vi.fn(),
    onRequest: vi.fn(),
    onResponse: vi.fn(),
    removeInterceptors: vi.fn(),
    exportHar: vi.fn(),
    browserType: vi.fn(),
    browserVersion: vi.fn(),
  };
  return { engine, screenshotMock };
}

function makeArtifactConfig(outputDir: string): ArtifactConfig {
  return {
    screenshotOnFailure: true,
    videoEnabled: false,
    outputDir,
    maxRetentionMb: 100,
  };
}

// Opaque handle cast helper — PageHandle is a branded string type.
const asPageHandle = (s: string) => s as unknown as PageHandle;

// ---------------------------------------------------------------------------
// captureFailureScreenshot
// ---------------------------------------------------------------------------

describe('ArtifactManager.captureFailureScreenshot', () => {
  const testDirs: string[] = [];

  afterEach(async () => {
    for (const dir of testDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    testDirs.length = 0;
  });

  it('calls engine.screenshot with correct options', async () => {
    const outDir = join(tmpdir(), `sentinel-test-${String(Date.now())}`);
    testDirs.push(outDir);

    const { engine, screenshotMock } = makeMockEngine();
    const manager = new ArtifactManager(makeArtifactConfig(outDir));
    const pageHandle = asPageHandle('page-1');

    await manager.captureFailureScreenshot(engine, pageHandle, {
      testName: 'loginFlow',
      stepName: 'clickSubmit',
    });

    expect(screenshotMock).toHaveBeenCalledOnce();
    expect(screenshotMock).toHaveBeenCalledWith(pageHandle, { fullPage: false, type: 'png' });
  });

  it('returns a path that contains testName, stepName, and ends in .png', async () => {
    const outDir = join(tmpdir(), `sentinel-test-${String(Date.now())}`);
    testDirs.push(outDir);

    const { engine } = makeMockEngine();
    const manager = new ArtifactManager(makeArtifactConfig(outDir));
    const pageHandle = asPageHandle('page-1');

    const filePath = await manager.captureFailureScreenshot(engine, pageHandle, {
      testName: 'myTest',
      stepName: 'myStep',
    });

    expect(filePath).toContain('myTest');
    expect(filePath).toContain('myStep');
    expect(filePath).toMatch(/\.png$/);
  });

  it('creates the output directory if it does not exist', async () => {
    const outDir = join(tmpdir(), `sentinel-test-${String(Date.now())}`, 'nested', 'dir');
    testDirs.push(join(tmpdir(), outDir.split('/')[4] ?? outDir));

    const { engine } = makeMockEngine();
    const manager = new ArtifactManager(makeArtifactConfig(outDir));
    const pageHandle = asPageHandle('page-1');

    const filePath = await manager.captureFailureScreenshot(engine, pageHandle, {
      testName: 'dirTest',
      stepName: 'dirStep',
    });

    // The file should be accessible (i.e., the directory was created).
    await expect(access(filePath)).resolves.toBeUndefined();
  });

  it('writes the screenshot buffer to the returned file path', async () => {
    const outDir = join(tmpdir(), `sentinel-test-${String(Date.now())}`);
    testDirs.push(outDir);

    const { readFile } = await import('node:fs/promises');
    const { engine } = makeMockEngine();
    const manager = new ArtifactManager(makeArtifactConfig(outDir));
    const pageHandle = asPageHandle('page-1');

    const filePath = await manager.captureFailureScreenshot(engine, pageHandle, {
      testName: 'writeTest',
      stepName: 'writeStep',
    });

    const content = await readFile(filePath);
    expect(content).toEqual(Buffer.from('fake-screenshot-data'));
  });
});

// ---------------------------------------------------------------------------
// generateFilename
// ---------------------------------------------------------------------------

describe('ArtifactManager.generateFilename', () => {
  const manager = new ArtifactManager(makeArtifactConfig(join(tmpdir(), 'sentinel-filename-test')));

  it('includes testName, stepName, and timestamp in the filename', () => {
    const filename = manager.generateFilename('testname', 'stepname', 'png');
    expect(filename).toMatch(/^testname_stepname_\d+\.png$/);
  });

  it('sanitizes forward slashes in testName', () => {
    const filename = manager.generateFilename('test/name', 'step', 'png');
    expect(filename).not.toContain('/');
  });

  it('sanitizes colons in stepName', () => {
    const filename = manager.generateFilename('test', 'step:name', 'png');
    expect(filename).not.toContain(':');
  });

  it('sanitizes angle brackets in testName', () => {
    const filename = manager.generateFilename('test<name>', 'step', 'png');
    expect(filename).not.toContain('<');
    expect(filename).not.toContain('>');
  });

  it('sanitizes special characters and produces a valid filename pattern', () => {
    const filename = manager.generateFilename('my/test:suite', 'step<1>', 'png');
    expect(filename).not.toMatch(/[/:<>]/);
    expect(filename).toMatch(/^[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+_\d+\.png$/);
  });
});

// ---------------------------------------------------------------------------
// enforceRetention
// ---------------------------------------------------------------------------

describe('ArtifactManager.enforceRetention', () => {
  const testDirs: string[] = [];

  afterEach(async () => {
    for (const dir of testDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    testDirs.length = 0;
  });

  async function createFile(
    dir: string,
    name: string,
    sizeBytes: number,
    ageMsOffset = 0,
  ): Promise<void> {
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, name);
    await writeFile(filePath, Buffer.alloc(sizeBytes, 'x'));
    // Set mtime to a specific time so sorting is deterministic
    const { utimes } = await import('node:fs/promises');
    const mtime = new Date(Date.now() - ageMsOffset);
    await utimes(filePath, mtime, mtime);
  }

  it('deletes oldest files when total exceeds maxRetentionMb', async () => {
    const outDir = join(tmpdir(), `sentinel-retention-${String(Date.now())}`);
    testDirs.push(outDir);
    const screenshotDir = join(outDir, 'screenshots');

    // maxRetentionMb = 1 means max 1MB (1048576 bytes)
    // Create 3 files: 500KB each = 1.5MB total, exceeding the 1MB limit
    const config: ArtifactConfig = {
      screenshotOnFailure: true,
      videoEnabled: false,
      outputDir: outDir,
      maxRetentionMb: 1,
    };
    const manager = new ArtifactManager(config);

    // oldest file (created 3 seconds ago)
    await createFile(screenshotDir, 'oldest.png', 500 * 1024, 3000);
    // middle file (created 2 seconds ago)
    await createFile(screenshotDir, 'middle.png', 500 * 1024, 2000);
    // newest file (created 1 second ago)
    await createFile(screenshotDir, 'newest.png', 500 * 1024, 1000);

    await manager.enforceRetention();

    // oldest should be deleted (500KB removed -> 1MB remaining, still under limit? No: 1.5MB - 500KB = 1MB which is equal, so should stop)
    // Actually: totalBytes starts at 1536000 (1.5MB), maxBytes = 1048576 (1MB)
    // Delete oldest: totalBytes = 1024000, still > 1048576? No: 1024000 < 1048576, so stop
    // Wait, 500 * 1024 = 512000 each, total = 1536000, 1536000 - 512000 = 1024000, 1024000 < 1048576, so only oldest deleted
    await expect(access(join(screenshotDir, 'oldest.png'))).rejects.toThrow();
    await expect(access(join(screenshotDir, 'middle.png'))).resolves.toBeUndefined();
    await expect(access(join(screenshotDir, 'newest.png'))).resolves.toBeUndefined();
  });

  it('does not delete files when under the retention limit', async () => {
    const outDir = join(tmpdir(), `sentinel-retention-${String(Date.now())}`);
    testDirs.push(outDir);
    const screenshotDir = join(outDir, 'screenshots');

    const config: ArtifactConfig = {
      screenshotOnFailure: true,
      videoEnabled: false,
      outputDir: outDir,
      maxRetentionMb: 100,
    };
    const manager = new ArtifactManager(config);

    await createFile(screenshotDir, 'file1.png', 1024, 2000);
    await createFile(screenshotDir, 'file2.png', 1024, 1000);

    await manager.enforceRetention();

    await expect(access(join(screenshotDir, 'file1.png'))).resolves.toBeUndefined();
    await expect(access(join(screenshotDir, 'file2.png'))).resolves.toBeUndefined();
  });

  it('handles non-existent directories gracefully', async () => {
    const outDir = join(tmpdir(), `sentinel-retention-${String(Date.now())}`);
    testDirs.push(outDir);

    const config: ArtifactConfig = {
      screenshotOnFailure: true,
      videoEnabled: false,
      outputDir: outDir,
      maxRetentionMb: 1,
    };
    const manager = new ArtifactManager(config);

    // Should not throw when directories don't exist
    await expect(manager.enforceRetention()).resolves.toBeUndefined();
  });

  it('prunes across both screenshots and videos directories', async () => {
    const outDir = join(tmpdir(), `sentinel-retention-${String(Date.now())}`);
    testDirs.push(outDir);
    const screenshotDir = join(outDir, 'screenshots');
    const videoDir = join(outDir, 'videos');

    const config: ArtifactConfig = {
      screenshotOnFailure: true,
      videoEnabled: true,
      outputDir: outDir,
      maxRetentionMb: 1,
    };
    const manager = new ArtifactManager(config);

    // Oldest file in videos, newer file in screenshots
    await createFile(videoDir, 'old-video.webm', 600 * 1024, 3000);
    await createFile(screenshotDir, 'new-screenshot.png', 600 * 1024, 1000);

    // Total: 1.2MB, limit: 1MB — oldest (old-video.webm) should be deleted
    await manager.enforceRetention();

    await expect(access(join(videoDir, 'old-video.webm'))).rejects.toThrow();
    await expect(access(join(screenshotDir, 'new-screenshot.png'))).resolves.toBeUndefined();
  });
});
