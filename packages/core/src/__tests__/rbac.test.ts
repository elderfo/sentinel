import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import type { CryptoKey, JWK } from 'jose';
import { ROLES, PERMISSIONS } from '@sentinel/shared';
import type { AuthConfig, AuthUser } from '@sentinel/shared';
import { requireRole, requirePermission, createRbacMiddleware } from '../auth/rbac.js';
import type { JwksGetter } from '../auth/jwt.js';
import type { AuthRequest } from '../auth/middleware.js';

// ---------------------------------------------------------------------------
// Shared test fixture — one key pair used across all JWT tests in this file
// ---------------------------------------------------------------------------

let privateKey: CryptoKey;
let mockJwks: JwksGetter;

const TEST_CONFIG: AuthConfig = {
  domain: 'test.auth0.com',
  clientId: 'client-123',
  clientSecret: 'secret-abc',
  audience: 'https://api.test.com',
  callbackUrl: 'https://app.test.com/callback',
  logoutUrl: 'https://app.test.com/logout',
};

const ISSUER = `https://${TEST_CONFIG.domain}/`;

beforeAll(async () => {
  const { privateKey: priv, publicKey: pub } = await generateKeyPair('RS256');
  privateKey = priv;

  const publicJwk: JWK = { ...(await exportJWK(pub)), use: 'sig', alg: 'RS256', kid: 'test-key-1' };
  mockJwks = createLocalJWKSet({ keys: [publicJwk] });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: 'user|test',
    email: 'test@example.com',
    name: 'Test User',
    roles: [],
    permissions: [],
    ...overrides,
  };
}

interface TokenOptions {
  sub?: string;
  email?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  permissions?: string[];
}

async function signTestToken(opts: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const builder = new SignJWT({
    sub: opts.sub ?? 'user|123',
    email: opts.email ?? 'user@example.com',
    ...(opts.permissions !== undefined && { permissions: opts.permissions }),
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? TEST_CONFIG.audience)
    .setIssuedAt(now);

  if (opts.exp !== undefined) {
    builder.setExpirationTime(opts.exp);
  } else {
    builder.setExpirationTime(now + 3600);
  }

  return builder.sign(privateKey);
}

function makeRequest(authorization?: string): AuthRequest {
  return {
    headers: authorization !== undefined ? { authorization } : {},
  };
}

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

describe('requireRole', () => {
  it('returns authenticated when user has the required role', () => {
    const user = makeUser({ roles: [ROLES.ENGINEER] });
    const result = requireRole(ROLES.ENGINEER)(user);

    expect(result.outcome).toBe('authenticated');
    if (result.outcome === 'authenticated') {
      expect(result.user).toBe(user);
    }
  });

  it('returns authenticated when user has one of multiple accepted roles', () => {
    const user = makeUser({ roles: [ROLES.ADMIN] });
    const result = requireRole(ROLES.ENGINEER, ROLES.ADMIN)(user);

    expect(result.outcome).toBe('authenticated');
  });

  it('returns 403 error when user has none of the required roles', () => {
    const user = makeUser({ roles: [ROLES.VIEWER] });
    const result = requireRole(ROLES.ADMIN, ROLES.ENGINEER)(user);

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('returns 403 error when user has no roles at all', () => {
    const user = makeUser({ roles: [] });
    const result = requireRole(ROLES.VIEWER)(user);

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// requirePermission
// ---------------------------------------------------------------------------

describe('requirePermission', () => {
  it('returns authenticated when user has the required typed permission', () => {
    const user = makeUser({ permissions: [PERMISSIONS.RESULTS_READ] });
    const result = requirePermission(PERMISSIONS.RESULTS_READ)(user);

    expect(result.outcome).toBe('authenticated');
  });

  it('returns authenticated when user has all of multiple required permissions', () => {
    const user = makeUser({
      permissions: [PERMISSIONS.TESTS_CREATE, PERMISSIONS.TESTS_RUN, PERMISSIONS.RESULTS_READ],
    });
    const result = requirePermission(PERMISSIONS.TESTS_CREATE, PERMISSIONS.RESULTS_READ)(user);

    expect(result.outcome).toBe('authenticated');
  });

  it('returns 403 error when user is missing a required permission', () => {
    const user = makeUser({ permissions: [PERMISSIONS.RESULTS_READ] });
    const result = requirePermission(PERMISSIONS.TESTS_CREATE)(user);

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toContain(PERMISSIONS.TESTS_CREATE);
    }
  });

  it('returns 403 error when user has no permissions', () => {
    const user = makeUser({ permissions: [] });
    const result = requirePermission(PERMISSIONS.RESULTS_READ)(user);

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// createRbacMiddleware
// ---------------------------------------------------------------------------

describe('createRbacMiddleware', () => {
  it('returns authenticated when token is valid and user has the required permission', async () => {
    const token = await signTestToken({
      sub: 'user|456',
      email: 'alice@example.com',
      permissions: [PERMISSIONS.RESULTS_READ],
    });
    const middleware = createRbacMiddleware(TEST_CONFIG, mockJwks, [PERMISSIONS.RESULTS_READ]);
    const result = await middleware(makeRequest(`Bearer ${token}`));

    expect(result.outcome).toBe('authenticated');
    if (result.outcome === 'authenticated') {
      expect(result.user.sub).toBe('user|456');
      expect(result.user.email).toBe('alice@example.com');
    }
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const middleware = createRbacMiddleware(TEST_CONFIG, mockJwks, [PERMISSIONS.RESULTS_READ]);
    const result = await middleware(makeRequest());

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(401);
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns 401 when the token is invalid', async () => {
    const middleware = createRbacMiddleware(TEST_CONFIG, mockJwks, [PERMISSIONS.RESULTS_READ]);
    const result = await middleware(makeRequest('Bearer invalid.token.here'));

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(401);
    }
  });

  it('returns 403 when token is valid but user lacks required permissions', async () => {
    const token = await signTestToken({
      permissions: [PERMISSIONS.RESULTS_READ],
    });
    const middleware = createRbacMiddleware(TEST_CONFIG, mockJwks, [PERMISSIONS.TESTS_DELETE]);
    const result = await middleware(makeRequest(`Bearer ${token}`));

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toContain(PERMISSIONS.TESTS_DELETE);
    }
  });

  it('returns 403 when token is valid but user has no permissions at all', async () => {
    const token = await signTestToken({ permissions: [] });
    const middleware = createRbacMiddleware(TEST_CONFIG, mockJwks, [PERMISSIONS.SETTINGS_MANAGE]);
    const result = await middleware(makeRequest(`Bearer ${token}`));

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(403);
    }
  });

  it('returns authenticated when multiple required permissions are all present', async () => {
    const token = await signTestToken({
      permissions: [PERMISSIONS.TESTS_CREATE, PERMISSIONS.TESTS_RUN, PERMISSIONS.RESULTS_READ],
    });
    const middleware = createRbacMiddleware(TEST_CONFIG, mockJwks, [
      PERMISSIONS.TESTS_CREATE,
      PERMISSIONS.RESULTS_READ,
    ]);
    const result = await middleware(makeRequest(`Bearer ${token}`));

    expect(result.outcome).toBe('authenticated');
  });

  it('returns 401 for an expired token', async () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const token = await signTestToken({ exp });
    const middleware = createRbacMiddleware(TEST_CONFIG, mockJwks, [PERMISSIONS.RESULTS_READ]);
    const result = await middleware(makeRequest(`Bearer ${token}`));

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(401);
    }
  });
});
