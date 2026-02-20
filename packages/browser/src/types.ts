import type { BrowserType } from '@sentinel/shared';

// ---------------------------------------------------------------------------
// Branded handle types — opaque string IDs that keep the interface library-agnostic.
// Implementations map these IDs to internal Playwright objects.
// ---------------------------------------------------------------------------

declare const __pageHandle: unique symbol;
/** Opaque handle identifying a Playwright Page instance within the engine. */
export type PageHandle = string & { readonly [__pageHandle]: never };

declare const __contextHandle: unique symbol;
/** Opaque handle identifying a Playwright BrowserContext instance within the engine. */
export type BrowserContextHandle = string & { readonly [__contextHandle]: never };

// ---------------------------------------------------------------------------
// Launch & context configuration
// ---------------------------------------------------------------------------

/** Full configuration required to launch a browser engine instance. */
export interface BrowserLaunchConfig {
  readonly browserType: BrowserType;
  readonly headless: boolean;
  readonly deviceProfile?: string;
}

/** Options applied when creating a new browser context. */
export interface ContextOptions {
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly userAgent?: string;
  readonly deviceScaleFactor?: number;
  readonly isMobile?: boolean;
  readonly hasTouch?: boolean;
  readonly locale?: string;
  readonly timezoneId?: string;
  readonly recordVideo?: boolean;
  readonly recordVideoDir?: string;
}

// ---------------------------------------------------------------------------
// Navigation, interaction, and wait options
// ---------------------------------------------------------------------------

/** Conditions that navigation can wait for before resolving. */
export type WaitUntilState = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

/** Options controlling navigation behaviour. */
export interface NavigationOptions {
  readonly timeout?: number;
  readonly waitUntil?: WaitUntilState;
}

/** Options for click interactions. */
export interface ClickOptions {
  readonly timeout?: number;
  readonly clickCount?: number;
  readonly delay?: number;
  readonly button?: 'left' | 'right' | 'middle';
  readonly force?: boolean;
}

/** Options for keyboard type interactions. */
export interface TypeOptions {
  readonly timeout?: number;
  readonly delay?: number;
}

/** Options for selector wait operations. */
export interface WaitOptions {
  readonly timeout?: number;
  readonly state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

// ---------------------------------------------------------------------------
// Artifact options
// ---------------------------------------------------------------------------

/** Options for screenshot capture. */
export interface ScreenshotOptions {
  readonly fullPage?: boolean;
  readonly type?: 'png' | 'jpeg';
  readonly quality?: number;
  readonly clip?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

/** Options for video recording. */
export interface VideoOptions {
  readonly outputDir: string;
  readonly size?: { readonly width: number; readonly height: number };
}

// ---------------------------------------------------------------------------
// Network interception types
// ---------------------------------------------------------------------------

/** Representation of an intercepted network request. */
export interface NetworkRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly resourceType: string;
}

/** Representation of an intercepted network response. */
export interface NetworkResponse {
  readonly url: string;
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

/**
 * Decision returned by a RequestInterceptor describing how the engine should
 * handle the outgoing request.
 */
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

/** Interceptor that can inspect and mutate (or abort/fulfill) outgoing requests. */
export type RequestInterceptor = (request: NetworkRequest) => Promise<RequestAction>;

/** Observe-only interceptor called after a response is received. */
export type ResponseInterceptor = (
  request: NetworkRequest,
  response: NetworkResponse,
) => Promise<void>;

// ---------------------------------------------------------------------------
// HAR types
// ---------------------------------------------------------------------------

/** A single entry in a HAR (HTTP Archive) log. */
export interface HarEntry {
  readonly startedDateTime: string;
  readonly time: number;
  readonly request: {
    readonly method: string;
    readonly url: string;
    readonly headers: ReadonlyArray<{ readonly name: string; readonly value: string }>;
    readonly bodySize: number;
    readonly postData?: { readonly mimeType: string; readonly text: string };
  };
  readonly response: {
    readonly status: number;
    readonly statusText: string;
    readonly headers: ReadonlyArray<{ readonly name: string; readonly value: string }>;
    readonly bodySize: number;
    readonly content: { readonly mimeType: string; readonly text?: string };
  };
  readonly timings: {
    readonly send: number;
    readonly wait: number;
    readonly receive: number;
  };
}

/** Complete HAR archive containing metadata and a list of entries. */
export interface HarArchive {
  readonly log: {
    readonly version: string;
    readonly creator: { readonly name: string; readonly version: string };
    readonly entries: ReadonlyArray<HarEntry>;
  };
}

// ---------------------------------------------------------------------------
// BrowserEngine interface
// ---------------------------------------------------------------------------

/**
 * Library-agnostic abstraction over a browser automation driver.
 *
 * Implementations map opaque PageHandle / BrowserContextHandle strings to
 * internal driver objects and fulfil the contract defined here.
 */
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
  type(
    pageHandle: PageHandle,
    selector: string,
    text: string,
    options?: TypeOptions,
  ): Promise<void>;
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
