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
} from './auth/index.js';
export type {
  JwksGetter,
  AuthRequest,
  AuthMiddlewareResult,
  AuthMiddlewareFn,
  PermissionMiddlewareFn,
} from './auth/index.js';
