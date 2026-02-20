import { describe, it, expect } from 'vitest';
import type {
  BrowserType,
  BrowserConfig,
  ArtifactConfig,
  DeviceProfile,
} from '../browser/index.js';

// ---------------------------------------------------------------------------
// Type-level tests — verified via TypeScript compilation, not runtime assertions
// ---------------------------------------------------------------------------

describe('browser types', () => {
  it('BrowserType accepts chromium', () => {
    const browserType: BrowserType = 'chromium';

    expect(browserType).toBe('chromium');
  });

  it('BrowserType accepts firefox', () => {
    const browserType: BrowserType = 'firefox';

    expect(browserType).toBe('firefox');
  });

  it('BrowserType accepts webkit', () => {
    const browserType: BrowserType = 'webkit';

    expect(browserType).toBe('webkit');
  });

  it('ArtifactConfig shape is correct', () => {
    const artifacts: ArtifactConfig = {
      screenshotOnFailure: true,
      videoEnabled: false,
      outputDir: '/tmp/artifacts',
      maxRetentionMb: 500,
    };

    expect(artifacts.screenshotOnFailure).toBe(true);
    expect(artifacts.videoEnabled).toBe(false);
    expect(artifacts.outputDir).toBe('/tmp/artifacts');
    expect(artifacts.maxRetentionMb).toBe(500);
  });

  it('BrowserConfig shape is correct without optional deviceProfile', () => {
    const config: BrowserConfig = {
      browserType: 'chromium',
      headless: true,
      artifacts: {
        screenshotOnFailure: true,
        videoEnabled: false,
        outputDir: '/tmp/artifacts',
        maxRetentionMb: 500,
      },
    };

    expect(config.browserType).toBe('chromium');
    expect(config.headless).toBe(true);
    expect(config.deviceProfile).toBeUndefined();
  });

  it('BrowserConfig shape is correct with optional deviceProfile', () => {
    const config: BrowserConfig = {
      browserType: 'webkit',
      headless: false,
      deviceProfile: 'iPhone 14',
      artifacts: {
        screenshotOnFailure: false,
        videoEnabled: true,
        outputDir: '/tmp/video',
        maxRetentionMb: 1024,
      },
    };

    expect(config.deviceProfile).toBe('iPhone 14');
    expect(config.artifacts.videoEnabled).toBe(true);
  });

  it('DeviceProfile shape is correct with all fields', () => {
    const profile: DeviceProfile = {
      name: 'iPhone 14',
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    };

    expect(profile.name).toBe('iPhone 14');
    expect(profile.viewport.width).toBe(390);
    expect(profile.viewport.height).toBe(844);
    expect(profile.deviceScaleFactor).toBe(3);
    expect(profile.isMobile).toBe(true);
    expect(profile.hasTouch).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Re-export accessibility from the package root
// ---------------------------------------------------------------------------

describe('browser type exports from @sentinel/shared', () => {
  it('imports BrowserConfig type from browser index without error', () => {
    // If this file compiles the types are accessible — confirmed by TypeScript.
    const config: BrowserConfig = {
      browserType: 'firefox',
      headless: true,
      artifacts: {
        screenshotOnFailure: false,
        videoEnabled: false,
        outputDir: '/tmp/out',
        maxRetentionMb: 256,
      },
    };

    expect(config.browserType).toBe('firefox');
  });
});
