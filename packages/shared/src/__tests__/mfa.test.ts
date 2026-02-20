import { describe, it, expect } from 'vitest';
import { MFA_ERROR_CODES, isMfaError, createMfaError } from '../auth/mfa.js';
import type { AuthError } from '../auth/types.js';

describe('MFA_ERROR_CODES', () => {
  it('contains the expected mfa_required code', () => {
    expect(MFA_ERROR_CODES.MFA_REQUIRED).toBe('mfa_required');
  });

  it('contains the expected mfa_enrollment_required code', () => {
    expect(MFA_ERROR_CODES.MFA_ENROLLMENT_REQUIRED).toBe('mfa_enrollment_required');
  });

  it('contains the expected mfa_token_invalid code', () => {
    expect(MFA_ERROR_CODES.MFA_TOKEN_INVALID).toBe('mfa_token_invalid');
  });

  it('contains the expected mfa_factor_not_enrolled code', () => {
    expect(MFA_ERROR_CODES.MFA_FACTOR_NOT_ENROLLED).toBe('mfa_factor_not_enrolled');
  });
});

describe('isMfaError', () => {
  it('returns true for an error with an MFA error code', () => {
    const error: AuthError = {
      code: MFA_ERROR_CODES.MFA_REQUIRED,
      message: 'MFA is required',
      statusCode: 403,
    };

    expect(isMfaError(error)).toBe(true);
  });

  it('returns true for mfa_enrollment_required code', () => {
    const error: AuthError = {
      code: MFA_ERROR_CODES.MFA_ENROLLMENT_REQUIRED,
      message: 'Enrollment required',
      statusCode: 403,
    };

    expect(isMfaError(error)).toBe(true);
  });

  it('returns true for mfa_token_invalid code', () => {
    const error: AuthError = {
      code: MFA_ERROR_CODES.MFA_TOKEN_INVALID,
      message: 'MFA token is invalid',
      statusCode: 403,
    };

    expect(isMfaError(error)).toBe(true);
  });

  it('returns true for mfa_factor_not_enrolled code', () => {
    const error: AuthError = {
      code: MFA_ERROR_CODES.MFA_FACTOR_NOT_ENROLLED,
      message: 'Factor not enrolled',
      statusCode: 403,
    };

    expect(isMfaError(error)).toBe(true);
  });

  it('returns false for a non-MFA error code', () => {
    const error: AuthError = {
      code: 'UNAUTHORIZED',
      message: 'Not authenticated',
      statusCode: 401,
    };

    expect(isMfaError(error)).toBe(false);
  });

  it('returns false for FORBIDDEN error code', () => {
    const error: AuthError = {
      code: 'FORBIDDEN',
      message: 'Access denied',
      statusCode: 403,
    };

    expect(isMfaError(error)).toBe(false);
  });

  it('returns false for AUTH_CONFIG_ERROR code', () => {
    const error: AuthError = {
      code: 'AUTH_CONFIG_ERROR',
      message: 'Config error',
      statusCode: 500,
    };

    expect(isMfaError(error)).toBe(false);
  });
});

describe('createMfaError', () => {
  it('creates an MfaError with the correct code, message, and statusCode', () => {
    const err = createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, 'MFA is required');

    expect(err.code).toBe(MFA_ERROR_CODES.MFA_REQUIRED);
    expect(err.message).toBe('MFA is required');
    expect(err.statusCode).toBe(403);
  });

  it('does not include mfaToken when not provided', () => {
    const err = createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, 'MFA is required');

    expect('mfaToken' in err).toBe(false);
  });

  it('includes mfaToken when provided', () => {
    const err = createMfaError(MFA_ERROR_CODES.MFA_REQUIRED, 'MFA is required', 'mfa-token-abc');

    expect(err.mfaToken).toBe('mfa-token-abc');
  });

  it('creates an enrollment_required error with the correct code', () => {
    const err = createMfaError(MFA_ERROR_CODES.MFA_ENROLLMENT_REQUIRED, 'Please enroll in MFA');

    expect(err.code).toBe(MFA_ERROR_CODES.MFA_ENROLLMENT_REQUIRED);
    expect(err.statusCode).toBe(403);
  });

  it('creates a factor_not_enrolled error with mfaToken', () => {
    const err = createMfaError(
      MFA_ERROR_CODES.MFA_FACTOR_NOT_ENROLLED,
      'Factor not enrolled',
      'tok-xyz',
    );

    expect(err.code).toBe(MFA_ERROR_CODES.MFA_FACTOR_NOT_ENROLLED);
    expect(err.mfaToken).toBe('tok-xyz');
  });

  it('isMfaError returns true for errors produced by createMfaError', () => {
    const err = createMfaError(MFA_ERROR_CODES.MFA_TOKEN_INVALID, 'Invalid token');

    expect(isMfaError(err)).toBe(true);
  });
});
