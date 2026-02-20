# Browser Engine Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `@sentinel/browser` package with a BrowserEngine abstraction and Playwright implementation covering multi-browser, headless/headed, device emulation, screenshots/video, and network interception.

**Architecture:** New `packages/browser` workspace package. Pure data types in `@sentinel/shared/src/browser/`. BrowserEngine interface + Playwright implementation in `packages/browser`. Opaque handle pattern keeps the interface library-agnostic.

**Tech Stack:** TypeScript strict mode, Playwright, Vitest, pnpm workspace

---

### Task 1: Scaffold `@sentinel/browser` package

**Files:**
- Create: `packages/browser/package.json`
- Create: `packages/browser/tsconfig.json`
- Create: `packages/browser/vitest.config.ts`
- Create: `packages/browser/src/index.ts` (empty barrel)
- Modify: `tsconfig.json` (root — add path alias)
- Modify: `tsconfig.build.json` (add project reference)
- Modify: `vitest.config.ts` (root — add project + alias)

**Step 1: Create `packages/browser/package.json`**

```json
{
  "name": "@sentinel/browser",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc --build",
    "clean": "tsc --build --clean",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@sentinel/shared": "workspace:*",
    "playwright": "^1.52.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create `packages/browser/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

**Step 3: Create `packages/browser/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    name: "@sentinel/browser",
    environment: "node",
    reporters: [
      "default",
      ["junit", { outputFile: "./test-results/junit.xml" }],
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["node_modules", "dist", "**/*.test.ts", "**/__tests__/**"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@sentinel/shared": resolve(__dirname, "../shared/src/index.ts"),
      "@sentinel/browser": resolve(__dirname, "./src/index.ts"),
    },
  },
});
```

**Step 4: Create empty barrel `packages/browser/src/index.ts`**

```typescript
/**
 * @sentinel/browser
 *
 * Browser automation abstraction layer for the Sentinel QA platform.
 */
```

**Step 5: Add path alias to root `tsconfig.json`**

Add `"@sentinel/browser": ["./packages/browser/src/index.ts"]` to `compilerOptions.paths`.

**Step 6: Add project reference to `tsconfig.build.json`**

Add `{ "path": "./packages/browser" }` after `./packages/core` in the references array.

**Step 7: Add project + alias to root `vitest.config.ts`**

Add alias: `"@sentinel/browser": resolve(root, "packages/browser/src/index.ts")`

Add project:
```typescript
{
  extends: true,
  test: {
    name: "@sentinel/browser",
    include: ["packages/browser/src/**/*.test.ts"],
  },
},
```

**Step 8: Install dependencies**

Run: `pnpm install`

**Step 9: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 10: Commit**

```
feat(browser): scaffold @sentinel/browser package (#3)
```

---

### Task 2: Add shared browser types to `@sentinel/shared`

**Files:**
- Create: `packages/shared/src/browser/types.ts`
- Create: `packages/shared/src/browser/index.ts`
- Modify: `packages/shared/src/index.ts` (add re-exports)
- Create: `packages/shared/src/__tests__/browser.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/browser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  BrowserType,
  BrowserConfig,
  ArtifactConfig,
  DeviceProfile,
} from '../browser/index.js';

describe('browser types', () => {
  it('BrowserType accepts chromium', () => {
    const browser: BrowserType = 'chromium';
    expect(browser).toBe('chromium');
  });

  it('BrowserType accepts firefox', () => {
    const browser: BrowserType = 'firefox';
    expect(browser).toBe('firefox');
  });

  it('BrowserType accepts webkit', () => {
    const browser: BrowserType = 'webkit';
    expect(browser).toBe('webkit');
  });

  it('ArtifactConfig shape is correct', () => {
    const config: ArtifactConfig = {
      screenshotOnFailure: true,
      videoEnabled: false,
      outputDir: './artifacts',
      maxRetentionMb: 500,
    };

    expect(config.screenshotOnFailure).toBe(true);
    expect(config.outputDir).toBe('./artifacts');
  });

  it('BrowserConfig shape is correct', () => {
    const config: BrowserConfig = {
      browserType: 'chromium',
      headless: true,
      artifacts: {
        screenshotOnFailure: true,
        videoEnabled: false,
        outputDir: './artifacts',
        maxRetentionMb: 500,
      },
    };

    expect(config.browserType).toBe('chromium');
    expect(config.headless).toBe(true);
    expect(config.deviceProfile).toBeUndefined();
  });

  it('BrowserConfig accepts optional deviceProfile', () => {
    const config: BrowserConfig = {
      browserType: 'firefox',
      headless: false,
      deviceProfile: 'iPhone 14',
      artifacts: {
        screenshotOnFailure: true,
        videoEnabled: true,
        outputDir: './output',
        maxRetentionMb: 1000,
      },
    };

    expect(config.deviceProfile).toBe('iPhone 14');
  });

  it('DeviceProfile shape is correct', () => {
    const device: DeviceProfile = {
      name: 'iPhone 14',
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; ...)',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    };

    expect(device.name).toBe('iPhone 14');
    expect(device.viewport.width).toBe(390);
    expect(device.isMobile).toBe(true);
    expect(device.hasTouch).toBe(true);
  });
});

describe('browser type exports from @sentinel/shared', () => {
  it('imports BrowserType from shared index without error', async () => {
    const shared = await import('../index.js');
    // Type re-exports are validated at compile time; runtime check confirms the module resolves
    expect(shared).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/shared/src/__tests__/browser.test.ts`
Expected: FAIL — cannot resolve `../browser/index.js`

**Step 3: Create `packages/shared/src/browser/types.ts`**

```typescript
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
```

**Step 4: Create `packages/shared/src/browser/index.ts`**

```typescript
export type {
  BrowserType,
  BrowserConfig,
  ArtifactConfig,
  DeviceProfile,
} from './types.js';
```

**Step 5: Add re-exports to `packages/shared/src/index.ts`**

Add at the bottom:

```typescript
export type {
  BrowserType,
  BrowserConfig,
  ArtifactConfig,
  DeviceProfile,
} from './browser/index.js';
```

**Step 6: Run test to verify it passes**

Run: `pnpm vitest run packages/shared/src/__tests__/browser.test.ts`
Expected: PASS

**Step 7: Run full shared test suite**

Run: `pnpm vitest run --project @sentinel/shared`
Expected: All pass

**Step 8: Commit**

```
feat(shared): add browser engine types (#3)
```

---

### Task 3: Browser config loading

**Files:**
- Create: `packages/browser/src/config.ts`
- Create: `packages/browser/src/__tests__/config.test.ts`
- Modify: `packages/browser/src/index.ts` (export)

**Step 1: Write the failing test**

Create `packages/browser/src/__tests__/config.test.ts`:

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadBrowserConfig } from '../config.js';

