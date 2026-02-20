import { describe, it, expect } from 'vitest';
import type {
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

// ---------------------------------------------------------------------------
// Type-level tests — verified via TypeScript compilation, not runtime assertions.
// Constructing a value of the target type proves the shape is accepted by the
// compiler; runtime assertions confirm field access behaves as expected.
// ---------------------------------------------------------------------------

describe('branded handle types', () => {
  it('PageHandle is a branded string', () => {
    // Cast a plain string to PageHandle to simulate what the engine returns.
    const handle = 'page-abc' as unknown as PageHandle;
    expect(typeof handle).toBe('string');
    expect(handle).toBe('page-abc');
  });

  it('BrowserContextHandle is a branded string', () => {
    const handle = 'ctx-xyz' as unknown as BrowserContextHandle;
    expect(typeof handle).toBe('string');
    expect(handle).toBe('ctx-xyz');
  });
});

describe('BrowserLaunchConfig shape', () => {
  it('accepts required fields without optional deviceProfile', () => {
    const config: BrowserLaunchConfig = {
      browserType: 'chromium',
      headless: true,
    };

    expect(config.browserType).toBe('chromium');
    expect(config.headless).toBe(true);
    expect(config.deviceProfile).toBeUndefined();
  });

  it('accepts optional deviceProfile', () => {
    const config: BrowserLaunchConfig = {
      browserType: 'firefox',
      headless: false,
      deviceProfile: 'iPhone 14',
    };

    expect(config.deviceProfile).toBe('iPhone 14');
  });

  it('accepts all BrowserType values', () => {
    const chromium: BrowserLaunchConfig = { browserType: 'chromium', headless: true };
    const firefox: BrowserLaunchConfig = { browserType: 'firefox', headless: true };
    const webkit: BrowserLaunchConfig = { browserType: 'webkit', headless: true };

    expect(chromium.browserType).toBe('chromium');
    expect(firefox.browserType).toBe('firefox');
    expect(webkit.browserType).toBe('webkit');
  });
});

describe('ContextOptions shape', () => {
  it('accepts a fully-populated options object', () => {
    const options: ContextOptions = {
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0',
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
      locale: 'en-US',
      timezoneId: 'America/Chicago',
      recordVideo: true,
    };

    expect(options.viewport?.width).toBe(1280);
    expect(options.locale).toBe('en-US');
  });

  it('accepts an empty options object (all fields optional)', () => {
    const options: ContextOptions = {};
    expect(options.viewport).toBeUndefined();
  });
});

describe('NavigationOptions shape', () => {
  it('accepts timeout and waitUntil fields', () => {
    const options: NavigationOptions = {
      timeout: 30000,
      waitUntil: 'networkidle',
    };

    expect(options.timeout).toBe(30000);
    expect(options.waitUntil).toBe('networkidle');
  });

  it('accepts all waitUntil states', () => {
    const load: NavigationOptions = { waitUntil: 'load' };
    const domContentLoaded: NavigationOptions = { waitUntil: 'domcontentloaded' };
    const networkIdle: NavigationOptions = { waitUntil: 'networkidle' };
    const commit: NavigationOptions = { waitUntil: 'commit' };

    expect(load.waitUntil).toBe('load');
    expect(domContentLoaded.waitUntil).toBe('domcontentloaded');
    expect(networkIdle.waitUntil).toBe('networkidle');
    expect(commit.waitUntil).toBe('commit');
  });

  it('accepts an empty options object (all fields optional)', () => {
    const options: NavigationOptions = {};
    expect(options.timeout).toBeUndefined();
  });
});

describe('ClickOptions shape', () => {
  it('accepts all optional click fields', () => {
    const options: ClickOptions = {
      timeout: 5000,
      clickCount: 2,
      delay: 50,
      button: 'right',
      force: true,
    };

    expect(options.clickCount).toBe(2);
    expect(options.button).toBe('right');
  });
});

describe('TypeOptions shape', () => {
  it('accepts timeout and delay', () => {
    const options: TypeOptions = { timeout: 3000, delay: 100 };
    expect(options.delay).toBe(100);
  });
});

describe('WaitOptions shape', () => {
  it('accepts timeout and state', () => {
    const options: WaitOptions = { timeout: 10000, state: 'visible' };
    expect(options.state).toBe('visible');
  });

  it('accepts all state values', () => {
    const attached: WaitOptions = { state: 'attached' };
    const detached: WaitOptions = { state: 'detached' };
    const visible: WaitOptions = { state: 'visible' };
    const hidden: WaitOptions = { state: 'hidden' };

    expect(attached.state).toBe('attached');
    expect(detached.state).toBe('detached');
    expect(visible.state).toBe('visible');
    expect(hidden.state).toBe('hidden');
  });
});

describe('ScreenshotOptions shape', () => {
  it('accepts fullPage and type fields', () => {
    const options: ScreenshotOptions = {
      fullPage: true,
      type: 'png',
    };

    expect(options.fullPage).toBe(true);
    expect(options.type).toBe('png');
  });

  it('accepts jpeg type with quality', () => {
    const options: ScreenshotOptions = {
      type: 'jpeg',
      quality: 80,
    };

    expect(options.type).toBe('jpeg');
    expect(options.quality).toBe(80);
  });

  it('accepts clip region', () => {
    const options: ScreenshotOptions = {
      clip: { x: 0, y: 0, width: 400, height: 300 },
    };

    expect(options.clip?.width).toBe(400);
  });

  it('accepts an empty options object (all fields optional)', () => {
    const options: ScreenshotOptions = {};
    expect(options.fullPage).toBeUndefined();
  });
});

describe('VideoOptions shape', () => {
  it('accepts required outputDir and optional size', () => {
    const options: VideoOptions = {
      outputDir: './artifacts/videos',
      size: { width: 1280, height: 720 },
    };

    expect(options.outputDir).toBe('./artifacts/videos');
    expect(options.size?.height).toBe(720);
  });

  it('accepts outputDir without size', () => {
    const options: VideoOptions = { outputDir: './out' };
    expect(options.size).toBeUndefined();
  });
});

describe('NetworkRequest shape', () => {
  it('accepts all required fields', () => {
    const request: NetworkRequest = {
      url: 'https://api.example.com/data',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      resourceType: 'fetch',
    };

    expect(request.url).toBe('https://api.example.com/data');
    expect(request.method).toBe('POST');
    expect(request.body).toBeUndefined();
  });

  it('accepts optional body field', () => {
    const request: NetworkRequest = {
      url: 'https://api.example.com/data',
      method: 'POST',
      headers: {},
      body: '{"key":"value"}',
      resourceType: 'fetch',
    };

    expect(request.body).toBe('{"key":"value"}');
  });
});

describe('NetworkResponse shape', () => {
  it('accepts required fields without optional body', () => {
    const response: NetworkResponse = {
      url: 'https://api.example.com/data',
      status: 200,
      headers: { 'content-type': 'application/json' },
    };

    expect(response.status).toBe(200);
    expect(response.body).toBeUndefined();
  });

  it('accepts optional body', () => {
    const response: NetworkResponse = {
      url: 'https://api.example.com/data',
      status: 201,
      headers: {},
      body: '{"id":1}',
    };

    expect(response.body).toBe('{"id":1}');
  });
});

describe('RequestAction variants', () => {
  it('continue action with no overrides', () => {
    const action: RequestAction = { action: 'continue' };
    expect(action.action).toBe('continue');
  });

  it('continue action with overrides', () => {
    const action: RequestAction = {
      action: 'continue',
      overrides: { url: 'https://mock.example.com/data', method: 'GET' },
    };

    expect(action.action).toBe('continue');
    expect('overrides' in action).toBe(true);
    if ('overrides' in action) {
      expect(action.overrides.url).toBe('https://mock.example.com/data');
    }
  });

  it('abort action with optional reason', () => {
    const withReason: RequestAction = { action: 'abort', reason: 'blocked' };
    const withoutReason: RequestAction = { action: 'abort' };

    expect(withReason.action).toBe('abort');
    expect('reason' in withReason && withReason.reason).toBe('blocked');
    expect(withoutReason.action).toBe('abort');
  });

  it('fulfill action with status and optional headers/body', () => {
    const action: RequestAction = {
      action: 'fulfill',
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: '{"mocked":true}',
    };

    expect(action.action).toBe('fulfill');
    expect('status' in action && action.status).toBe(200);
    expect('body' in action && action.body).toBe('{"mocked":true}');
  });

  it('fulfill action with only required status', () => {
    const action: RequestAction = { action: 'fulfill', status: 404 };
    expect('status' in action && action.status).toBe(404);
  });
});

describe('RequestInterceptor and ResponseInterceptor function types', () => {
  it('RequestInterceptor is a function accepting a NetworkRequest', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const interceptor: RequestInterceptor = async () => ({
      action: 'continue' as const,
    });

    const request: NetworkRequest = {
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      resourceType: 'document',
    };

    const result = await interceptor(request);
    expect(result.action).toBe('continue');
  });

  it('ResponseInterceptor is a function accepting request and response', async () => {
    const calls: string[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await
    const interceptor: ResponseInterceptor = async (request, response) => {
      calls.push(`${request.method} ${String(response.status)}`);
    };

    const request: NetworkRequest = {
      url: 'https://example.com',
      method: 'GET',
      headers: {},
      resourceType: 'document',
    };

    const response: NetworkResponse = {
      url: 'https://example.com',
      status: 200,
      headers: {},
    };

    await interceptor(request, response);
    expect(calls).toEqual(['GET 200']);
  });
});

describe('HarEntry shape', () => {
  it('accepts a complete HAR entry', () => {
    const entry: HarEntry = {
      startedDateTime: '2026-02-19T00:00:00.000Z',
      time: 123.4,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [{ name: 'accept', value: '*/*' }],
        bodySize: 0,
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'content-type', value: 'text/html' }],
        bodySize: 512,
        content: { mimeType: 'text/html', text: '<html></html>' },
      },
      timings: {
        send: 0,
        wait: 100,
        receive: 23.4,
      },
    };

    expect(entry.startedDateTime).toBe('2026-02-19T00:00:00.000Z');
    expect(entry.response.status).toBe(200);
    expect(entry.timings.wait).toBe(100);
  });

  it('accepts request with optional postData', () => {
    const entry: HarEntry = {
      startedDateTime: '2026-02-19T00:00:00.000Z',
      time: 50,
      request: {
        method: 'POST',
        url: 'https://example.com/api',
        headers: [],
        bodySize: 20,
        postData: { mimeType: 'application/json', text: '{"a":1}' },
      },
      response: {
        status: 201,
        statusText: 'Created',
        headers: [],
        bodySize: 10,
        content: { mimeType: 'application/json' },
      },
      timings: { send: 1, wait: 40, receive: 9 },
    };

    expect(entry.request.postData?.text).toBe('{"a":1}');
    expect(entry.response.content.text).toBeUndefined();
  });
});

describe('HarArchive shape', () => {
  it('accepts a complete HAR archive', () => {
    const archive: HarArchive = {
      log: {
        version: '1.2',
        creator: { name: '@sentinel/browser', version: '0.1.0' },
        entries: [],
      },
    };

    expect(archive.log.version).toBe('1.2');
    expect(archive.log.entries).toHaveLength(0);
  });

  it('accepts entries array with HAR entries', () => {
    const entry: HarEntry = {
      startedDateTime: '2026-02-19T00:00:00.000Z',
      time: 10,
      request: {
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        bodySize: 0,
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [],
        bodySize: 0,
        content: { mimeType: 'text/plain' },
      },
      timings: { send: 0, wait: 8, receive: 2 },
    };

    const archive: HarArchive = {
      log: {
        version: '1.2',
        creator: { name: 'sentinel', version: '1.0.0' },
        entries: [entry],
      },
    };

    expect(archive.log.entries).toHaveLength(1);
    expect(archive.log.entries[0]?.response.status).toBe(200);
  });
});
