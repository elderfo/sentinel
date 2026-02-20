/**
 * Session management types for JWT-based auth in Sentinel.
 * These types are shared across all packages that participate in session lifecycle.
 */

export interface SessionConfig {
  /** Expected access token TTL in seconds — used to calculate preemptive refresh timing. */
  readonly accessTokenTtlSeconds: number;
  /** Trigger a refresh this many seconds before the access token expires. */
  readonly refreshBufferSeconds: number;
}

export interface TokenSet {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Unix timestamp (seconds) at which the access token expires. */
  readonly expiresAt: number;
  readonly idToken?: string;
}

export type TokenRefreshResult =
  | { readonly status: 'refreshed'; readonly tokenSet: TokenSet }
  | { readonly status: 'expired'; readonly reason: string };

export interface WorkerTokenRequest {
  readonly workerId: string;
  readonly scopes: readonly string[];
}

export interface WorkerToken {
  readonly accessToken: string;
  readonly workerId: string;
  /** Unix timestamp (seconds) at which the worker token expires. */
  readonly expiresAt: number;
}