describe('loadBrowserConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns defaults when no env vars are set', () => {
    const config = loadBrowserConfig();

    expect(config.browserType).toBe('chromium');
    expect(config.headless).toBe(true);
    expect(config.deviceProfile).toBeUndefined();
    expect(config.artifacts.screenshotOnFailure).toBe(true);
    expect(config.artifacts.videoEnabled).toBe(false);
    expect(config.artifacts.outputDir).toBe('./artifacts');
    expect(config.artifacts.maxRetentionMb).toBe(500);
  });

  it('reads BROWSER_TYPE from env', () => {
    vi.stubEnv('BROWSER_TYPE', 'firefox');
    const config = loadBrowserConfig();
    expect(config.browserType).toBe('firefox');
  });

  it('reads BROWSER_TYPE webkit from env', () => {
    vi.stubEnv('BROWSER_TYPE', 'webkit');
    const config = loadBrowserConfig();
    expect(config.browserType).toBe('webkit');
  });

  it('throws on invalid BROWSER_TYPE', () => {
    vi.stubEnv('BROWSER_TYPE', 'opera');
    expect(() => loadBrowserConfig()).toThrow('BROWSER_TYPE must be one of: chromium, firefox, webkit');
  });

  it('reads BROWSER_HEADLESS=false from env', () => {
    vi.stubEnv('BROWSER_HEADLESS', 'false');
    const config = loadBrowserConfig();
    expect(config.headless).toBe(false);
  });

  it('reads BROWSER_HEADLESS=true from env', () => {
    vi.stubEnv('BROWSER_HEADLESS', 'true');
    const config = loadBrowserConfig();
    expect(config.headless).toBe(true);
  });

  it('reads BROWSER_DEVICE from env', () => {
    vi.stubEnv('BROWSER_DEVICE', 'iPhone 14');
    const config = loadBrowserConfig();
    expect(config.deviceProfile).toBe('iPhone 14');
  });

  it('reads BROWSER_SCREENSHOT_ON_FAILURE=false from env', () => {
    vi.stubEnv('BROWSER_SCREENSHOT_ON_FAILURE', 'false');
    const config = loadBrowserConfig();
    expect(config.artifacts.screenshotOnFailure).toBe(false);
  });

  it('reads BROWSER_VIDEO_ENABLED=true from env', () => {
    vi.stubEnv('BROWSER_VIDEO_ENABLED', 'true');
    const config = loadBrowserConfig();
    expect(config.artifacts.videoEnabled).toBe(true);
  });

  it('reads BROWSER_ARTIFACT_DIR from env', () => {
    vi.stubEnv('BROWSER_ARTIFACT_DIR', '/tmp/output');
    const config = loadBrowserConfig();
    expect(config.artifacts.outputDir).toBe('/tmp/output');
  });

  it('reads BROWSER_ARTIFACT_MAX_MB from env', () => {
    vi.stubEnv('BROWSER_ARTIFACT_MAX_MB', '1000');
    const config = loadBrowserConfig();
    expect(config.artifacts.maxRetentionMb).toBe(1000);
  });

  it('throws on non-numeric BROWSER_ARTIFACT_MAX_MB', () => {
    vi.stubEnv('BROWSER_ARTIFACT_MAX_MB', 'abc');
    expect(() => loadBrowserConfig()).toThrow('BROWSER_ARTIFACT_MAX_MB must be a positive number');
  });

  it('throws on negative BROWSER_ARTIFACT_MAX_MB', () => {
    vi.stubEnv('BROWSER_ARTIFACT_MAX_MB', '-10');
    expect(() => loadBrowserConfig()).toThrow('BROWSER_ARTIFACT_MAX_MB must be a positive number');
  });

  it('throws on zero BROWSER_ARTIFACT_MAX_MB', () => {
    vi.stubEnv('BROWSER_ARTIFACT_MAX_MB', '0');
    expect(() => loadBrowserConfig()).toThrow('BROWSER_ARTIFACT_MAX_MB must be a positive number');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/browser/src/__tests__/config.test.ts`
Expected: FAIL — cannot resolve `../config.js`

**Step 3: Create `packages/browser/src/config.ts`**

```typescript
import type { BrowserConfig, BrowserType } from '@sentinel/shared';

const VALID_BROWSER_TYPES: readonly BrowserType[] = ['chromium', 'firefox', 'webkit'] as const;

const nodeEnv =
  (
    (globalThis as Record<string, unknown>)['process'] as
      | { env: Record<string, string | undefined> }
      | undefined
  )?.env ?? {};

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

/** Loads browser configuration from environment variables with sensible defaults. */
export function loadBrowserConfig(): BrowserConfig {
  const browserTypeRaw = nodeEnv['BROWSER_TYPE'] ?? 'chromium';
  if (!VALID_BROWSER_TYPES.includes(browserTypeRaw as BrowserType)) {
    throw new Error(
      `BROWSER_TYPE must be one of: ${VALID_BROWSER_TYPES.join(', ')}. Received: "${browserTypeRaw}"`,
    );
  }
  const browserType = browserTypeRaw as BrowserType;

  const headless = parseBool(nodeEnv['BROWSER_HEADLESS'], true);
  const deviceProfile = nodeEnv['BROWSER_DEVICE'] || undefined;

  const screenshotOnFailure = parseBool(nodeEnv['BROWSER_SCREENSHOT_ON_FAILURE'], true);
  const videoEnabled = parseBool(nodeEnv['BROWSER_VIDEO_ENABLED'], false);
  const outputDir = nodeEnv['BROWSER_ARTIFACT_DIR'] ?? './artifacts';

  const maxRetentionRaw = nodeEnv['BROWSER_ARTIFACT_MAX_MB'];
  let maxRetentionMb = 500;
  if (maxRetentionRaw !== undefined && maxRetentionRaw !== '') {
    const parsed = Number(maxRetentionRaw);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(
        `BROWSER_ARTIFACT_MAX_MB must be a positive number. Received: "${maxRetentionRaw}"`,
      );
    }
    maxRetentionMb = parsed;
  }

  return {
    browserType,
    headless,
    ...(deviceProfile !== undefined && { deviceProfile }),
    artifacts: {
      screenshotOnFailure,
      videoEnabled,
      outputDir,
      maxRetentionMb,
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/browser/src/__tests__/config.test.ts`
Expected: PASS

**Step 5: Add export to barrel**

Add to `packages/browser/src/index.ts`:

```typescript
export { loadBrowserConfig } from './config.js';
```

**Step 6: Commit**

```
feat(browser): add browser config loading from env vars (#3)
```

---

### Task 4: Device profiles registry

**Files:**
- Create: `packages/browser/src/devices.ts`
- Create: `packages/browser/src/__tests__/devices.test.ts`
- Modify: `packages/browser/src/index.ts` (export)

**Step 1: Write the failing test**

Create `packages/browser/src/__tests__/devices.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getDeviceProfile, listDeviceProfiles } from '../devices.js';

describe('device profiles', () => {
  it('returns iPhone 14 profile', () => {
    const device = getDeviceProfile('iPhone 14');
    expect(device.name).toBe('iPhone 14');
    expect(device.viewport.width).toBe(390);
    expect(device.viewport.height).toBe(844);
    expect(device.isMobile).toBe(true);
    expect(device.hasTouch).toBe(true);
    expect(device.deviceScaleFactor).toBe(3);
  });

  it('returns Pixel 7 profile', () => {
    const device = getDeviceProfile('Pixel 7');
    expect(device.name).toBe('Pixel 7');
    expect(device.isMobile).toBe(true);
    expect(device.hasTouch).toBe(true);
  });

  it('returns Desktop 1920x1080 profile', () => {
    const device = getDeviceProfile('Desktop 1920x1080');
    expect(device.viewport.width).toBe(1920);
    expect(device.viewport.height).toBe(1080);
    expect(device.isMobile).toBe(false);
    expect(device.hasTouch).toBe(false);
  });

  it('lookup is case-insensitive', () => {
    const device = getDeviceProfile('iphone 14');
    expect(device.name).toBe('iPhone 14');
  });

  it('throws for unknown device profile', () => {
    expect(() => getDeviceProfile('Nokia 3310')).toThrow(
      'Unknown device profile: "Nokia 3310"',
    );
  });

  it('listDeviceProfiles returns at least 10 profiles', () => {
    const profiles = listDeviceProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(10);
  });

  it('all profiles have required fields', () => {
    const profiles = listDeviceProfiles();
    for (const profile of profiles) {
      expect(profile.name).toBeTruthy();
      expect(profile.viewport.width).toBeGreaterThan(0);
      expect(profile.viewport.height).toBeGreaterThan(0);
      expect(profile.userAgent).toBeTruthy();
      expect(profile.deviceScaleFactor).toBeGreaterThan(0);
      expect(typeof profile.isMobile).toBe('boolean');
      expect(typeof profile.hasTouch).toBe('boolean');
    }
  });

  it('each profile has a unique name', () => {
    const profiles = listDeviceProfiles();
    const names = profiles.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/browser/src/__tests__/devices.test.ts`
Expected: FAIL — cannot resolve `../devices.js`

**Step 3: Create `packages/browser/src/devices.ts`**

```typescript
import type { DeviceProfile } from '@sentinel/shared';

const BUILT_IN_DEVICES: readonly DeviceProfile[] = [
  {
    name: 'iPhone 14',
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iPhone 14 Pro Max',
    viewport: { width: 430, height: 932 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iPhone SE',
    viewport: { width: 375, height: 667 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iPad Pro 12.9',
    viewport: { width: 1024, height: 1366 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'iPad Mini',
    viewport: { width: 768, height: 1024 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'Pixel 7',
    viewport: { width: 412, height: 915 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'Pixel 7 Pro',
    viewport: { width: 412, height: 892 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'Samsung Galaxy S23',
    viewport: { width: 360, height: 780 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'Galaxy Tab S8',
    viewport: { width: 800, height: 1280 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'Desktop 1920x1080',
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
] as const;

const deviceMap = new Map<string, DeviceProfile>(
  BUILT_IN_DEVICES.map((d) => [d.name.toLowerCase(), d]),
);

/**
 * Looks up a device profile by name (case-insensitive).
 * Throws if the name is not found in the built-in or custom profile registry.
 */
export function getDeviceProfile(name: string): DeviceProfile {
  const profile = deviceMap.get(name.toLowerCase());
  if (!profile) {
    throw new Error(
      `Unknown device profile: "${name}". Available profiles: ${BUILT_IN_DEVICES.map((d) => d.name).join(', ')}`,
    );
  }
  return profile;
}

/** Returns all registered device profiles. */
export function listDeviceProfiles(): readonly DeviceProfile[] {
  return BUILT_IN_DEVICES;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/browser/src/__tests__/devices.test.ts`
Expected: PASS

**Step 5: Add exports to barrel**

Add to `packages/browser/src/index.ts`:

```typescript
export { getDeviceProfile, listDeviceProfiles } from './devices.js';
```

**Step 6: Commit**

```
feat(browser): add built-in device profile registry (#3)
```

---

### Task 5: BrowserEngine interface and handle types

**Files:**
- Create: `packages/browser/src/types.ts`
- Create: `packages/browser/src/__tests__/types.test.ts`
- Modify: `packages/browser/src/index.ts` (export)

**Step 1: Write the failing test**

Create `packages/browser/src/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  BrowserEngine,
  PageHandle,
  BrowserContextHandle,
  BrowserLaunchConfig,
  ContextOptions,
  NavigationOptions,
  ClickOptions,
  TypeOptions,
  WaitOptions,
  ScreenshotOptions,
  VideoOptions,
  NetworkRequest,
  NetworkResponse,
  RequestAction,
  RequestInterceptor,
  ResponseInterceptor,
  HarEntry,
  HarArchive,
} from '../types.js';

describe('browser engine types', () => {
  it('PageHandle is a branded string', () => {
    const handle = 'page-1' as PageHandle;
    expect(handle).toBe('page-1');
  });

  it('BrowserContextHandle is a branded string', () => {
    const handle = 'ctx-1' as BrowserContextHandle;
    expect(handle).toBe('ctx-1');
  });

  it('BrowserLaunchConfig shape is correct', () => {
    const config: BrowserLaunchConfig = {
      browserType: 'chromium',
      headless: true,
    };
    expect(config.browserType).toBe('chromium');
  });

  it('NavigationOptions shape is correct', () => {
    const options: NavigationOptions = {
      timeout: 30000,
      waitUntil: 'networkidle',
    };
    expect(options.timeout).toBe(30000);
  });

  it('ScreenshotOptions shape is correct', () => {
    const options: ScreenshotOptions = {
      fullPage: true,
      type: 'png',
    };
    expect(options.fullPage).toBe(true);
  });

  it('NetworkRequest shape is correct', () => {
    const req: NetworkRequest = {
      url: 'https://example.com',
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      resourceType: 'fetch',
    };
    expect(req.url).toBe('https://example.com');
    expect(req.body).toBeUndefined();
  });

  it('RequestAction continue shape is correct', () => {
    const action: RequestAction = { action: 'continue' };
    expect(action.action).toBe('continue');
  });

  it('RequestAction abort shape is correct', () => {
    const action: RequestAction = { action: 'abort', reason: 'blocked' };
    expect(action.action).toBe('abort');
  });

  it('RequestAction fulfill shape is correct', () => {
    const action: RequestAction = {
      action: 'fulfill',
      status: 200,
      body: '{"ok":true}',
    };
    expect(action.action).toBe('fulfill');
  });

  it('HarEntry shape is correct', () => {
    const entry: HarEntry = {
      request: {
        url: 'https://example.com',
        method: 'GET',
        headers: {},
        resourceType: 'document',
      },
      response: {
        url: 'https://example.com',
        status: 200,
        headers: {},
      },
      startedAt: new Date(),
      duration: 150,
    };
    expect(entry.duration).toBe(150);
  });

  it('HarArchive shape is correct', () => {
    const archive: HarArchive = {
      entries: [],
    };
    expect(archive.entries).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/browser/src/__tests__/types.test.ts`
Expected: FAIL — cannot resolve `../types.js`

**Step 3: Create `packages/browser/src/types.ts`**

```typescript
import type { BrowserType } from '@sentinel/shared';

// ---------------------------------------------------------------------------
// Branded handle types — keep the interface library-agnostic
// ---------------------------------------------------------------------------

declare const __pageHandle: unique symbol;
/** Opaque handle identifying a browser page. Obtained from `createPage`. */
export type PageHandle = string & { readonly [__pageHandle]: never };

declare const __contextHandle: unique symbol;
/** Opaque handle identifying a browser context. Obtained from `createContext`. */
export type BrowserContextHandle = string & { readonly [__contextHandle]: never };

// ---------------------------------------------------------------------------
// Launch & context configuration
// ---------------------------------------------------------------------------

export interface BrowserLaunchConfig {
  readonly browserType: BrowserType;
  readonly headless: boolean;
  readonly executablePath?: string;
}

export interface ContextOptions {
  readonly deviceProfile?: string;
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly userAgent?: string;
  readonly locale?: string;
  readonly timezoneId?: string;
  readonly isMobile?: boolean;
  readonly hasTouch?: boolean;
}

// ---------------------------------------------------------------------------
// Navigation & interaction options
// ---------------------------------------------------------------------------

export interface NavigationOptions {
  readonly timeout?: number;
  readonly waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
}

export interface ClickOptions {
  readonly button?: 'left' | 'right' | 'middle';
  readonly clickCount?: number;
  readonly timeout?: number;
}

export interface TypeOptions {
  readonly delay?: number;
  readonly timeout?: number;
}

export interface WaitOptions {
  readonly state?: 'attached' | 'detached' | 'visible' | 'hidden';
  readonly timeout?: number;
}

// ---------------------------------------------------------------------------
// Screenshot & video options
// ---------------------------------------------------------------------------

export interface ScreenshotOptions {
  readonly fullPage?: boolean;
  readonly type?: 'png' | 'jpeg';
  readonly quality?: number;
  readonly path?: string;
}

export interface VideoOptions {
  readonly dir: string;
  readonly size?: { readonly width: number; readonly height: number };
}

// ---------------------------------------------------------------------------
// Network interception types
// ---------------------------------------------------------------------------

export interface NetworkRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly resourceType: string;
}

export interface NetworkResponse {
  readonly url: string;
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

export type RequestAction =
  | { readonly action: 'continue' }
  | {
      readonly action: 'continue';
      readonly overrides: Partial<Pick<NetworkRequest, 'url' | 'method' | 'headers' | 'body'>>;
    }
  | { readonly action: 'abort'; readonly reason?: string }
  | {
      readonly action: 'fulfill';
      readonly status: number;
      readonly headers?: Record<string, string>;
      readonly body?: string;
    };

export type RequestInterceptor = (request: NetworkRequest) => Promise<RequestAction>;

export type ResponseInterceptor = (
  request: NetworkRequest,
  response: NetworkResponse,
) => Promise<void>;

export interface HarEntry {
  readonly request: NetworkRequest;
  readonly response: NetworkResponse;
  readonly startedAt: Date;
  readonly duration: number;
}

export interface HarArchive {
  readonly entries: readonly HarEntry[];
}

// ---------------------------------------------------------------------------
// BrowserEngine interface
// ---------------------------------------------------------------------------

/** Abstraction over browser automation libraries (Playwright, Puppeteer, etc.). */
export interface BrowserEngine {
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
  waitForSelector(
    pageHandle: PageHandle,
    selector: string,
    options?: WaitOptions,
  ): Promise<void>;
  evaluate<T>(pageHandle: PageHandle, fn: string | (() => T)): Promise<T>;

  // Artifacts
  screenshot(pageHandle: PageHandle, options?: ScreenshotOptions): Promise<Buffer>;
  startVideoRecording(
    contextHandle: BrowserContextHandle,
    options?: VideoOptions,
  ): Promise<void>;
  stopVideoRecording(contextHandle: BrowserContextHandle): Promise<string>;

  // Network interception
  onRequest(
    contextHandle: BrowserContextHandle,
    handler: RequestInterceptor,
  ): Promise<void>;
  onResponse(
    contextHandle: BrowserContextHandle,
    handler: ResponseInterceptor,
  ): Promise<void>;
  removeInterceptors(contextHandle: BrowserContextHandle): Promise<void>;
  exportHar(contextHandle: BrowserContextHandle): Promise<HarArchive>;

  // Metadata
  browserType(): BrowserType;
  browserVersion(): Promise<string>;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/browser/src/__tests__/types.test.ts`
Expected: PASS

**Step 5: Add exports to barrel**

Add to `packages/browser/src/index.ts`:

```typescript
export type {
  BrowserEngine,
  PageHandle,
  BrowserContextHandle,
  BrowserLaunchConfig,
  ContextOptions,
  NavigationOptions,
  ClickOptions,
  TypeOptions,
  WaitOptions,
  ScreenshotOptions,
  VideoOptions,
  NetworkRequest,
  NetworkResponse,
  RequestAction,
  RequestInterceptor,
  ResponseInterceptor,
  HarEntry,
  HarArchive,
} from './types.js';
```

**Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 7: Commit**

```
feat(browser): add BrowserEngine interface and handle types (#3)
```

---

### Task 6: Playwright engine — lifecycle, context, and page management

**Files:**
- Create: `packages/browser/src/playwright/engine.ts`
- Create: `packages/browser/src/playwright/index.ts`
- Create: `packages/browser/src/__tests__/engine.test.ts`
- Modify: `packages/browser/src/index.ts` (export)

**Step 1: Write the failing test**

Create `packages/browser/src/__tests__/engine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Browser, BrowserContext, Page } from 'playwright';
import { PlaywrightBrowserEngine } from '../playwright/engine.js';
import type { PageHandle, BrowserContextHandle } from '../types.js';

// ---------------------------------------------------------------------------
// Playwright mock factory
// ---------------------------------------------------------------------------

function makeMockPage(): Page {
  return {
    url: vi.fn().mockReturnValue('about:blank'),
    goto: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    goBack: vi.fn().mockResolvedValue(undefined),
    goForward: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('png-data')),
    close: vi.fn().mockResolvedValue(undefined),
    video: vi.fn().mockReturnValue(null),
  } as unknown as Page;
}

function makeMockContext(page?: Page): BrowserContext {
  const mockPage = page ?? makeMockPage();
  return {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
    route: vi.fn().mockResolvedValue(undefined),
    unrouteAll: vi.fn().mockResolvedValue(undefined),
    pages: vi.fn().mockReturnValue([]),
  } as unknown as BrowserContext;
}

function makeMockBrowser(context?: BrowserContext): Browser {
  const mockContext = context ?? makeMockContext();
  return {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
    version: vi.fn().mockReturnValue('116.0.5845.96'),
  } as unknown as Browser;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlaywrightBrowserEngine — lifecycle', () => {
  let engine: PlaywrightBrowserEngine;
  let mockBrowser: Browser;

  beforeEach(() => {
    mockBrowser = makeMockBrowser();
    engine = new PlaywrightBrowserEngine();
  });

  it('launch creates a browser instance', async () => {
    const launchFn = vi.fn().mockResolvedValue(mockBrowser);
    engine = new PlaywrightBrowserEngine({ launchFn });

    await engine.launch({ browserType: 'chromium', headless: true });

    expect(launchFn).toHaveBeenCalledWith({
      headless: true,
      executablePath: undefined,
    });
  });

  it('close shuts down the browser', async () => {
    const launchFn = vi.fn().mockResolvedValue(mockBrowser);
    engine = new PlaywrightBrowserEngine({ launchFn });

    await engine.launch({ browserType: 'chromium', headless: true });
    await engine.close();

    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('close before launch is a no-op', async () => {
    await expect(engine.close()).resolves.toBeUndefined();
  });

  it('browserType returns the configured type', async () => {
    const launchFn = vi.fn().mockResolvedValue(mockBrowser);
    engine = new PlaywrightBrowserEngine({ launchFn });
    await engine.launch({ browserType: 'firefox', headless: true });

    expect(engine.browserType()).toBe('firefox');
  });

  it('browserVersion returns the browser version string', async () => {
    const launchFn = vi.fn().mockResolvedValue(mockBrowser);
    engine = new PlaywrightBrowserEngine({ launchFn });
    await engine.launch({ browserType: 'chromium', headless: true });

    const version = await engine.browserVersion();
    expect(version).toBe('116.0.5845.96');
  });
});

describe('PlaywrightBrowserEngine — context and page management', () => {
  let engine: PlaywrightBrowserEngine;
  let mockBrowser: Browser;
  let mockContext: BrowserContext;
  let mockPage: Page;

  beforeEach(async () => {
    mockPage = makeMockPage();
    mockContext = makeMockContext(mockPage);
    mockBrowser = makeMockBrowser(mockContext);

    const launchFn = vi.fn().mockResolvedValue(mockBrowser);
    engine = new PlaywrightBrowserEngine({ launchFn });
    await engine.launch({ browserType: 'chromium', headless: true });
  });

  it('createContext returns a context handle', async () => {
    const handle = await engine.createContext();
    expect(handle).toBeTruthy();
    expect(typeof handle).toBe('string');
  });

  it('createPage returns a page handle', async () => {
    const ctxHandle = await engine.createContext();
    const pageHandle = await engine.createPage(ctxHandle);
    expect(pageHandle).toBeTruthy();
    expect(typeof pageHandle).toBe('string');
  });

  it('closePage calls page.close()', async () => {
    const ctxHandle = await engine.createContext();
    const pageHandle = await engine.createPage(ctxHandle);
    await engine.closePage(pageHandle);
    expect(mockPage.close).toHaveBeenCalled();
  });

  it('closeContext calls context.close()', async () => {
    const ctxHandle = await engine.createContext();
    await engine.closeContext(ctxHandle);
    expect(mockContext.close).toHaveBeenCalled();
  });

  it('throws when creating a page with an invalid context handle', async () => {
    await expect(
      engine.createPage('invalid-ctx' as BrowserContextHandle),
    ).rejects.toThrow('Unknown context handle');
  });

  it('throws when closing a page with an invalid page handle', async () => {
    await expect(
      engine.closePage('invalid-page' as PageHandle),
    ).rejects.toThrow('Unknown page handle');
  });
});

describe('PlaywrightBrowserEngine — navigation', () => {
  let engine: PlaywrightBrowserEngine;
  let mockPage: Page;
  let pageHandle: PageHandle;

  beforeEach(async () => {
    mockPage = makeMockPage();
    const mockContext = makeMockContext(mockPage);
    const mockBrowser = makeMockBrowser(mockContext);
    const launchFn = vi.fn().mockResolvedValue(mockBrowser);

    engine = new PlaywrightBrowserEngine({ launchFn });
    await engine.launch({ browserType: 'chromium', headless: true });

    const ctxHandle = await engine.createContext();
    pageHandle = await engine.createPage(ctxHandle);
  });

  it('navigate calls page.goto with url', async () => {
    await engine.navigate(pageHandle, 'https://example.com');
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', undefined);
  });

  it('navigate passes options to page.goto', async () => {
    await engine.navigate(pageHandle, 'https://example.com', {
      timeout: 5000,
      waitUntil: 'networkidle',
    });
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
      timeout: 5000,
      waitUntil: 'networkidle',
    });
  });

  it('reload calls page.reload', async () => {
    await engine.reload(pageHandle);
    expect(mockPage.reload).toHaveBeenCalled();
  });

  it('goBack calls page.goBack', async () => {
    await engine.goBack(pageHandle);
    expect(mockPage.goBack).toHaveBeenCalled();
  });

  it('goForward calls page.goForward', async () => {
    await engine.goForward(pageHandle);
    expect(mockPage.goForward).toHaveBeenCalled();
  });

  it('currentUrl returns page.url()', () => {
    (mockPage.url as ReturnType<typeof vi.fn>).mockReturnValue('https://example.com/page');
    expect(engine.currentUrl(pageHandle)).toBe('https://example.com/page');
  });
});

describe('PlaywrightBrowserEngine — interaction', () => {
  let engine: PlaywrightBrowserEngine;
  let mockPage: Page;
  let pageHandle: PageHandle;

  beforeEach(async () => {
    mockPage = makeMockPage();
    const mockContext = makeMockContext(mockPage);
    const mockBrowser = makeMockBrowser(mockContext);
    const launchFn = vi.fn().mockResolvedValue(mockBrowser);

    engine = new PlaywrightBrowserEngine({ launchFn });
    await engine.launch({ browserType: 'chromium', headless: true });

    const ctxHandle = await engine.createContext();
    pageHandle = await engine.createPage(ctxHandle);
  });

  it('click calls page.click with selector', async () => {
    await engine.click(pageHandle, '#submit');
    expect(mockPage.click).toHaveBeenCalledWith('#submit', undefined);
  });

  it('type calls page.fill with selector and text', async () => {
    await engine.type(pageHandle, '#email', 'test@example.com');
    expect(mockPage.fill).toHaveBeenCalledWith('#email', 'test@example.com', undefined);
  });

  it('selectOption calls page.selectOption', async () => {
    await engine.selectOption(pageHandle, '#country', ['US']);
    expect(mockPage.selectOption).toHaveBeenCalledWith('#country', ['US']);
  });

  it('waitForSelector calls page.waitForSelector', async () => {
    await engine.waitForSelector(pageHandle, '.loaded');
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loaded', undefined);
  });

  it('evaluate calls page.evaluate', async () => {
    (mockPage.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue('result');
    const result = await engine.evaluate(pageHandle, 'document.title');
    expect(result).toBe('result');
    expect(mockPage.evaluate).toHaveBeenCalledWith('document.title');
  });

  it('screenshot calls page.screenshot and returns buffer', async () => {
    const result = await engine.screenshot(pageHandle);
    expect(result).toBeInstanceOf(Buffer);
    expect(mockPage.screenshot).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/browser/src/__tests__/engine.test.ts`
Expected: FAIL — cannot resolve `../playwright/engine.js`

**Step 3: Create `packages/browser/src/playwright/engine.ts`**

```typescript
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import type { BrowserType } from '@sentinel/shared';
import type {
  BrowserEngine,
  BrowserLaunchConfig,
  BrowserContextHandle,
  ContextOptions,
  PageHandle,
  NavigationOptions,
  ClickOptions,
  TypeOptions,
  WaitOptions,
  ScreenshotOptions,
  VideoOptions,
  NetworkRequest,
  NetworkResponse,
  RequestInterceptor,
  ResponseInterceptor,
  HarEntry,
  HarArchive,
} from '../types.js';
import { randomBytes } from 'node:crypto';

type LaunchFn = (options: {
  headless: boolean;
  executablePath: string | undefined;
}) => Promise<Browser>;

export interface PlaywrightEngineOptions {
  /** Override browser launch — primarily for testing with mocks. */
  readonly launchFn?: LaunchFn;
}

const browserLaunchers: Record<BrowserType, typeof chromium> = {
  chromium,
  firefox,
  webkit,
};

function generateHandle(): string {
  return randomBytes(8).toString('hex');
}

export class PlaywrightBrowserEngine implements BrowserEngine {
  private browser: Browser | null = null;
  private activeBrowserType: BrowserType = 'chromium';
  private readonly launchFn?: LaunchFn;

  private readonly contexts = new Map<string, BrowserContext>();
  private readonly pages = new Map<string, Page>();
  private readonly networkLogs = new Map<string, HarEntry[]>();
  private readonly requestInterceptors = new Map<string, RequestInterceptor[]>();
  private readonly responseInterceptors = new Map<string, ResponseInterceptor[]>();

  constructor(options?: PlaywrightEngineOptions) {
    this.launchFn = options?.launchFn;
  }

  // -- Lifecycle --------------------------------------------------------------

  async launch(config: BrowserLaunchConfig): Promise<void> {
    this.activeBrowserType = config.browserType;

    if (this.launchFn) {
      this.browser = await this.launchFn({
        headless: config.headless,
        executablePath: config.executablePath,
      });
    } else {
      const launcher = browserLaunchers[config.browserType];
      this.browser = await launcher.launch({
        headless: config.headless,
        executablePath: config.executablePath,
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.contexts.clear();
    this.pages.clear();
    this.networkLogs.clear();
    this.requestInterceptors.clear();
    this.responseInterceptors.clear();
  }

  // -- Context & pages --------------------------------------------------------

  async createContext(options?: ContextOptions): Promise<BrowserContextHandle> {
    this.requireBrowser();

    const contextOptions: Record<string, unknown> = {};
    if (options?.viewport) contextOptions['viewport'] = options.viewport;
    if (options?.userAgent) contextOptions['userAgent'] = options.userAgent;
    if (options?.locale) contextOptions['locale'] = options.locale;
    if (options?.timezoneId) contextOptions['timezoneId'] = options.timezoneId;
    if (options?.isMobile !== undefined) contextOptions['isMobile'] = options.isMobile;
    if (options?.hasTouch !== undefined) contextOptions['hasTouch'] = options.hasTouch;

    const context = await this.browser!.newContext(
      Object.keys(contextOptions).length > 0 ? contextOptions : undefined,
    );

    const handle = generateHandle() as BrowserContextHandle;
    this.contexts.set(handle, context);
    this.networkLogs.set(handle, []);
    this.requestInterceptors.set(handle, []);
    this.responseInterceptors.set(handle, []);
    return handle;
  }

  async createPage(contextHandle: BrowserContextHandle): Promise<PageHandle> {
    const context = this.requireContext(contextHandle);
    const page = await context.newPage();
    const handle = generateHandle() as PageHandle;
    this.pages.set(handle, page);
    return handle;
  }

  async closePage(pageHandle: PageHandle): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.close();
    this.pages.delete(pageHandle);
  }

  async closeContext(contextHandle: BrowserContextHandle): Promise<void> {
    const context = this.requireContext(contextHandle);
    await context.close();
    this.contexts.delete(contextHandle);
    this.networkLogs.delete(contextHandle);
    this.requestInterceptors.delete(contextHandle);
    this.responseInterceptors.delete(contextHandle);
  }

  // -- Navigation -------------------------------------------------------------

  async navigate(
    pageHandle: PageHandle,
    url: string,
    options?: NavigationOptions,
  ): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.goto(url, options as Parameters<Page['goto']>[1]);
  }

  async reload(pageHandle: PageHandle): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.reload();
  }

  async goBack(pageHandle: PageHandle): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.goBack();
  }

  async goForward(pageHandle: PageHandle): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.goForward();
  }

  currentUrl(pageHandle: PageHandle): string {
    const page = this.requirePage(pageHandle);
    return page.url();
  }

  // -- Interaction ------------------------------------------------------------

  async click(
    pageHandle: PageHandle,
    selector: string,
    options?: ClickOptions,
  ): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.click(selector, options as Parameters<Page['click']>[1]);
  }

  async type(
    pageHandle: PageHandle,
    selector: string,
    text: string,
    options?: TypeOptions,
  ): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.fill(selector, text, options as Parameters<Page['fill']>[2]);
  }

  async selectOption(
    pageHandle: PageHandle,
    selector: string,
    values: string[],
  ): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.selectOption(selector, values);
  }

  async waitForSelector(
    pageHandle: PageHandle,
    selector: string,
    options?: WaitOptions,
  ): Promise<void> {
    const page = this.requirePage(pageHandle);
    await page.waitForSelector(selector, options as Parameters<Page['waitForSelector']>[1]);
  }

  async evaluate<T>(
    pageHandle: PageHandle,
    fn: string | (() => T),
  ): Promise<T> {
    const page = this.requirePage(pageHandle);
    return page.evaluate(fn as Parameters<Page['evaluate']>[0]) as Promise<T>;
  }

  // -- Artifacts --------------------------------------------------------------

  async screenshot(
    pageHandle: PageHandle,
    options?: ScreenshotOptions,
  ): Promise<Buffer> {
    const page = this.requirePage(pageHandle);
    return page.screenshot(options as Parameters<Page['screenshot']>[0]) as Promise<Buffer>;
  }

  async startVideoRecording(
    contextHandle: BrowserContextHandle,
    _options?: VideoOptions,
  ): Promise<void> {
    // Video recording in Playwright is configured at context creation time.
    // This method is a placeholder that will be wired up when context creation
    // accepts video options in a future task.
    this.requireContext(contextHandle);
  }

  async stopVideoRecording(
    contextHandle: BrowserContextHandle,
  ): Promise<string> {
    const context = this.requireContext(contextHandle);
    const pages = context.pages();
    for (const page of pages) {
      const video = page.video();
      if (video) {
        const path = await video.path();
        return path;
      }
    }
    return '';
  }

  // -- Network interception ---------------------------------------------------

  async onRequest(
    contextHandle: BrowserContextHandle,
    handler: RequestInterceptor,
  ): Promise<void> {
    this.requireContext(contextHandle);
    const interceptors = this.requestInterceptors.get(contextHandle);
    interceptors?.push(handler);
  }

  async onResponse(
    contextHandle: BrowserContextHandle,
    handler: ResponseInterceptor,
  ): Promise<void> {
    this.requireContext(contextHandle);
    const interceptors = this.responseInterceptors.get(contextHandle);
    interceptors?.push(handler);
  }

  async removeInterceptors(
    contextHandle: BrowserContextHandle,
  ): Promise<void> {
    const context = this.requireContext(contextHandle);
    await context.unrouteAll();
    this.requestInterceptors.set(contextHandle, []);
    this.responseInterceptors.set(contextHandle, []);
  }

  async exportHar(
    contextHandle: BrowserContextHandle,
  ): Promise<HarArchive> {
    this.requireContext(contextHandle);
    const entries = this.networkLogs.get(contextHandle) ?? [];
    return { entries };
  }

  // -- Metadata ---------------------------------------------------------------

  browserType(): BrowserType {
    return this.activeBrowserType;
  }

  async browserVersion(): Promise<string> {
    this.requireBrowser();
    return this.browser!.version();
  }

  // -- Internal helpers -------------------------------------------------------

  private requireBrowser(): void {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }
  }

  private requireContext(handle: BrowserContextHandle): BrowserContext {
    const ctx = this.contexts.get(handle);
    if (!ctx) {
      throw new Error(`Unknown context handle: "${handle}"`);
    }
    return ctx;
  }

  private requirePage(handle: PageHandle): Page {
    const page = this.pages.get(handle);
    if (!page) {
      throw new Error(`Unknown page handle: "${handle}"`);
    }
    return page;
  }
}
```

**Step 4: Create `packages/browser/src/playwright/index.ts`**

```typescript
export { PlaywrightBrowserEngine } from './engine.js';
export type { PlaywrightEngineOptions } from './engine.js';
```

**Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/browser/src/__tests__/engine.test.ts`
Expected: PASS

**Step 6: Add exports to barrel**

Add to `packages/browser/src/index.ts`:

```typescript
export { PlaywrightBrowserEngine } from './playwright/index.js';
export type { PlaywrightEngineOptions } from './playwright/index.js';
```

**Step 7: Run full browser test suite + typecheck**

Run: `pnpm vitest run --project @sentinel/browser`
Run: `pnpm typecheck`
Expected: All pass

**Step 8: Commit**

```
feat(browser): add PlaywrightBrowserEngine implementation (#3)
```

---

### Task 7: Artifact manager

**Files:**
- Create: `packages/browser/src/artifacts.ts`
- Create: `packages/browser/src/__tests__/artifacts.test.ts`
- Modify: `packages/browser/src/index.ts` (export)

**Step 1: Write the failing test**

Create `packages/browser/src/__tests__/artifacts.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArtifactManager } from '../artifacts.js';
import type { BrowserEngine } from '../types.js';
import type { PageHandle } from '../types.js';
import type { ArtifactConfig } from '@sentinel/shared';
import { mkdir, writeFile, readdir, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeMockEngine(): BrowserEngine {
  return {
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot-data')),
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
}

describe('ArtifactManager', () => {
  let outputDir: string;
  let config: ArtifactConfig;
  let manager: ArtifactManager;

  beforeEach(async () => {
    outputDir = join(tmpdir(), `sentinel-test-artifacts-${Date.now()}`);
    await mkdir(outputDir, { recursive: true });

    config = {
      screenshotOnFailure: true,
      videoEnabled: false,
      outputDir,
      maxRetentionMb: 1,
    };
    manager = new ArtifactManager(config);
  });

  it('captureFailureScreenshot saves a screenshot file', async () => {
    const engine = makeMockEngine();
    const pageHandle = 'page-1' as PageHandle;

    const filePath = await manager.captureFailureScreenshot(engine, pageHandle, {
      testName: 'login-test',
      stepName: 'click-submit',
    });

    expect(filePath).toContain('login-test');
    expect(filePath).toContain('click-submit');
    expect(filePath).toMatch(/\.png$/);
    expect(engine.screenshot).toHaveBeenCalledWith(pageHandle, {
      fullPage: false,
      type: 'png',
    });
  });

  it('captureFailureScreenshot creates the output directory if missing', async () => {
    const deepDir = join(outputDir, 'nested', 'dir');
    const deepConfig: ArtifactConfig = { ...config, outputDir: deepDir };
    const deepManager = new ArtifactManager(deepConfig);
    const engine = makeMockEngine();

    const filePath = await deepManager.captureFailureScreenshot(
      engine,
      'page-1' as PageHandle,
      { testName: 'test', stepName: 'step' },
    );

    expect(filePath).toContain('test');

    // Clean up
    await rm(deepDir, { recursive: true, force: true });
  });

  it('generateFilename includes testName, stepName, and timestamp', () => {
    const filename = manager.generateFilename('my-test', 'my-step', 'png');
    expect(filename).toMatch(/^my-test_my-step_\d+\.png$/);
  });

  it('generateFilename sanitizes special characters in names', () => {
    const filename = manager.generateFilename('test/with:special', 'step<bad>', 'png');
    expect(filename).not.toContain('/');
    expect(filename).not.toContain(':');
    expect(filename).not.toContain('<');
    expect(filename).not.toContain('>');
  });

  // Clean up temp directory
  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true }).catch(() => {});
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/browser/src/__tests__/artifacts.test.ts`
Expected: FAIL — cannot resolve `../artifacts.js`

**Step 3: Create `packages/browser/src/artifacts.ts`**

```typescript
import { mkdir, writeFile, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactConfig } from '@sentinel/shared';
import type { BrowserEngine, PageHandle } from './types.js';

/**
 * Manages screenshot and video artifacts — file naming, storage, and retention enforcement.
 * The engine provides the capture primitives; this class handles the lifecycle policy.
 */
export class ArtifactManager {
  private readonly config: ArtifactConfig;

  constructor(config: ArtifactConfig) {
    this.config = config;
  }

  /**
   * Captures a screenshot on test step failure and writes it to the artifact directory.
   * Returns the absolute file path of the saved screenshot.
   */
  async captureFailureScreenshot(
    engine: BrowserEngine,
    pageHandle: PageHandle,
    metadata: { testName: string; stepName: string },
  ): Promise<string> {
    const screenshotDir = join(this.config.outputDir, 'screenshots');
    await mkdir(screenshotDir, { recursive: true });

    const filename = this.generateFilename(metadata.testName, metadata.stepName, 'png');
    const filePath = join(screenshotDir, filename);

    const buffer = await engine.screenshot(pageHandle, {
      fullPage: false,
      type: 'png',
    });
    await writeFile(filePath, buffer);

    return filePath;
  }

  /**
   * Generates a safe filename from test metadata.
   * Special characters are replaced with hyphens.
   */
  generateFilename(testName: string, stepName: string, extension: string): string {
    const sanitize = (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, '-');
    const timestamp = Date.now();
    return `${sanitize(testName)}_${sanitize(stepName)}_${timestamp}.${extension}`;
  }

  /**
   * Enforces the maximum retention size by removing the oldest artifact files
   * when the total size exceeds `config.maxRetentionMb`.
   */
  async enforceRetention(): Promise<void> {
    const screenshotDir = join(this.config.outputDir, 'screenshots');
    const videoDir = join(this.config.outputDir, 'videos');

    const files = await this.collectFiles(screenshotDir, videoDir);
    const maxBytes = this.config.maxRetentionMb * 1024 * 1024;

    let totalBytes = files.reduce((sum, f) => sum + f.size, 0);

    // Sort oldest-first for deletion
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
            results.push({
              path: filePath,
              size: fileStat.size,
              mtimeMs: fileStat.mtimeMs,
            });
          }
        } catch {
          continue;
        }
      }
    }

    return results;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/browser/src/__tests__/artifacts.test.ts`
Expected: PASS

**Step 5: Add export to barrel**

Add to `packages/browser/src/index.ts`:

```typescript
export { ArtifactManager } from './artifacts.js';
```

**Step 6: Commit**

```
feat(browser): add ArtifactManager for screenshot/video lifecycle (#3)
```

---

### Task 8: Network interception helpers

**Files:**
- Create: `packages/browser/src/playwright/network.ts`
- Create: `packages/browser/src/__tests__/network.test.ts`
- Modify: `packages/browser/src/playwright/index.ts` (export)
- Modify: `packages/browser/src/index.ts` (export)

**Step 1: Write the failing test**

Create `packages/browser/src/__tests__/network.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NetworkLog } from '../playwright/network.js';
import type { NetworkRequest, NetworkResponse, HarEntry } from '../types.js';

describe('NetworkLog', () => {
  it('starts empty', () => {
    const log = new NetworkLog();
    expect(log.entries()).toHaveLength(0);
  });

  it('records a request-response pair', () => {
    const log = new NetworkLog();
    const request: NetworkRequest = {
      url: 'https://api.example.com/users',
      method: 'GET',
      headers: { accept: 'application/json' },
      resourceType: 'fetch',
    };
    const response: NetworkResponse = {
      url: 'https://api.example.com/users',
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '[]',
    };

    log.record(request, response, 150);

    const entries = log.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.request.url).toBe('https://api.example.com/users');
    expect(entries[0]!.response.status).toBe(200);
    expect(entries[0]!.duration).toBe(150);
  });

  it('records multiple entries in order', () => {
    const log = new NetworkLog();

    log.record(
      { url: '/first', method: 'GET', headers: {}, resourceType: 'document' },
      { url: '/first', status: 200, headers: {} },
      100,
    );
    log.record(
      { url: '/second', method: 'POST', headers: {}, resourceType: 'fetch' },
      { url: '/second', status: 201, headers: {} },
      200,
    );

    expect(log.entries()).toHaveLength(2);
    expect(log.entries()[0]!.request.url).toBe('/first');
    expect(log.entries()[1]!.request.url).toBe('/second');
  });

  it('exportHar returns a HarArchive with all entries', () => {
    const log = new NetworkLog();
    log.record(
      { url: '/test', method: 'GET', headers: {}, resourceType: 'fetch' },
      { url: '/test', status: 200, headers: {} },
      50,
    );

    const archive = log.exportHar();

    expect(archive.entries).toHaveLength(1);
    expect(archive.entries[0]!.request.url).toBe('/test');
  });

  it('clear removes all entries', () => {
    const log = new NetworkLog();
    log.record(
      { url: '/test', method: 'GET', headers: {}, resourceType: 'fetch' },
      { url: '/test', status: 200, headers: {} },
      50,
    );

    log.clear();
    expect(log.entries()).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/browser/src/__tests__/network.test.ts`
Expected: FAIL — cannot resolve `../playwright/network.js`

**Step 3: Create `packages/browser/src/playwright/network.ts`**

```typescript
import type { NetworkRequest, NetworkResponse, HarEntry, HarArchive } from '../types.js';

/** Accumulates network request/response pairs observed during a browser context session. */
export class NetworkLog {
  private readonly log: HarEntry[] = [];

  /** Records a request-response pair with the measured duration in milliseconds. */
  record(request: NetworkRequest, response: NetworkResponse, duration: number): void {
    this.log.push({
      request,
      response,
      startedAt: new Date(),
      duration,
    });
  }

  /** Returns a snapshot of all recorded entries. */
  entries(): readonly HarEntry[] {
    return [...this.log];
  }

  /** Exports all recorded entries as a HarArchive. */
  exportHar(): HarArchive {
    return { entries: [...this.log] };
  }

  /** Clears all recorded entries. */
  clear(): void {
    this.log.length = 0;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run packages/browser/src/__tests__/network.test.ts`
Expected: PASS

**Step 5: Add exports**

Add to `packages/browser/src/playwright/index.ts`:

```typescript
export { NetworkLog } from './network.js';
```

Add to `packages/browser/src/index.ts`:

```typescript
export { NetworkLog } from './playwright/index.js';
```

**Step 6: Commit**

```
feat(browser): add NetworkLog for request/response tracking (#3)
```

---

### Task 9: Update `.env.example`, monorepo wiring, and CLAUDE.md

**Files:**
- Modify: `.env.example` (add browser env vars)
- Modify: `CLAUDE.md` (add browser package to directory structure)

**Step 1: Add browser environment variables to `.env.example`**

Append after the Redis section:

```
# -----------------------------------------------------------------------------
# Browser automation (packages/browser)
# -----------------------------------------------------------------------------

# Browser engine: chromium | firefox | webkit
BROWSER_TYPE=chromium

# Run browsers in headless mode. Set to "false" for visible debugging.
BROWSER_HEADLESS=true

# Device profile for emulation (e.g., "iPhone 14", "Pixel 7").
# Leave empty for default desktop viewport.
# BROWSER_DEVICE=

# Capture a screenshot automatically on step failure.
BROWSER_SCREENSHOT_ON_FAILURE=true

# Record video of each test run. Produces .webm files.
BROWSER_VIDEO_ENABLED=false

# Directory for screenshot and video artifacts.
BROWSER_ARTIFACT_DIR=./artifacts

# Maximum artifact storage in MB. Oldest files are pruned when exceeded.
BROWSER_ARTIFACT_MAX_MB=500
```

**Step 2: Update CLAUDE.md directory structure**

Add the `browser` package entry to the annotated directory structure, after the `core` entry:

```
│   ├── browser/          # @sentinel/browser — browser automation abstraction and Playwright implementation
│   │   └── src/
│   │       ├── index.ts          # Public API: BrowserEngine, PlaywrightBrowserEngine, config, devices, artifacts, network
│   │       ├── types.ts          # BrowserEngine interface, PageHandle, BrowserContextHandle, network types
│   │       ├── config.ts         # loadBrowserConfig() — reads BROWSER_* env vars, validates
│   │       ├── devices.ts        # Built-in device profiles (10+) and getDeviceProfile() lookup
│   │       ├── artifacts.ts      # ArtifactManager — screenshot/video file lifecycle and retention
│   │       ├── playwright/
│   │       │   ├── index.ts      # Barrel for Playwright implementation
│   │       │   ├── engine.ts     # PlaywrightBrowserEngine implements BrowserEngine
│   │       │   └── network.ts    # NetworkLog — request/response accumulation and HAR export
│   │       └── __tests__/
│   │           ├── config.test.ts    # Unit tests for browser config loading
│   │           ├── devices.test.ts   # Unit tests for device profile registry
│   │           ├── engine.test.ts    # Unit tests for PlaywrightBrowserEngine (mocked Playwright)
│   │           ├── artifacts.test.ts # Unit tests for ArtifactManager
│   │           ├── network.test.ts   # Unit tests for NetworkLog
│   │           └── types.test.ts     # Type-level tests for BrowserEngine interface
```

Also add to shared directory structure under `src/`:

```
│   │       ├── browser/
│   │       │   ├── types.ts      # BrowserType, BrowserConfig, ArtifactConfig, DeviceProfile
│   │       │   └── index.ts      # Barrel re-export for browser/
```

**Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass across all projects

**Step 4: Run typecheck and lint**

Run: `pnpm typecheck`
Run: `pnpm lint`
Expected: No errors

**Step 5: Commit**

```
docs: update env example and CLAUDE.md for browser package (#3)
```

---

### Task 10: Final verification and PR

**Step 1: Run full test suite with coverage**

Run: `pnpm test:coverage`
Expected: All tests pass, coverage meets 80% thresholds

**Step 2: Run lint + format**

Run: `pnpm lint:fix`
Run: `pnpm format`

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: Clean

**Step 4: Create PR**

Title: `feat(browser): web automation & browser engine infrastructure (#3)`

Body should reference:
- Epic #3 and sub-stories #30, #31, #32, #33, #34, #35
- New `@sentinel/browser` package
- BrowserEngine abstraction with Playwright implementation
- Config, device profiles, artifact management, network logging
