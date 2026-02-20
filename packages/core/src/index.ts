/**
 * @sentinel/core
 *
 * Core domain logic for the Sentinel QA automation platform.
 */

export type { CheckResult, SentinelVersion } from '@sentinel/shared';
export { SENTINEL_VERSION } from '@sentinel/shared';

/** Represents a single automated QA scenario to be executed by Sentinel. */
export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export {
  verifyAccessToken,
  createAuth0JwksGetter,
  tokenPayloadToUser,
  createAuthMiddleware,
  requirePermissions,
  SessionManager,
  createAuth0TokenExchanger,
  createMfaEnforcementMiddleware,
  parseMfaErrorResponse,
} from './auth/index.js';
export type {
  JwksGetter,
  AuthRequest,
  AuthMiddlewareResult,
  AuthMiddlewareFn,
  PermissionMiddlewareFn,
  TokenExchanger,
} from './auth/index.js';
