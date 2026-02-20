import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import type { CryptoKey, JWK } from 'jose';
import type { AuthConfig } from '@sentinel/shared';
import { verifyAccessToken } from '../auth/jwt.js';
import { createAuthMiddleware, requirePermissions } from '../auth/middleware.js';
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
// Helper: signs a JWT with the test private key
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// verifyAccessToken
// ---------------------------------------------------------------------------

describe('verifyAccessToken', () => {
  it('returns a TokenPayload for a valid token', async () => {
    const token = await signTestToken({ sub: 'user|abc', email: 'alice@example.com' });
    const payload = await verifyAccessToken(token, TEST_CONFIG, mockJwks);

    expect(payload.sub).toBe('user|abc');
    expect(payload.email).toBe('alice@example.com');
    expect(payload.iss).toBe(ISSUER);
    expect(payload.aud).toBe(TEST_CONFIG.audience);
  });

  it('includes permissions when present in the token', async () => {
    const token = await signTestToken({ permissions: ['read:reports', 'write:scenarios'] });
    const payload = await verifyAccessToken(token, TEST_CONFIG, mockJwks);

    expect(payload.permissions).toEqual(['read:reports', 'write:scenarios']);
  });

  it('rejects an expired token', async () => {
    const expired = Math.floor(Date.now() / 1000) - 3600;
    const token = await signTestToken({ exp: expired });

    await expect(verifyAccessToken(token, TEST_CONFIG, mockJwks)).rejects.toThrow();
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await signTestToken({ aud: 'https://wrong-audience.com' });

    await expect(verifyAccessToken(token, TEST_CONFIG, mockJwks)).rejects.toThrow();
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await signTestToken({ iss: 'https://attacker.example.com/' });

    await expect(verifyAccessToken(token, TEST_CONFIG, mockJwks)).rejects.toThrow();
  });

  it('rejects a malformed token string', async () => {
    await expect(verifyAccessToken('not.a.jwt', TEST_CONFIG, mockJwks)).rejects.toThrow();
  });

  it('rejects an empty string', async () => {
    await expect(verifyAccessToken('', TEST_CONFIG, mockJwks)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createAuthMiddleware
// ---------------------------------------------------------------------------

describe('createAuthMiddleware', () => {
  const middleware = (): ReturnType<typeof createAuthMiddleware> =>
    createAuthMiddleware(TEST_CONFIG, mockJwks);

  function makeRequest(authorization?: string): AuthRequest {
    return {
      headers: authorization !== undefined ? { authorization } : {},
    };
  }

  it('returns authenticated result with user when token is valid', async () => {
    const token = await signTestToken({
      sub: 'user|456',
      email: 'bob@example.com',
      permissions: ['read:data'],
    });
    const result = await middleware()(makeRequest(`Bearer ${token}`));

    expect(result.outcome).toBe('authenticated');
    if (result.outcome === 'authenticated') {
      expect(result.user.sub).toBe('user|456');
      expect(result.user.email).toBe('bob@example.com');
      expect(result.user.permissions).toEqual(['read:data']);
    }
  });

  it('returns 401 error when Authorization header is absent', async () => {
    const result = await middleware()(makeRequest());

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(401);
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns 401 error when header does not start with Bearer', async () => {
    const result = await middleware()(makeRequest('Basic dXNlcjpwYXNz'));

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(401);
    }
  });

  it('returns 401 error for an invalid (tampered) token', async () => {
    const result = await middleware()(makeRequest('Bearer invalid.token.value'));

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(401);
    }
  });

  it('returns 401 error for an expired token', async () => {
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const token = await signTestToken({ exp });
    const result = await middleware()(makeRequest(`Bearer ${token}`));

    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(401);
    }
  });

  it('handles an array Authorization header value by using the first entry', async () => {
    const token = await signTestToken({ sub: 'user|789' });
    const request: AuthRequest = {
      headers: { authorization: [`Bearer ${token}`, 'Bearer other'] },
    };
    const result = await createAuthMiddleware(TEST_CONFIG, mockJwks)(request);

    expect(result.outcome).toBe('authenticated');
  });
});

// ---------------------------------------------------------------------------
// requirePermissions
// ---------------------------------------------------------------------------

describe('requirePermissions', () => {
  it('returns authenticated when user has the required permission', async () => {
    const token = await signTestToken({ permissions: ['read:reports'] });
    const payload = await verifyAccessToken(token, TEST_CONFIG, mockJwks);
    const user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.email,
      roles: [] as string[],
      permissions: payload.permissions ?? [],
    };

    const result = requirePermissions('read:reports')(user);
    expect(result.outcome).toBe('authenticated');
  });

  it('returns authenticated when user has all of multiple required permissions', async () => {
    const token = await signTestToken({
      permissions: ['read:reports', 'write:scenarios', 'admin'],
    });
    const payload = await verifyAccessToken(token, TEST_CONFIG, mockJwks);
    const user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.email,
      roles: [] as string[],
      permissions: payload.permissions ?? [],
    };

    const result = requirePermissions('read:reports', 'write:scenarios')(user);
    expect(result.outcome).toBe('authenticated');
  });

  it('returns 403 error when the user is missing a required permission', async () => {
    const token = await signTestToken({ permissions: ['read:reports'] });
    const payload = await verifyAccessToken(token, TEST_CONFIG, mockJwks);
    const user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.email,
      roles: [] as string[],
      permissions: payload.permissions ?? [],
    };

    const result = requirePermissions('write:scenarios')(user);
    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toContain('write:scenarios');
    }
  });

  it('returns 403 when user has no permissions at all', () => {
    const user = {
      sub: 'user|000',
      email: 'nobody@example.com',
      name: 'nobody@example.com',
      roles: [] as string[],
      permissions: [] as string[],
    };

    const result = requirePermissions('admin')(user);
    expect(result.outcome).toBe('error');
    if (result.outcome === 'error') {
      expect(result.error.statusCode).toBe(403);
    }
  });
});
