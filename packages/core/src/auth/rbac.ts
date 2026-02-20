import { forbiddenError } from '@sentinel/shared';
import type { AuthUser } from '@sentinel/shared';
import type { Role, Permission } from '@sentinel/shared';
import { createAuthMiddleware } from './middleware.js';
import type {
  AuthMiddlewareFn,
  AuthMiddlewareResult,
  AuthRequest,
  PermissionMiddlewareFn,
} from './middleware.js';
import { requirePermissions } from './middleware.js';
import type { JwksGetter } from './jwt.js';
import type { AuthConfig } from '@sentinel/shared';

/**
 * Returns a permission-check function that verifies the user holds at least one
 * of the specified roles. Returns 403 Forbidden if the user has none of them.
 */
export function requireRole(...roles: Role[]): PermissionMiddlewareFn {
  return (user: AuthUser): AuthMiddlewareResult => {
    const hasAny = roles.some((r) => user.roles.includes(r));

    if (!hasAny) {
      return {
        outcome: 'error',
        error: forbiddenError(`Insufficient role. Required one of: ${roles.join(', ')}`),
      };
    }

    return { outcome: 'authenticated', user };
  };
}

/**
 * A typed wrapper around requirePermissions that restricts the argument type to
 * the Permission union, providing compile-time safety for RBAC permission checks.
 * Delegates entirely to the existing requirePermissions implementation.
 */
export function requirePermission(...permissions: Permission[]): PermissionMiddlewareFn {
  return requirePermissions(...permissions);
}

/**
 * Creates a combined middleware that first authenticates via JWT and then checks
 * that the user holds all of the specified permissions. This is a convenience
 * wrapper for endpoints that need both auth and permission enforcement in one step.
 */
export function createRbacMiddleware(
  config: AuthConfig,
  getJwks: JwksGetter,
  requiredPermissions: readonly Permission[],
): AuthMiddlewareFn {
  const authMiddleware = createAuthMiddleware(config, getJwks);
  const permissionCheck = requirePermissions(...requiredPermissions);

  return async (request: AuthRequest): Promise<AuthMiddlewareResult> => {
    const authResult = await authMiddleware(request);

    if (authResult.outcome === 'error') {
      return authResult;
    }

    return permissionCheck(authResult.user);
  };
}
