/**
 * @sentinel/shared
 *
 * Shared types and utilities used across all Sentinel packages.
 */

export const SENTINEL_VERSION = '0.0.0' as const;

export type SentinelVersion = typeof SENTINEL_VERSION;

/** Represents the result of a QA check — either a pass or a structured failure. */
export type CheckResult = { status: 'pass' } | { status: 'fail'; reason: string };

export type { AuthConfig, AuthUser, TokenPayload, AuthResult, AuthError } from './auth/index.js';
export {
  loadAuthConfig,
  unauthorizedError,
  forbiddenError,
  authConfigError,
} from './auth/index.js';
