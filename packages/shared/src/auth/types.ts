/**
 * Domain types for Auth0-based authentication in Sentinel.
 * These types are shared across all packages to ensure consistent auth contracts.
 */

export interface AuthConfig {
  readonly domain: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly audience: string;
  readonly callbackUrl: string;
  readonly logoutUrl: string;
}

export interface AuthUser {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export interface TokenPayload {
  readonly sub: string;
  readonly email: string;
  readonly iss: string;
  readonly aud: string | readonly string[];
  readonly exp: number;
  readonly iat: number;
  readonly permissions?: readonly string[];
  /** Authentication Methods Reference — indicates the methods used to authenticate the user. */
  readonly amr?: readonly string[];
}

export type AuthResult =
  | { readonly status: 'authenticated'; readonly user: AuthUser; readonly accessToken: string }
  | { readonly status: 'unauthenticated'; readonly reason: string };

export interface AuthError {
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;
}
