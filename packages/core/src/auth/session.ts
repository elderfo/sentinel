import type { AuthConfig } from '@sentinel/shared';
import type {
  SessionConfig,
  TokenSet,
  TokenRefreshResult,
  WorkerTokenRequest,
  WorkerToken,
} from '@sentinel/shared';

/**
 * A dependency-injectable token exchange function.
 * Abstracts calls to Auth0's /oauth/token endpoint so that tests can mock the exchange
 * without making real HTTP calls.
 *
 * @param grantType - The OAuth2 grant type (e.g. 'authorization_code', 'refresh_token')
 * @param params - Grant-specific parameters (code, redirect_uri, refresh_token, etc.)
 * @returns A resolved TokenSet on success, or throws on failure.
 */
export type TokenExchanger = (
  grantType: string,
  params: Record<string, string>,
) => Promise<TokenSet>;

/**
 * Manages the lifecycle of Auth0 JWT sessions: exchanging authorization codes for tokens,
 * refreshing expiring access tokens, and minting short-lived worker tokens.
 */
export class SessionManager {
  private readonly config: AuthConfig;
  private readonly sessionConfig: SessionConfig;
  private readonly tokenExchanger: TokenExchanger;

  constructor(config: AuthConfig, sessionConfig: SessionConfig, tokenExchanger: TokenExchanger) {
    this.config = config;
    this.sessionConfig = sessionConfig;
    this.tokenExchanger = tokenExchanger;
  }

  /**
   * Exchanges an authorization code for a TokenSet via the authorization_code grant.
   * Called after the Auth0 redirect completes and the code is received.
   */
  async createTokenSet(authorizationCode: string, redirectUri: string): Promise<TokenSet> {
    return this.tokenExchanger('authorization_code', {
      code: authorizationCode,
      redirect_uri: redirectUri,
    });
  }

  /**
   * Uses the refresh token to obtain a new access token.
   * Returns 'expired' when the refresh token is no longer accepted by Auth0,
   * signalling that the user must re-authenticate.
   */
  async refreshTokenSet(tokenSet: TokenSet): Promise<TokenRefreshResult> {
    try {
      const refreshed = await this.tokenExchanger('refresh_token', {
        refresh_token: tokenSet.refreshToken,
      });
      return { status: 'refreshed', tokenSet: refreshed };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Refresh token rejected or expired';
      return { status: 'expired', reason };
    }
  }

  /**
   * Returns true when the access token will expire within the configured refresh buffer window.
   * Use this to trigger a proactive refresh before the token actually expires.
   */
  needsRefresh(tokenSet: TokenSet): boolean {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return tokenSet.expiresAt - nowSeconds <= this.sessionConfig.refreshBufferSeconds;
  }

  /**
   * Returns true when the access token's expiry time has already passed.
   */
  isExpired(tokenSet: TokenSet): boolean {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return tokenSet.expiresAt <= nowSeconds;
  }

  /**
   * Creates a short-lived, narrowly-scoped token for a browser worker.
   * Delegates to the token exchanger using the urn:ietf:params:oauth:grant-type:token-exchange
   * grant so that Auth0 can enforce scope restrictions on the resulting token.
   */
  async createWorkerToken(tokenSet: TokenSet, request: WorkerTokenRequest): Promise<WorkerToken> {
    const workerTokenSet = await this.tokenExchanger(
      'urn:ietf:params:oauth:grant-type:token-exchange',
      {
        subject_token: tokenSet.accessToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        scope: request.scopes.join(' '),
        worker_id: request.workerId,
      },
    );

    return {
      accessToken: workerTokenSet.accessToken,
      workerId: request.workerId,
      expiresAt: workerTokenSet.expiresAt,
    };
  }
}

/**
 * The production token exchanger — calls Auth0's /oauth/token endpoint via Node's built-in fetch.
 * Inject this into SessionManager for real deployments; use a mock in tests.
 */
export function createAuth0TokenExchanger(config: AuthConfig): TokenExchanger {
  return async (grantType: string, params: Record<string, string>): Promise<TokenSet> => {
    const url = `https://${config.domain}/oauth/token`;

    const body = new URLSearchParams({
      grant_type: grantType,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: config.audience,
      ...params,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Auth0 token exchange failed (${response.status.toString()}): ${text}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in: number;
    };

    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    const tokenSet: TokenSet = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? '',
      expiresAt,
      ...(data.id_token !== undefined ? { idToken: data.id_token } : {}),
    };

    return tokenSet;
  };
}
