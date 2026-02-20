/**
 * @sentinel/browser
 *
 * Browser automation abstraction layer for the Sentinel QA platform.
 */

export { loadBrowserConfig } from './config.js';
export { getDeviceProfile, listDeviceProfiles } from './devices.js';
export { ArtifactManager } from './artifacts.js';
export { NetworkLog, PlaywrightBrowserEngine } from './playwright/index.js';
export type { PlaywrightEngineOptions } from './playwright/index.js';

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
