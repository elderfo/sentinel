import { describe, it, expect, vi } from 'vitest';
import type { AuthConfig } from '@sentinel/shared';
import type { SessionConfig, TokenSet } from '@sentinel/shared';
import { SessionManager } from '../auth/session.js';
import type { TokenExchanger } from '../auth/session.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const TEST_CONFIG: AuthConfig = {
  domain: 'test.auth0.com',
  clientId: 'client-123',
  clientSecret: 'secret-abc',
  audience: 'https://api.test.com',
  callbackUrl: 'https://app.test.com/callback',
  logoutUrl: 'https://app.test.com/logout',
};

const SESSION_CONFIG: SessionConfig = {
  accessTokenTtlSeconds: 3600,
  refreshBufferSeconds: 300,
};

function makeTokenSet(overrides: Partial<TokenSet> = {}): TokenSet {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    accessToken: 'access-token-value',
    refreshToken: 'refresh-token-value',
    expiresAt: nowSeconds + 3600,
    ...overrides,
  };
}

function makeExchanger(result: TokenSet): TokenExchanger {
  return vi.fn().mockResolvedValue(result);
}

function makeFailingExchanger(message: string): TokenExchanger {
  return vi.fn().mockRejectedValue(new Error(message));
}

// ---------------------------------------------------------------------------
// createTokenSet
// ---------------------------------------------------------------------------

describe('SessionManager.createTokenSet', () => {
  it('calls the token exchanger with authorization_code grant and correct params', async () => {
    const expected = makeTokenSet({ accessToken: 'new-access-token' });
    const exchanger = makeExchanger(expected);
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, exchanger);

    const result = await manager.createTokenSet('auth-code-xyz', 'https://app.test.com/callback');

    expect(exchanger).toHaveBeenCalledWith('authorization_code', {
      code: 'auth-code-xyz',
      redirect_uri: 'https://app.test.com/callback',
    });
    expect(result).toBe(expected);
  });

  it('returns the TokenSet produced by the exchanger', async () => {
    const expected = makeTokenSet({ accessToken: 'returned-token' });
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(expected));

    const result = await manager.createTokenSet('code', 'https://app.test.com/callback');

    expect(result.accessToken).toBe('returned-token');
  });
});

// ---------------------------------------------------------------------------
// refreshTokenSet
// ---------------------------------------------------------------------------

describe('SessionManager.refreshTokenSet', () => {
  it('returns refreshed status with new token set on success', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const refreshed = makeTokenSet({
      accessToken: 'refreshed-token',
      expiresAt: nowSeconds + 7200,
    });
    const existing = makeTokenSet();
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(refreshed));

    const result = await manager.refreshTokenSet(existing);

    expect(result.status).toBe('refreshed');
    if (result.status === 'refreshed') {
      expect(result.tokenSet.accessToken).toBe('refreshed-token');
    }
  });

  it('calls token exchanger with refresh_token grant and the existing refresh token', async () => {
    const existing = makeTokenSet({ refreshToken: 'my-refresh-token' });
    const exchanger = makeExchanger(makeTokenSet());
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, exchanger);

    await manager.refreshTokenSet(existing);

    expect(exchanger).toHaveBeenCalledWith('refresh_token', {
      refresh_token: 'my-refresh-token',
    });
  });

  it('returns expired status with reason when exchanger throws', async () => {
    const existing = makeTokenSet();
    const manager = new SessionManager(
      TEST_CONFIG,
      SESSION_CONFIG,
      makeFailingExchanger('invalid_grant: Token has been expired or revoked'),
    );

    const result = await manager.refreshTokenSet(existing);

    expect(result.status).toBe('expired');
    if (result.status === 'expired') {
      expect(result.reason).toBe('invalid_grant: Token has been expired or revoked');
    }
  });

  it('returns expired status with a fallback reason when the thrown value is not an Error', async () => {
    const existing = makeTokenSet();
    const exchanger: TokenExchanger = vi.fn().mockRejectedValue('some string error');
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, exchanger);

    const result = await manager.refreshTokenSet(existing);

    expect(result.status).toBe('expired');
    if (result.status === 'expired') {
      expect(result.reason).toBe('Refresh token rejected or expired');
    }
  });
});

// ---------------------------------------------------------------------------
// needsRefresh
// ---------------------------------------------------------------------------

