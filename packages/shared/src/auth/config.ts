import type { AuthConfig } from './types.js';

// ESLint's type-checker cannot resolve `process` without @types/node hoisted to the
// workspace root. We access process.env through globalThis to satisfy the linter while
// preserving identical runtime behaviour. vi.stubEnv works transparently with this approach
// because it mutates process.env directly.
const nodeEnv =
  (
    (globalThis as Record<string, unknown>)['process'] as
      | { env: Record<string, string | undefined> }
      | undefined
  )?.env ?? {};

/**
 * Loads Auth0 configuration from environment variables.
 * Fails fast with a clear error message if any required variable is missing,
 * preventing misconfigured services from starting silently.
 */
export function loadAuthConfig(): AuthConfig {
  const domain = nodeEnv['AUTH0_DOMAIN'];
  const clientId = nodeEnv['AUTH0_CLIENT_ID'];
  const clientSecret = nodeEnv['AUTH0_CLIENT_SECRET'];
  const audience = nodeEnv['AUTH0_AUDIENCE'];
  const callbackUrl = nodeEnv['AUTH0_CALLBACK_URL'];
  const logoutUrl = nodeEnv['AUTH0_LOGOUT_URL'];

  const missing: string[] = [];
  if (!domain) missing.push('AUTH0_DOMAIN');
  if (!clientId) missing.push('AUTH0_CLIENT_ID');
  if (!clientSecret) missing.push('AUTH0_CLIENT_SECRET');
  if (!audience) missing.push('AUTH0_AUDIENCE');
  if (!callbackUrl) missing.push('AUTH0_CALLBACK_URL');
  if (!logoutUrl) missing.push('AUTH0_LOGOUT_URL');

  if (missing.length > 0) {
    throw new Error(
      `Auth0 configuration is incomplete. Missing environment variables: ${missing.join(', ')}`,
    );
  }

  return {
    // Non-null assertions are safe: we threw above if any were falsy
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    domain: domain!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    clientId: clientId!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    clientSecret: clientSecret!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    audience: audience!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    callbackUrl: callbackUrl!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    logoutUrl: logoutUrl!,
  };
}
