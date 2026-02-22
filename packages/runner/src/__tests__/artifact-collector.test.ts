import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArtifactCollector } from '../worker/artifact-collector.js';
import type { BrowserEngine, PageHandle } from '@sentinel/browser';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Keep a separate reference to the screenshot mock so assertions don't trigger
// @typescript-eslint/unbound-method when accessing it through the typed object.
const screenshotFn = vi.fn().mockResolvedValue(Buffer.from('fake-png'));

const mockEngine: BrowserEngine = {
  screenshot: screenshotFn,
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
  startVideoRecording: vi.fn(),
  stopVideoRecording: vi.fn(),
  onRequest: vi.fn(),
  onResponse: vi.fn(),
  removeInterceptors: vi.fn(),
  exportHar: vi.fn(),
  browserType: vi.fn(),
  browserVersion: vi.fn(),
} as unknown as BrowserEngine;

const PAGE_HANDLE = 'page-1' as PageHandle;

describe('ArtifactCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createArtifactDir creates the directory structure', async () => {
    const { mkdir } = await import('node:fs/promises');
    const collector = new ArtifactCollector('./output');
    const dir = await collector.createArtifactDir('auth-suite', 'tc-1');

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('auth-suite'), { recursive: true });
    expect(dir).toContain('auth-suite');
    expect(dir).toContain('tc-1');
  });

  it('captureScreenshot calls engine.screenshot and writes file', async () => {
    const { writeFile } = await import('node:fs/promises');
    const collector = new ArtifactCollector('./output');
    const path = await collector.captureScreenshot(mockEngine, PAGE_HANDLE, './artifacts/tc-1');

    expect(screenshotFn).toHaveBeenCalledWith(PAGE_HANDLE);
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('failure-screenshot.png'),
      Buffer.from('fake-png'),
    );
    expect(path).toContain('failure-screenshot.png');
  });

  it('captureConsoleLogs writes console errors to file', async () => {
    const { writeFile } = await import('node:fs/promises');
    const collector = new ArtifactCollector('./output');
    const errors = ['Error: null reference', 'Warning: deprecated'];
    const path = await collector.captureConsoleLogs('./artifacts/tc-1', errors);

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('console.log'),
      'Error: null reference\nWarning: deprecated',
      'utf-8',
    );
    expect(path).toContain('console.log');
  });

  it('captureConsoleLogs returns undefined when no errors', async () => {
    const collector = new ArtifactCollector('./output');
    const path = await collector.captureConsoleLogs('./artifacts/tc-1', []);
    expect(path).toBeUndefined();
  });

  it('collectArtifacts returns complete TestArtifacts', async () => {
    const collector = new ArtifactCollector('./output');
    const artifacts = await collector.collectArtifacts(
      mockEngine,
      PAGE_HANDLE,
      'auth-suite',
      'tc-1',
      ['Console error'],
    );

    expect(artifacts.artifactDir).toContain('auth-suite');
    expect(artifacts.screenshotPath).toContain('failure-screenshot.png');
    expect(artifacts.logPath).toContain('console.log');
  });

  it('collectArtifacts returns undefined logPath when no console errors', async () => {
    const collector = new ArtifactCollector('./output');
    const artifacts = await collector.collectArtifacts(
      mockEngine,
      PAGE_HANDLE,
      'auth-suite',
      'tc-1',
      [],
    );

    expect(artifacts.logPath).toBeUndefined();
    expect(artifacts.screenshotPath).toBeDefined();
  });
});
