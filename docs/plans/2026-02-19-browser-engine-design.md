# Browser Engine Infrastructure Design

**Epic:** #3 — Create Web Automation & Browser Engine Infrastructure
**Date:** 2026-02-19
**Status:** Approved

## Summary

Establish a browser automation abstraction layer in a new `@sentinel/browser` package, with a Playwright implementation covering multi-browser support, headless/headed modes, device emulation, screenshot/video capture, and network interception.

## Decision: Playwright-Only With Abstraction

We build the `BrowserEngine` interface and a single Playwright implementation. The abstraction allows a Puppeteer (or other) implementation to be added later without changing consuming code. This avoids maintaining two implementations when Playwright already covers Chromium, Firefox, and WebKit natively.

## Architecture

### Approach: New `@sentinel/browser` Package

- Pure data types (`BrowserType`, `BrowserConfig`, `DeviceProfile`, `ArtifactConfig`) go in `@sentinel/shared`
- The `BrowserEngine` interface and Playwright implementation live in `@sentinel/browser`
- `@sentinel/browser` depends on `@sentinel/shared` and `playwright`
- `@sentinel/core` will depend on `@sentinel/browser` for orchestration (future)

### Package Structure

```
packages/browser/
├── package.json          # @sentinel/browser, depends on @sentinel/shared + playwright
├── tsconfig.json         # Project references to shared
├── vitest.config.ts      # Per-package test config
└── src/
    ├── index.ts              # Public API barrel
    ├── types.ts              # BrowserEngine interface, handle types, interceptor types
    ├── config.ts             # loadBrowserConfig() — reads env vars, validates
    ├── devices.ts            # Built-in device profiles (10+ common devices)
    ├── artifacts.ts          # ArtifactManager — screenshot/video lifecycle, retention
    ├── playwright/
    │   ├── index.ts          # Barrel for Playwright impl
    │   ├── engine.ts         # PlaywrightBrowserEngine implements BrowserEngine
    │   ├── artifacts.ts      # Playwright-specific screenshot + video capture
    │   └── network.ts        # Request/response interception, HAR export
    └── __tests__/
        ├── config.test.ts
        ├── devices.test.ts
        ├── engine.test.ts
        ├── artifacts.test.ts
        └── network.test.ts
```

### Shared Types (in `@sentinel/shared`)

Added to `packages/shared/src/browser/`:

```typescript
// Browser selection
type BrowserType = 'chromium' | 'firefox' | 'webkit';

// Top-level configuration
interface BrowserConfig {
  readonly browserType: BrowserType;
  readonly headless: boolean;
  readonly deviceProfile?: string;
  readonly artifacts: ArtifactConfig;
}

// Artifact storage settings
interface ArtifactConfig {
  readonly screenshotOnFailure: boolean;
  readonly videoEnabled: boolean;
  readonly outputDir: string;
  readonly maxRetentionMb: number;
}

// Device emulation profile
interface DeviceProfile {
  readonly name: string;
  readonly viewport: { width: number; height: number };
  readonly userAgent: string;
  readonly deviceScaleFactor: number;
  readonly isMobile: boolean;
  readonly hasTouch: boolean;
}
```

## BrowserEngine Interface

Methods are grouped by capability area. Opaque handles (`PageHandle`, `BrowserContextHandle`) keep the interface library-agnostic — they are branded string IDs that the engine maps internally.

```typescript
interface BrowserEngine {
  // Lifecycle
  launch(config: BrowserLaunchConfig): Promise<void>;
  close(): Promise<void>;

  // Context & pages
  createContext(options?: ContextOptions): Promise<BrowserContextHandle>;
  createPage(contextHandle: BrowserContextHandle): Promise<PageHandle>;
  closePage(pageHandle: PageHandle): Promise<void>;
  closeContext(contextHandle: BrowserContextHandle): Promise<void>;

  // Navigation
  navigate(pageHandle: PageHandle, url: string, options?: NavigationOptions): Promise<void>;
  reload(pageHandle: PageHandle): Promise<void>;
  goBack(pageHandle: PageHandle): Promise<void>;
  goForward(pageHandle: PageHandle): Promise<void>;
  currentUrl(pageHandle: PageHandle): string;

  // Interaction
  click(pageHandle: PageHandle, selector: string, options?: ClickOptions): Promise<void>;
  type(pageHandle: PageHandle, selector: string, text: string, options?: TypeOptions): Promise<void>;
  selectOption(pageHandle: PageHandle, selector: string, values: string[]): Promise<void>;
  waitForSelector(pageHandle: PageHandle, selector: string, options?: WaitOptions): Promise<void>;
  evaluate<T>(pageHandle: PageHandle, fn: string | (() => T)): Promise<T>;

  // Artifacts
  screenshot(pageHandle: PageHandle, options?: ScreenshotOptions): Promise<Buffer>;
  startVideoRecording(contextHandle: BrowserContextHandle, options?: VideoOptions): Promise<void>;
  stopVideoRecording(contextHandle: BrowserContextHandle): Promise<string>;

  // Network interception
  onRequest(contextHandle: BrowserContextHandle, handler: RequestInterceptor): Promise<void>;
  onResponse(contextHandle: BrowserContextHandle, handler: ResponseInterceptor): Promise<void>;
  removeInterceptors(contextHandle: BrowserContextHandle): Promise<void>;
  exportHar(contextHandle: BrowserContextHandle): Promise<HarArchive>;

  // Metadata
  browserType(): BrowserType;
  browserVersion(): Promise<string>;
}
```

