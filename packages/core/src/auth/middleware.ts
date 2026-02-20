import { unauthorizedError, forbiddenError } from '@sentinel/shared';
import type { AuthConfig, AuthUser, AuthError } from '@sentinel/shared';
import { verifyAccessToken } from './jwt.js';
import { tokenPayloadToUser } from './user.js';
import type { JwksGetter } from './jwt.js';

/**
 * A minimal request abstraction — only the fields auth middleware needs.
 * Concrete framework adapters (Express, Fastify, etc.) should map their
 * native request object to this shape before calling the middleware.
 */
export interface AuthRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

/**
 * The result produced by auth middleware after processing a request.
 * On success, the verified user is attached. On failure, a typed error is returned.
 */
export type AuthMiddlewareResult =
  | { readonly outcome: 'authenticated'; readonly user: AuthUser }
  | { readonly outcome: 'error'; readonly error: AuthError };

/**
 * Auth middleware that extracts and verifies a Bearer token from the Authorization header.
 * Returns an AuthMiddlewareResult — callers are responsible for translating this into
 * a framework-specific response (e.g., setting res.status(401)).
 */
export type AuthMiddlewareFn = (request: AuthRequest) => Promise<AuthMiddlewareResult>;

/**
 * Permission-check middleware that validates the authenticated user has all required permissions.
 * Assumes the request has already been processed by createAuthMiddleware.
 */
export type PermissionMiddlewareFn = (user: AuthUser) => AuthMiddlewareResult;

/**
 * Creates an auth middleware function configured for the given Auth0 config and JWKS getter.
 * Pass a mock JWKS getter in tests to avoid real network calls.
 */
export function createAuthMiddleware(config: AuthConfig, getJwks: JwksGetter): AuthMiddlewareFn {
  return async (request: AuthRequest): Promise<AuthMiddlewareResult> => {
    const authHeader = request.headers['authorization'];
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!headerValue || !headerValue.startsWith('Bearer ')) {
      return {
        outcome: 'error',
        error: unauthorizedError('Missing or malformed Authorization header'),
      };
    }

    const token = headerValue.slice('Bearer '.length);

    try {
      const payload = await verifyAccessToken(token, config, getJwks);
      const user = tokenPayloadToUser(payload);
      return { outcome: 'authenticated', user };
    } catch {
      return {
        outcome: 'error',
        error: unauthorizedError('Token verification failed'),
      };
    }
  };
}

/**
 * Returns a permission-check function that verifies the user holds all of the
 * specified permissions. Returns a 403 Forbidden error result if any are missing.
 */
export function requirePermissions(...permissions: string[]): PermissionMiddlewareFn {
  return (user: AuthUser): AuthMiddlewareResult => {
    const missing = permissions.filter((p) => !user.permissions.includes(p));

    if (missing.length > 0) {
      return {
        outcome: 'error',
        error: forbiddenError(`Insufficient permissions. Required: ${missing.join(', ')}`),
      };
    }

    return { outcome: 'authenticated', user };
  };
}