describe('SessionManager.needsRefresh', () => {
  it('returns true when the token expires within the refresh buffer window', () => {
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(makeTokenSet()));
    const nowSeconds = Math.floor(Date.now() / 1000);
    // expires in 200 seconds, buffer is 300 — should trigger refresh
    const tokenSet = makeTokenSet({ expiresAt: nowSeconds + 200 });

    expect(manager.needsRefresh(tokenSet)).toBe(true);
  });

  it('returns true when the token expires exactly at the buffer boundary', () => {
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(makeTokenSet()));
    const nowSeconds = Math.floor(Date.now() / 1000);
    // expires in exactly 300 seconds — at the boundary, should trigger refresh
    const tokenSet = makeTokenSet({ expiresAt: nowSeconds + SESSION_CONFIG.refreshBufferSeconds });

    expect(manager.needsRefresh(tokenSet)).toBe(true);
  });

  it('returns false when the token has ample time remaining before the buffer', () => {
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(makeTokenSet()));
    const nowSeconds = Math.floor(Date.now() / 1000);
    // expires in 3600 seconds, buffer is 300 — plenty of time
    const tokenSet = makeTokenSet({ expiresAt: nowSeconds + 3600 });

    expect(manager.needsRefresh(tokenSet)).toBe(false);
  });

  it('returns true for an already-expired token', () => {
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(makeTokenSet()));
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenSet = makeTokenSet({ expiresAt: nowSeconds - 60 });

    expect(manager.needsRefresh(tokenSet)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isExpired
// ---------------------------------------------------------------------------

describe('SessionManager.isExpired', () => {
  it('returns true when the access token expiry has passed', () => {
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(makeTokenSet()));
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenSet = makeTokenSet({ expiresAt: nowSeconds - 1 });

    expect(manager.isExpired(tokenSet)).toBe(true);
  });

  it('returns false when the access token is still valid', () => {
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(makeTokenSet()));
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenSet = makeTokenSet({ expiresAt: nowSeconds + 3600 });

    expect(manager.isExpired(tokenSet)).toBe(false);
  });

  it('returns true for a token that expires exactly now', () => {
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(makeTokenSet()));
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenSet = makeTokenSet({ expiresAt: nowSeconds });

    expect(manager.isExpired(tokenSet)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createWorkerToken
// ---------------------------------------------------------------------------

describe('SessionManager.createWorkerToken', () => {
  it('returns a WorkerToken with the correct worker ID and expiry from the exchanger', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const workerTokenSet = makeTokenSet({
      accessToken: 'worker-access-token',
      expiresAt: nowSeconds + 900,
    });
    const exchanger = makeExchanger(workerTokenSet);
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, exchanger);

    const tokenSet = makeTokenSet();
    const result = await manager.createWorkerToken(tokenSet, {
      workerId: 'worker-abc',
      scopes: ['run:scenarios', 'read:results'],
    });

    expect(result.workerId).toBe('worker-abc');
    expect(result.accessToken).toBe('worker-access-token');
    expect(result.expiresAt).toBe(nowSeconds + 900);
  });

  it('calls the exchanger with token-exchange grant, subject token, and joined scopes', async () => {
    const exchanger = makeExchanger(makeTokenSet());
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, exchanger);

    const tokenSet = makeTokenSet({ accessToken: 'subject-token' });
    await manager.createWorkerToken(tokenSet, {
      workerId: 'worker-xyz',
      scopes: ['run:scenarios', 'read:results'],
    });

    expect(exchanger).toHaveBeenCalledWith(
      'urn:ietf:params:oauth:grant-type:token-exchange',
      expect.objectContaining({
        subject_token: 'subject-token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        scope: 'run:scenarios read:results',
        worker_id: 'worker-xyz',
      }),
    );
  });

  it('uses only the access token from the returned TokenSet as the worker access token', async () => {
    const workerTokenSet = makeTokenSet({ accessToken: 'scoped-worker-token' });
    const manager = new SessionManager(TEST_CONFIG, SESSION_CONFIG, makeExchanger(workerTokenSet));

    const result = await manager.createWorkerToken(makeTokenSet(), {
      workerId: 'worker-1',
      scopes: ['run:scenarios'],
    });

    expect(result.accessToken).toBe('scoped-worker-token');
  });
});
