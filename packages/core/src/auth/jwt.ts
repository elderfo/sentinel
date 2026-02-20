import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWSHeaderParameters, FlattenedJWSInput, CryptoKey } from 'jose';
import type { AuthConfig, TokenPayload } from '@sentinel/shared';

/**
 * The minimal callable shape that jose's jwtVerify accepts as a key resolver.
 * Both createLocalJWKSet and createRemoteJWKSet satisfy this signature, allowing
 * tests to inject a local JWKS without making HTTP calls.
 */
export type JwksGetter = (
  protectedHeader?: JWSHeaderParameters,
  token?: FlattenedJWSInput,
) => Promise<CryptoKey>;

/**
 * Creates a JWKS getter that fetches the public keys from the Auth0 domain.
 * This is the production implementation — tests should inject a mock instead.
 */
export function createAuth0JwksGetter(config: AuthConfig): JwksGetter {
  const jwksUri = new URL(`https://${config.domain}/.well-known/jwks.json`);
  return createRemoteJWKSet(jwksUri);
}

/**
 * Verifies a JWT access token against the provided JWKS, checking:
 * - Signature validity
 * - Token expiry
 * - Issuer matches the Auth0 domain
 * - Audience matches the configured API audience
 *
 * Throws a JWTExpired, JWTInvalid, or JOSEError on verification failure.
 */
export async function verifyAccessToken(
  token: string,
  config: AuthConfig,
  getJwks: JwksGetter,
): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getJwks, {
    issuer: `https://${config.domain}/`,
    audience: config.audience,
  });

  const sub = payload.sub;
  const iss = payload.iss;
  const aud = payload.aud;
  const exp = payload.exp;
  const iat = payload.iat;
  const email = payload['email'];

  if (!sub || !iss || !aud || exp === undefined || iat === undefined) {
    throw new Error('Token is missing required claims');
  }

  const rawPermissions = payload['permissions'];
  const permissions: readonly string[] | undefined = Array.isArray(rawPermissions)
    ? (rawPermissions as string[])
    : undefined;

  const result: TokenPayload =
    permissions !== undefined
      ? {
          sub,
          email: typeof email === 'string' ? email : '',
          iss,
          aud,
          exp,
          iat,
          permissions,
        }
      : {
          sub,
          email: typeof email === 'string' ? email : '',
          iss,
          aud,
          exp,
          iat,
        };

  return result;
}
