import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadBrowserConfig } from '../config.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('loadBrowserConfig — defaults', () => {
  it('returns browserType=chromium when BROWSER_TYPE is not set', () => {
    const config = loadBrowserConfig();
    expect(config.browserType).toBe('chromium');
  });

  it('returns headless=true when BROWSER_HEADLESS is not set', () => {
    const config = loadBrowserConfig();
    expect(config.headless).toBe(true);
  });

  it('returns no deviceProfile when BROWSER_DEVICE is not set', () => {
    const config = loadBrowserConfig();
    expect(config.deviceProfile).toBeUndefined();
  });

  it('returns screenshotOnFailure=true when BROWSER_SCREENSHOT_ON_FAILURE is not set', () => {
    const config = loadBrowserConfig();
    expect(config.artifacts.screenshotOnFailure).toBe(true);
  });

  it('returns videoEnabled=false when BROWSER_VIDEO_ENABLED is not set', () => {
    const config = loadBrowserConfig();
    expect(config.artifacts.videoEnabled).toBe(false);
  });

  it('returns outputDir=./artifacts when BROWSER_ARTIFACT_DIR is not set', () => {
    const config = loadBrowserConfig();
    expect(config.artifacts.outputDir).toBe('./artifacts');
  });

  it('returns maxRetentionMb=500 when BROWSER_ARTIFACT_MAX_MB is not set', () => {
    const config = loadBrowserConfig();
    expect(config.artifacts.maxRetentionMb).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// BROWSER_TYPE
// ---------------------------------------------------------------------------

describe('loadBrowserConfig — BROWSER_TYPE', () => {
  it('reads chromium from BROWSER_TYPE', () => {
    vi.stubEnv('BROWSER_TYPE', 'chromium');
    const config = loadBrowserConfig();
    expect(config.browserType).toBe('chromium');
  });

  it('reads firefox from BROWSER_TYPE', () => {
    vi.stubEnv('BROWSER_TYPE', 'firefox');
    const config = loadBrowserConfig();
    expect(config.browserType).toBe('firefox');
  });

  it('reads webkit from BROWSER_TYPE', () => {
    vi.stubEnv('BROWSER_TYPE', 'webkit');
    const config = loadBrowserConfig();
    expect(config.browserType).toBe('webkit');
  });

  it('throws on invalid BROWSER_TYPE with descriptive message', () => {
    vi.stubEnv('BROWSER_TYPE', 'edge');
    expect(() => loadBrowserConfig()).toThrow(
      'BROWSER_TYPE must be one of: chromium, firefox, webkit',
    );
  });
});

// ---------------------------------------------------------------------------
// BROWSER_HEADLESS
// ---------------------------------------------------------------------------

describe('loadBrowserConfig — BROWSER_HEADLESS', () => {
  it('returns headless=false when BROWSER_HEADLESS=false', () => {
    vi.stubEnv('BROWSER_HEADLESS', 'false');
    const config = loadBrowserConfig();
    expect(config.headless).toBe(false);
  });

  it('returns headless=true when BROWSER_HEADLESS=true', () => {
    vi.stubEnv('BROWSER_HEADLESS', 'true');
    const config = loadBrowserConfig();
    expect(config.headless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BROWSER_DEVICE
// ---------------------------------------------------------------------------

describe('loadBrowserConfig — BROWSER_DEVICE', () => {
  it('reads deviceProfile from BROWSER_DEVICE', () => {
    vi.stubEnv('BROWSER_DEVICE', 'iPhone 13');
    const config = loadBrowserConfig();
    expect(config.deviceProfile).toBe('iPhone 13');
  });
});

// ---------------------------------------------------------------------------
// BROWSER_SCREENSHOT_ON_FAILURE
// ---------------------------------------------------------------------------

describe('loadBrowserConfig — BROWSER_SCREENSHOT_ON_FAILURE', () => {
  it('returns screenshotOnFailure=false when BROWSER_SCREENSHOT_ON_FAILURE=false', () => {
    vi.stubEnv('BROWSER_SCREENSHOT_ON_FAILURE', 'false');
    const config = loadBrowserConfig();
    expect(config.artifacts.screenshotOnFailure).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BROWSER_VIDEO_ENABLED
// ---------------------------------------------------------------------------

describe('loadBrowserConfig — BROWSER_VIDEO_ENABLED', () => {
  it('returns videoEnabled=true when BROWSER_VIDEO_ENABLED=true', () => {
    vi.stubEnv('BROWSER_VIDEO_ENABLED', 'true');
    const config = loadBrowserConfig();
    expect(config.artifacts.videoEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BROWSER_ARTIFACT_DIR
// ---------------------------------------------------------------------------

describe('loadBrowserConfig — BROWSER_ARTIFACT_DIR', () => {
  it('reads outputDir from BROWSER_ARTIFACT_DIR', () => {
    vi.stubEnv('BROWSER_ARTIFACT_DIR', '/tmp/sentinel-artifacts');
    const config = loadBrowserConfig();
    expect(config.artifacts.outputDir).toBe('/tmp/sentinel-artifacts');
  });
});

// ---------------------------------------------------------------------------
// BROWSER_ARTIFACT_MAX_MB
// ---------------------------------------------------------------------------

describe('loadBrowserConfig — BROWSER_ARTIFACT_MAX_MB', () => {
  it('reads maxRetentionMb from BROWSER_ARTIFACT_MAX_MB', () => {
    vi.stubEnv('BROWSER_ARTIFACT_MAX_MB', '1024');
    const config = loadBrowserConfig();
    expect(config.artifacts.maxRetentionMb).toBe(1024);
  });

  it('throws on non-numeric BROWSER_ARTIFACT_MAX_MB', () => {
    vi.stubEnv('BROWSER_ARTIFACT_MAX_MB', 'not-a-number');
    expect(() => loadBrowserConfig()).toThrow('BROWSER_ARTIFACT_MAX_MB must be a positive number');
  });

  it('throws on negative BROWSER_ARTIFACT_MAX_MB', () => {
    vi.stubEnv('BROWSER_ARTIFACT_MAX_MB', '-100');
    expect(() => loadBrowserConfig()).toThrow('BROWSER_ARTIFACT_MAX_MB must be a positive number');
  });

  it('throws on zero BROWSER_ARTIFACT_MAX_MB', () => {
    vi.stubEnv('BROWSER_ARTIFACT_MAX_MB', '0');
    expect(() => loadBrowserConfig()).toThrow('BROWSER_ARTIFACT_MAX_MB must be a positive number');
  });
});
