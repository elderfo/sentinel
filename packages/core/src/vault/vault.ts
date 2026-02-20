import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { forbiddenError, hasPermission, PERMISSIONS } from '@sentinel/shared';
import type {
  StoredCredential,
  CredentialInput,
  PlaintextCredential,
  MaskedCredential,
  VaultConfig,
} from '@sentinel/shared';
import type { AuthUser, AuthError } from '@sentinel/shared';
import type { CredentialStore } from './store.js';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTE_LENGTH = 12; // 96-bit IV — recommended for GCM
const AUTH_TAG_BYTE_LENGTH = 16; // 128-bit authentication tag

interface EncryptResult {
  readonly ciphertext: Uint8Array;
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
}

/** Generates a random credential ID. */
function generateId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Encrypts plaintext using AES-256-GCM with a fresh random IV per call.
 * The auth tag is extracted after finalising to enable integrity verification on decrypt.
 */
function encrypt(plaintext: string, keyHex: string): EncryptResult {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTE_LENGTH });

  const part1 = cipher.update(plaintext, 'utf8');
  const part2 = cipher.final();
  const ciphertext = Buffer.concat([part1, part2]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv: new Uint8Array(iv),
    authTag: new Uint8Array(authTag),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext.
 * Throws if the key is wrong or the ciphertext has been tampered with —
 * the auth tag verification catches both cases.
 */
function decrypt(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  authTag: Uint8Array,
  keyHex: string,
): string {
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTE_LENGTH });
  decipher.setAuthTag(Buffer.from(authTag));

  const part1 = decipher.update(Buffer.from(ciphertext));
  const part2 = decipher.final();
  return Buffer.concat([part1, part2]).toString('utf8');
}

/** The plaintext payload serialised into the encrypted value. */
interface CredentialPayload {
  readonly username: string;
  readonly password: string;
  readonly url?: string;
}

/**
 * Credential vault — encrypts, stores, retrieves, and deletes target application credentials.
 *
 * All write and read operations require the caller to hold the `credentials:manage` permission.
 * Plaintext is only accessible via `getCredentialPlaintext` and must never be logged or
 * included in API responses.
 */
export class CredentialVault {
  private readonly config: VaultConfig;
  private readonly store: CredentialStore;

  constructor(config: VaultConfig, store: CredentialStore) {
    this.config = config;
    this.store = store;
  }

  /**
   * Creates and persists an encrypted credential.
   * Returns a 403 error if the user lacks `credentials:manage`.
   */
  createCredential(
    input: CredentialInput,
    user: AuthUser,
  ):
    | { readonly ok: true; readonly credential: StoredCredential }
    | { readonly ok: false; readonly error: AuthError } {
    const permCheck = this.checkPermission(user);
    if (!permCheck.ok) {
      return permCheck;
    }

    const payload: CredentialPayload = {
      username: input.username,
      password: input.password,
      ...(input.url !== undefined && { url: input.url }),
    };

    const { ciphertext, iv, authTag } = encrypt(JSON.stringify(payload), this.config.encryptionKey);

    const now = new Date();
    const credential: StoredCredential = {
      id: generateId(),
      name: input.name,
      encryptedValue: ciphertext,
      iv,
      authTag,
      createdAt: now,
      updatedAt: now,
    };

    this.store.save(credential);
    return { ok: true, credential };
  }

  /**
   * Retrieves the masked (API-safe) representation of a stored credential.
   * Returns a 403 error if the user lacks `credentials:manage`.
   */
  getCredential(
    id: string,
    user: AuthUser,
  ):
    | { readonly ok: true; readonly credential: MaskedCredential }
    | { readonly ok: false; readonly error: AuthError }
    | { readonly ok: false; readonly notFound: true } {
    const permCheck = this.checkPermission(user);
    if (!permCheck.ok) {
      return permCheck;
    }

    const stored = this.store.findById(id);
    if (!stored) {
      return { ok: false, notFound: true };
    }

    return { ok: true, credential: this.maskCredential(stored) };
  }

  /**
   * Lists masked representations of all stored credentials.
   * Returns a 403 error if the user lacks `credentials:manage`.
   */
  listCredentials(
    user: AuthUser,
  ):
    | { readonly ok: true; readonly credentials: readonly MaskedCredential[] }
    | { readonly ok: false; readonly error: AuthError } {
    const permCheck = this.checkPermission(user);
    if (!permCheck.ok) {
      return permCheck;
    }

    const credentials = this.store.findAll().map((s) => this.maskCredential(s));
    return { ok: true, credentials };
  }

  /**
   * Decrypts and returns the plaintext credential for internal use during test execution.
   * This value must never be written to logs or returned in API responses.
   * Returns a 403 error if the user lacks `credentials:manage`.
   */
  getCredentialPlaintext(
    id: string,
    user: AuthUser,
  ):
    | { readonly ok: true; readonly credential: PlaintextCredential }
    | { readonly ok: false; readonly error: AuthError }
    | { readonly ok: false; readonly notFound: true } {
    const permCheck = this.checkPermission(user);
    if (!permCheck.ok) {
      return permCheck;
    }

    const stored = this.store.findById(id);
    if (!stored) {
      return { ok: false, notFound: true };
    }

    const plaintext = decrypt(
      stored.encryptedValue,
      stored.iv,
      stored.authTag,
      this.config.encryptionKey,
    );
    const payload = JSON.parse(plaintext) as CredentialPayload;

    const credential: PlaintextCredential = {
      id: stored.id,
      name: stored.name,
      username: payload.username,
      password: payload.password,
      ...(payload.url !== undefined && { url: payload.url }),
    };

    return { ok: true, credential };
  }

  /**
   * Permanently removes a stored credential by ID.
   * Returns a 403 error if the user lacks `credentials:manage`.
   */
  deleteCredential(
    id: string,
    user: AuthUser,
  ):
    | { readonly ok: true; readonly deleted: boolean }
    | { readonly ok: false; readonly error: AuthError } {
    const permCheck = this.checkPermission(user);
    if (!permCheck.ok) {
      return permCheck;
    }

    const deleted = this.store.delete(id);
    return { ok: true, deleted };
  }

  /** Produces the API-safe masked view of a stored credential. */
  maskCredential(stored: StoredCredential): MaskedCredential {
    const plaintext = decrypt(
      stored.encryptedValue,
      stored.iv,
      stored.authTag,
      this.config.encryptionKey,
    );
    const payload = JSON.parse(plaintext) as CredentialPayload;

    return {
      id: stored.id,
      name: stored.name,
      username: payload.username,
      password: '***',
      ...(payload.url !== undefined && { url: payload.url }),
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
  }

  private checkPermission(
    user: AuthUser,
  ): { readonly ok: true } | { readonly ok: false; readonly error: AuthError } {
    if (!hasPermission(user, PERMISSIONS.CREDENTIALS_MANAGE)) {
      return {
        ok: false,
        error: forbiddenError(
          `Insufficient permissions. Required: ${PERMISSIONS.CREDENTIALS_MANAGE}`,
        ),
      };
    }
    return { ok: true };
  }
}
