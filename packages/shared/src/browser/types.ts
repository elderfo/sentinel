/** Supported browser engines — maps to Playwright browser types. */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/** Top-level browser engine configuration loaded from environment variables. */
export interface BrowserConfig {
  readonly browserType: BrowserType;
  readonly headless: boolean;
  readonly deviceProfile?: string;
  readonly artifacts: ArtifactConfig;
}

/** Configuration for screenshot and video artifact storage. */
export interface ArtifactConfig {
  readonly screenshotOnFailure: boolean;
  readonly videoEnabled: boolean;
  readonly outputDir: string;
  readonly maxRetentionMb: number;
}

/** Device emulation profile for viewport, user agent, and input simulation. */
export interface DeviceProfile {
  readonly name: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly userAgent: string;
  readonly deviceScaleFactor: number;
  readonly isMobile: boolean;
  readonly hasTouch: boolean;
}
