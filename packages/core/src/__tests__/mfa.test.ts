import { describe, it, expect } from 'vitest';
import { MFA_ERROR_CODES, isMfaError, createMfaError } from '@sentinel/shared';
import type { AuthError, AuthUser } from '@sentinel/shared';
import { createMfaEnforcementMiddleware, parseMfaErrorResponse } from '../auth/mfa.js';
import type { AuthMiddlewareResult } from '../auth/middleware.js';

// ---------------------------------------------------------------------------
// Helpers — build AuthMiddlewareResult fixtures without network or crypto
// ---------------------------------------------------------------------------

function authenticatedResult(user?: Partial<AuthUser>): AuthMiddlewareResult {
  return {
    outcome: 'authenticated',
    user: {
      sub: 'user|123',
      email: 'test@example.com',
      name: 'test@example.com',
      roles: [],
      permissions: [],
      ...user,
    },
  };
}

function errorResult(error: AuthError): AuthMiddlewareResult {
  return { outcome: 'error', error };
}

// ---------------------------------------------------------------------------
// isMfaError (re-tested here at the integration level to confirm cross-package
// re-exports work correctly; the detailed unit tests live in @sentinel/shared)
// ---------------------------------------------------------------------------

describe('isMfaError', () => {
  it('correctly identifies an MFA error', () => {
    const mfaErr = createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, 'MFA required');
    expect(isMfaError(mfaErr)).toBe(true);
  });

  it('returns false for a non-MFA AuthError', () => {
    const authErr: AuthError = { code: 'UNAUTHORIZED', message: 'Not logged in', statusCode: 401 };
    expect(isMfaError(authErr)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createMfaError (cross-package re-export smoke test)
// ---------------------------------------------------------------------------

describe('createMfaError', () => {
  it('produces an MfaError with the correct shape', () => {
    const err = createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, 'MFA is required', 'tok-abc');

    expect(err.code).toBe('mfa_required');
    expect(err.message).toBe('MFA is required');
    expect(err.statusCode).toBe(403);
    expect(err.mfaToken).toBe('tok-abc');
  });
});

// ---------------------------------------------------------------------------
// createMfaEnforcementMiddleware
// ---------------------------------------------------------------------------

describe('createMfaEnforcementMiddleware', () => {
  const enforce = createMfaEnforcementMiddleware();

  it("returns 'completed' when the amr claim includes 'mfa'", () => {
    const result = authenticatedResult();
    const outcome = enforce(result, ['mfa']);

    expect(outcome.status).toBe('completed');
  });

  it("returns 'completed' when amr contains 'mfa' alongside other methods", () => {
    const result = authenticatedResult();
    const outcome = enforce(result, ['pwd', 'mfa']);

    expect(outcome.status).toBe('completed');
  });

  it("returns 'required' when amr is absent", () => {
    const result = authenticatedResult();
    const outcome = enforce(result, undefined);

    expect(outcome.status).toBe('required');
    if (outcome.status === 'required') {
      expect(outcome.error.code).toBe(MFA_ERROR_CODES.MFA_REQUIRED);
    }
  });

  it("returns 'required' when amr does not include 'mfa'", () => {
    const result = authenticatedResult();
    const outcome = enforce(result, ['pwd']);

    expect(outcome.status).toBe('required');
    if (outcome.status === 'required') {
      expect(outcome.error.code).toBe(MFA_ERROR_CODES.MFA_REQUIRED);
    }
  });

  it("returns 'required' for an auth error result with an MFA error", () => {
    const mfaError = createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, 'MFA needed', 'mfa-tok');
    const result = errorResult(mfaError);
    const outcome = enforce(result);

    expect(outcome.status).toBe('required');
    if (outcome.status === 'required') {
      expect(outcome.error.code).toBe(MFA_ERROR_CODES.MFA_REQUIRED);
      expect(outcome.error.mfaToken).toBe('mfa-tok');
    }
  });

  it("returns 'enrollment_required' when the auth error is MFA_ENROLLMENT_REQUIRED", () => {
    const enrollError = createMfaError(MFA_ERROR_CODES.MFA_ENROLLMENT_REQUIRED, 'Enroll first');
    const result = errorResult(enrollError);
    const outcome = enforce(result);

    expect(outcome.status).toBe('enrollment_required');
  });

  it("returns 'required' for a non-MFA auth error, wrapping the original message", () => {
    const authErr: AuthError = {
      code: 'UNAUTHORIZED',
      message: 'Token expired',
      statusCode: 401,
    };
    const result = errorResult(authErr);
    const outcome = enforce(result);

    expect(outcome.status).toBe('required');
    if (outcome.status === 'required') {
      expect(outcome.error.message).toBe('Token expired');
    }
  });
});

// ---------------------------------------------------------------------------
// parseMfaErrorResponse
// ---------------------------------------------------------------------------

describe('parseMfaErrorResponse', () => {
  it("returns 'required' for an mfa_required response with an mfa_token", () => {
    const body = {
      error: 'mfa_required',
      mfa_token: 'mfa-token-xyz',
      error_description: 'MFA is required',
    };
    const result = parseMfaErrorResponse(body);

    expect(result.status).toBe('required');
    if (result.status === 'required') {
      expect(result.error.code).toBe(MFA_ERROR_CODES.MFA_REQUIRED);
      expect(result.error.mfaToken).toBe('mfa-token-xyz');
      expect(result.error.message).toBe('MFA is required');
    }
  });

  it("returns 'required' for an mfa_required response without an mfa_token", () => {
    const body = { error: 'mfa_required', error_description: 'Please complete MFA' };
    const result = parseMfaErrorResponse(body);

    expect(result.status).toBe('required');
    if (result.status === 'required') {
      expect(result.error.code).toBe(MFA_ERROR_CODES.MFA_REQUIRED);
      expect('mfaToken' in result.error).toBe(false);
    }
  });

  it("returns 'enrollment_required' for an mfa_enrollment_required response", () => {
    const body = {
      error: 'mfa_enrollment_required',
      enrollment_url: 'https://tenant.auth0.com/enroll',
    };
    const result = parseMfaErrorResponse(body);

    expect(result.status).toBe('enrollment_required');
    if (result.status === 'enrollment_required') {
      expect(result.enrollmentUrl).toBe('https://tenant.auth0.com/enroll');
    }
  });

  it("returns 'enrollment_required' with empty enrollmentUrl when none is provided", () => {
    const body = { error: 'mfa_enrollment_required' };
    const result = parseMfaErrorResponse(body);

    expect(result.status).toBe('enrollment_required');
    if (result.status === 'enrollment_required') {
      expect(result.enrollmentUrl).toBe('');
    }
  });

  it("returns 'required' for mfa_token_invalid", () => {
    const body = { error: 'mfa_token_invalid', error_description: 'Token is expired' };
    const result = parseMfaErrorResponse(body);

    expect(result.status).toBe('required');
    if (result.status === 'required') {
      expect(result.error.code).toBe(MFA_ERROR_CODES.MFA_TOKEN_INVALID);
    }
  });

  it("returns 'required' for mfa_factor_not_enrolled", () => {
    const body = { error: 'mfa_factor_not_enrolled', error_description: 'Factor missing' };
    const result = parseMfaErrorResponse(body);

    expect(result.status).toBe('required');
    if (result.status === 'required') {
      expect(result.error.code).toBe(MFA_ERROR_CODES.MFA_FACTOR_NOT_ENROLLED);
    }
  });

  it("returns 'required' for a non-MFA error body", () => {
    const body = { error: 'invalid_client', error_description: 'Unknown client' };
    const result = parseMfaErrorResponse(body);

    expect(result.status).toBe('required');
    if (result.status === 'required') {
      expect(result.error.code).toBe(MFA_ERROR_CODES.MFA_REQUIRED);
      expect(result.error.message).toBe('Unknown client');
    }
  });

  it("returns 'required' for a null body", () => {
    const result = parseMfaErrorResponse(null);

    expect(result.status).toBe('required');
  });

  it("returns 'required' for a non-object body", () => {
    const result = parseMfaErrorResponse('error string');

    expect(result.status).toBe('required');
  });

  it("returns 'required' for an object without an error field", () => {
    const result = parseMfaErrorResponse({ message: 'something went wrong' });

    expect(result.status).toBe('required');
  });
});
