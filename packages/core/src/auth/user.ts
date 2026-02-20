import type { AuthUser, TokenPayload } from '@sentinel/shared';

/**
 * Extracts an AuthUser from a verified TokenPayload.
 * The `roles` claim is not a standard JWT claim and must be added via Auth0 rules/actions;
 * it defaults to an empty array when absent.
 */
export function tokenPayloadToUser(payload: TokenPayload): AuthUser {
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.email, // name is not a standard access token claim; use email as fallback
    roles: [],
    permissions: payload.permissions ?? [],
  };
}
