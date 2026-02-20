import { MFA_ERROR_CODES, isMfaError, createMfaError } from '@sentinel/shared';
import type { MfaChallengeResult } from '@sentinel/shared';
import type { AuthMiddlewareResult } from './middleware.js';

/**
 * Returns a function that inspects an AuthMiddlewareResult for MFA completion status.
 *
 * The function accepts the auth result alongside the `amr` (Authentication Methods Reference)
 * claim extracted from the verified token payload. When MFA is enforced, every authenticated
 * request must present a token whose `amr` claim includes 'mfa'. Tokens without that claim
 * were issued before an MFA challenge was completed.
 *
 * Callers that use `verifyAccessToken` to produce a `TokenPayload` can pass `payload.amr`
 * directly. Callers that only hold an `AuthMiddlewareResult` can pass `undefined` for `amr`,
 * which will always result in a 'required' outcome for authenticated tokens.
 */
export function createMfaEnforcementMiddleware(): (
  result: AuthMiddlewareResult,
  amr?: readonly string[],
) => MfaChallengeResult {
  return (result: AuthMiddlewareResult, amr?: readonly string[]): MfaChallengeResult => {
    if (result.outcome === 'error') {
      if (isMfaError(result.error)) {
        if (result.error.code === MFA_ERROR_CODES.MFA_ENROLLMENT_REQUIRED) {
          // When enrollment is required, callers need to redirect the user to set up a factor.
          // The enrollment URL is not available at this layer — callers must supply it from
          // the Auth0 error response or tenant configuration.
          return {
            status: 'enrollment_required',
            enrollmentUrl: '',
          };
        }
        return {
          status: 'required',
          error: result.error,
        };
      }

      // Non-MFA auth failure: surface as a generic MFA required error so callers have a
      // uniform type to handle, while preserving the original error message.
      return {
        status: 'required',
        error: createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, result.error.message),
      };
    }

    // Authenticated — verify that the token declared MFA was used via the amr claim.
    if (!amr?.includes('mfa')) {
      return {
        status: 'required',
        error: createMfaError(
          MFA_ERROR_CODES.MFA_REQUIRED,
          'Multi-factor authentication is required',
        ),
      };
    }

    return { status: 'completed' };
  };
}

/**
 * Parses an Auth0 error response body from a token exchange and returns a typed MfaChallengeResult.
 *
 * Auth0 returns `{ error: "mfa_required", mfa_token: "..." }` when MFA must be completed
 * before a token can be issued. This function translates those responses so callers can
 * act on the MFA challenge without inspecting raw response bodies.
 */
export function parseMfaErrorResponse(responseBody: unknown): MfaChallengeResult {
  if (typeof responseBody !== 'object' || responseBody === null || !('error' in responseBody)) {
    return {
      status: 'required',
      error: createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, 'Unknown MFA error'),
    };
  }

  const body = responseBody as Record<string, unknown>;
  const errorCode = body['error'];
  const mfaToken = typeof body['mfa_token'] === 'string' ? body['mfa_token'] : undefined;
  const errorDescription =
    typeof body['error_description'] === 'string' ? body['error_description'] : 'MFA required';

  if (errorCode === MFA_ERROR_CODES.MFA_ENROLLMENT_REQUIRED) {
    const enrollmentUrl = typeof body['enrollment_url'] === 'string' ? body['enrollment_url'] : '';
    return { status: 'enrollment_required', enrollmentUrl };
  }

  if (
    errorCode === MFA_ERROR_CODES.MFA_REQUIRED ||
    errorCode === MFA_ERROR_CODES.MFA_TOKEN_INVALID ||
    errorCode === MFA_ERROR_CODES.MFA_FACTOR_NOT_ENROLLED
  ) {
    return {
      status: 'required',
      error: createMfaError(errorCode, errorDescription, mfaToken),
    };
  }

  // Response contains an error field but it is not an MFA-specific code.
  return {
    status: 'required',
    error: createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, errorDescription),
  };
}
