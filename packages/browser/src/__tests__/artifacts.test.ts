import { describe, it, expect, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm, access } from 'node:fs/promises';
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
