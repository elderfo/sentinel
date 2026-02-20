import type { VaultConfig } from '@sentinel/shared';

// Access process.env via globalThis for ESLint compatibility — identical runtime
// behaviour; vi.stubEnv works transparently because it mutates process.env directly.
const nodeEnv =
  (
    (globalThis as Record<string, unknown>)['process'] as
      | { env: Record<string, string | undefined> }
      | undefined
  )?.env ?? {};

/**
 * Loads the vault encryption key from environment variables.
 * The key must be a 64-character hex string representing a 32-byte AES-256 key.
 * Fails fast with a clear error if the variable is missing or malformed.
 */
export function loadVaultConfig(): VaultConfig {
  const raw = nodeEnv['SENTINEL_VAULT_KEY'];

  if (!raw) {
    throw new Error(
      'Vault configuration is incomplete. Missing environment variable: SENTINEL_VAULT_KEY',
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('SENTINEL_VAULT_KEY must be a 64-character hex string (32 bytes for AES-256).');
  }

  return { encryptionKey: raw };
}
