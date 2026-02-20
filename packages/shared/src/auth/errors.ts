import type { AuthError } from './types.js';

/** Returns a 401 Unauthorized error for authentication failures. */
export function unauthorizedError(message: string): AuthError {
  return {
    code: 'UNAUTHORIZED',
    message,
    statusCode: 401,
  };
}

/** Returns a 403 Forbidden error for authorization failures. */
export function forbiddenError(message: string): AuthError {
  return {
    code: 'FORBIDDEN',
    message,
    statusCode: 403,
  };
}

/** Returns a 500 Internal Server Error for auth configuration problems. */
export function authConfigError(missing: string): AuthError {
  return {
    code: 'AUTH_CONFIG_ERROR',
    message: `Auth configuration error: missing ${missing}`,
    statusCode: 500,
  };
}
