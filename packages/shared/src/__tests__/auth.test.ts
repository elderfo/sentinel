import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  loadAuthConfig,
  unauthorizedError,
  forbiddenError,
  authConfigError,
} from '../auth/index.js';

// vi.stubEnv / vi.unstubAllEnvs are the correct way to mutate process.env in Vitest
// without running into process.env's string-coercion behaviour or ESLint's restrictions.

const FULL_ENV: Record<string, string> = {
  AUTH0_DOMAIN: 'test.auth0.com',
  AUTH0_CLIENT_ID: 'client-123',
  AUTH0_CLIENT_SECRET: 'secret-abc',
  AUTH0_AUDIENCE: 'https://api.test.com',
  AUTH0_CALLBACK_URL: 'https://app.test.com/callback',
  AUTH0_LOGOUT_URL: 'https://app.test.com/logout',
};

function stubFullEnv(): void {
  for (const [key, value] of Object.entries(FULL_ENV)) {
    vi.stubEnv(key, value);
  }
}

describe('loadAuthConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a complete AuthConfig when all env vars are set', () => {
    stubFullEnv();

    const config = loadAuthConfig();

    expect(config.domain).toBe('test.auth0.com');
    expect(config.clientId).toBe('client-123');
    expect(config.clientSecret).toBe('secret-abc');
    expect(config.audience).toBe('https://api.test.com');
    expect(config.callbackUrl).toBe('https://app.test.com/callback');
    expect(config.logoutUrl).toBe('https://app.test.com/logout');
  });

  it('throws when AUTH0_DOMAIN is missing', () => {
    stubFullEnv();
    vi.stubEnv('AUTH0_DOMAIN', '');

    expect(() => loadAuthConfig()).toThrow('AUTH0_DOMAIN');
  });

  it('throws when AUTH0_CLIENT_ID is missing', () => {
    stubFullEnv();
    vi.stubEnv('AUTH0_CLIENT_ID', '');

    expect(() => loadAuthConfig()).toThrow('AUTH0_CLIENT_ID');
  });

  it('throws when AUTH0_CLIENT_SECRET is missing', () => {
    stubFullEnv();
    vi.stubEnv('AUTH0_CLIENT_SECRET', '');

    expect(() => loadAuthConfig()).toThrow('AUTH0_CLIENT_SECRET');
  });

  it('throws when AUTH0_AUDIENCE is missing', () => {
    stubFullEnv();
    vi.stubEnv('AUTH0_AUDIENCE', '');

    expect(() => loadAuthConfig()).toThrow('AUTH0_AUDIENCE');
  });

  it('throws when AUTH0_CALLBACK_URL is missing', () => {
    stubFullEnv();
    vi.stubEnv('AUTH0_CALLBACK_URL', '');

    expect(() => loadAuthConfig()).toThrow('AUTH0_CALLBACK_URL');
  });

  it('throws when AUTH0_LOGOUT_URL is missing', () => {
    stubFullEnv();
    vi.stubEnv('AUTH0_LOGOUT_URL', '');

    expect(() => loadAuthConfig()).toThrow('AUTH0_LOGOUT_URL');
  });

  it('throws listing all missing variables when multiple are absent', () => {
    // Don't stub any vars — they should all be absent (or empty)
    for (const key of Object.keys(FULL_ENV)) {
      vi.stubEnv(key, '');
    }

    expect(() => loadAuthConfig()).toThrow('AUTH0_DOMAIN');
  });
});

describe('unauthorizedError', () => {
  it('returns code UNAUTHORIZED and statusCode 401', () => {
    const err = unauthorizedError('not logged in');

    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('not logged in');
  });
});

describe('forbiddenError', () => {
  it('returns code FORBIDDEN and statusCode 403', () => {
    const err = forbiddenError('access denied');

    expect(err.code).toBe('FORBIDDEN');
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('access denied');
  });
});

describe('authConfigError', () => {
  it('returns code AUTH_CONFIG_ERROR and statusCode 500', () => {
    const err = authConfigError('AUTH0_DOMAIN');

    expect(err.code).toBe('AUTH_CONFIG_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.message).toContain('AUTH0_DOMAIN');
  });
});
