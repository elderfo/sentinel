/**
 * Domain types for the Sentinel credential vault.
 * Credentials are encrypted at rest; only masked representations leave the vault boundary.
 */

/** The encrypted-at-rest credential record. Never expose this directly via API responses. */
export interface StoredCredential {
  readonly id: string;
  readonly name: string;
  /** AES-256-GCM ciphertext of the JSON-serialized plaintext credential. */
  readonly encryptedValue: Uint8Array;
  /** Initialisation vector used during encryption — unique per credential. */
  readonly iv: Uint8Array;
  /** AES-GCM authentication tag — verifies ciphertext integrity during decryption. */
  readonly authTag: Uint8Array;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Input provided by the caller when creating a new stored credential. */
export interface CredentialInput {
  readonly name: string;
  readonly username: string;
  readonly password: string;
  readonly url?: string;
}

/** The plaintext credential — decrypted from storage for internal use only during test execution. */
export interface PlaintextCredential {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly password: string;
  readonly url?: string;
}

/**
 * The safe API-facing representation of a credential.
 * The password field is always masked; the plaintext is never returned to callers.
 */
export interface MaskedCredential {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly password: '***';
  readonly url?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Vault configuration loaded from environment variables. */
export interface VaultConfig {
  /**
   * 32-byte AES-256 key represented as a 64-character hex string.
   * Loaded from the SENTINEL_VAULT_KEY environment variable.
   */
  readonly encryptionKey: string;
}