## Configuration

`loadBrowserConfig()` reads environment variables and returns a validated `BrowserConfig`. Throws `BrowserConfigError` on invalid values. Follows the same pattern as `loadAuthConfig()` and `loadVaultConfig()`.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BROWSER_TYPE` | `chromium` | Browser engine: `chromium`, `firefox`, `webkit` |
| `BROWSER_HEADLESS` | `true` | Headless mode toggle |
| `BROWSER_DEVICE` | _(empty)_ | Device profile name for emulation |
| `BROWSER_SCREENSHOT_ON_FAILURE` | `true` | Auto-capture screenshot on step failure |
| `BROWSER_VIDEO_ENABLED` | `false` | Record video of test runs |
| `BROWSER_ARTIFACT_DIR` | `./artifacts` | Output directory for screenshots/videos |
| `BROWSER_ARTIFACT_MAX_MB` | `500` | Maximum artifact storage before pruning |

## Device Profiles

10+ built-in profiles sourced from Playwright's device descriptors:

- iPhone 14, iPhone 14 Pro Max, iPhone SE
- iPad Pro 12.9, iPad Mini
- Pixel 7, Pixel 7 Pro
- Samsung Galaxy S23, Galaxy Tab S8
- Desktop 1920x1080

Custom profiles can be defined in a `sentinel.devices.json` file at the project root. Custom profiles are merged with built-ins; name collisions favor the custom definition.

`getDeviceProfile(name: string)` looks up by name (case-insensitive), throws if not found.

## Artifacts

### ArtifactManager

Orchestrates screenshot/video lifecycle and retention policy. Not part of `BrowserEngine` — it's a separate class that uses the engine's primitives.

```typescript
class ArtifactManager {
  constructor(config: ArtifactConfig) {}

  captureFailureScreenshot(
    engine: BrowserEngine,
    pageHandle: PageHandle,
    metadata: { testName: string; stepName: string }
  ): Promise<string>;

  enforceRetention(): Promise<void>;
}
```

- Screenshot filenames: `{testName}_{stepName}_{timestamp}.png`
- Video filenames: `{testName}_{timestamp}.webm`
- Retention: prunes oldest files when `maxRetentionMb` is exceeded

### Video Recording

Context-scoped (matching Playwright's model). `startVideoRecording` is called when a context is created with video enabled; `stopVideoRecording` finalizes and returns the file path. Videos stored in `{outputDir}/videos/`.

## Network Interception

```typescript
interface NetworkRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly resourceType: string;
}

interface NetworkResponse {
  readonly url: string;
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

type RequestAction =
  | { action: 'continue' }
  | { action: 'continue'; overrides: Partial<Pick<NetworkRequest, 'url' | 'method' | 'headers' | 'body'>> }
  | { action: 'abort'; reason?: string }
  | { action: 'fulfill'; status: number; headers?: Record<string, string>; body?: string };

type RequestInterceptor = (request: NetworkRequest) => Promise<RequestAction>;
type ResponseInterceptor = (request: NetworkRequest, response: NetworkResponse) => Promise<void>;
```

- Request interceptors can continue, modify, abort, or fulfill (mock) requests
- Response interceptors are observe-only
- All intercepted traffic accumulates in a `NetworkLog` exportable as HAR
- HAR export uses Playwright's built-in recording capabilities

## Out of Scope

- Test runner integration (which framework triggers `captureFailureScreenshot`)
- CI artifact upload (pipeline config, not application code)
- Report linking (reporting layer concern)
- Puppeteer implementation (future, when needed)

## Story Coverage

| Story | Coverage |
|---|---|
| #30 BrowserEngine abstraction | Interface + Playwright implementation |
| #31 Headless/headed modes | `BROWSER_HEADLESS` env var, `BrowserConfig.headless` |
| #32 Screenshots/video | `ArtifactManager`, engine screenshot/video methods |
| #33 Device emulation | `DeviceProfile` registry, `BROWSER_DEVICE` config |
| #34 Network interception | Interceptor types, HAR export |
| #35 Multi-browser | `BrowserType` enum, Playwright's native Chromium/Firefox/WebKit |
