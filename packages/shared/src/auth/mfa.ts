import type { AuthError } from './types.js';

/**
 * Auth0 error codes returned when MFA is required or not properly completed.
 * These correspond to error values in Auth0's OAuth token exchange responses.
 */
export const MFA_ERROR_CODES = {
  MFA_REQUIRED: 'mfa_required',
  MFA_ENROLLMENT_REQUIRED: 'mfa_enrollment_required',
  MFA_TOKEN_INVALID: 'mfa_token_invalid',
  MFA_FACTOR_NOT_ENROLLED: 'mfa_factor_not_enrolled',
} as const;

export type MfaErrorCode = (typeof MFA_ERROR_CODES)[keyof typeof MFA_ERROR_CODES];

/**
 * An AuthError specialization for MFA-related failures.
 * The optional mfaToken is the short-lived token Auth0 returns in a mfa_required response
 * to allow the client to continue the MFA challenge flow.
 */
export interface MfaError extends AuthError {
  readonly code: MfaErrorCode;
  readonly mfaToken?: string;
}

/**
 * The outcome of inspecting a token or Auth0 response for MFA status.
 * - completed: the token contains a valid mfa amr claim
 * - required: MFA must be completed before the request can proceed
 * - enrollment_required: the user has not yet enrolled an MFA factor
 */
export type MfaChallengeResult =
  | { readonly status: 'completed' }
  | { readonly status: 'required'; readonly error: MfaError }
  | { readonly status: 'enrollment_required'; readonly enrollmentUrl: string };

/** Returns true when the given AuthError is an MFA-specific error. */
export function isMfaError(error: AuthError): error is MfaError {
  return Object.values(MFA_ERROR_CODES).includes(error.code as MfaErrorCode);
}

/** Creates a typed MfaError for the given MFA error code and message. */
export function createMfaError(code: MfaErrorCode, message: string, mfaToken?: string): MfaError {
  return {
    code,
    message,
    statusCode: 403,
    ...(mfaToken !== undefined ? { mfaToken } : {}),
  };
}
