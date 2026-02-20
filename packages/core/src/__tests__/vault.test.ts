import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PERMISSIONS } from '@sentinel/shared';
import type { AuthUser, CredentialInput } from '@sentinel/shared';
import { CredentialVault, InMemoryCredentialStore, loadVaultConfig } from '../vault/index.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** A valid 64-character hex key (32 bytes) for AES-256. */
const VALID_KEY = 'a'.repeat(64);

/** A different valid key — used to verify cross-key decryption fails. */
const DIFFERENT_KEY = 'b'.repeat(64);

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: 'user|test',
    email: 'test@example.com',
    name: 'Test User',
    roles: [],
    permissions: [],
    ...overrides,
  };
}

function makeAuthorisedUser(): AuthUser {
  return makeUser({ permissions: [PERMISSIONS.CREDENTIALS_MANAGE] });
}

function makeUnauthorisedUser(): AuthUser {
  return makeUser({ permissions: [] });
}

const SAMPLE_INPUT: CredentialInput = {
  name: 'staging-login',
  username: 'admin',
  password: 'sup3r-s3cr3t',
};

const SAMPLE_INPUT_WITH_URL: CredentialInput = {
  name: 'prod-login',
  username: 'deploy',
  password: 'p@ssw0rd',
  url: 'https://example.com/login',
};

function makeVault(keyHex: string = VALID_KEY): {
  vault: CredentialVault;
  store: InMemoryCredentialStore;
} {
  const store = new InMemoryCredentialStore();
  const vault = new CredentialVault({ encryptionKey: keyHex }, store);
  return { vault, store };
}

// ---------------------------------------------------------------------------
// loadVaultConfig
// ---------------------------------------------------------------------------

describe('loadVaultConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a VaultConfig when SENTINEL_VAULT_KEY is a valid 64-char hex string', () => {
    vi.stubEnv('SENTINEL_VAULT_KEY', VALID_KEY);

    const config = loadVaultConfig();

    expect(config.encryptionKey).toBe(VALID_KEY);
  });

  it('throws when SENTINEL_VAULT_KEY is missing', () => {
    vi.stubEnv('SENTINEL_VAULT_KEY', '');

    expect(() => loadVaultConfig()).toThrow('SENTINEL_VAULT_KEY');
  });

  it('throws when SENTINEL_VAULT_KEY is too short', () => {
    vi.stubEnv('SENTINEL_VAULT_KEY', 'abc123');

    expect(() => loadVaultConfig()).toThrow('64-character hex string');
  });

  it('throws when SENTINEL_VAULT_KEY contains non-hex characters', () => {
    vi.stubEnv('SENTINEL_VAULT_KEY', 'z'.repeat(64));

    expect(() => loadVaultConfig()).toThrow('64-character hex string');
  });

  it('throws when SENTINEL_VAULT_KEY is 63 characters (one short)', () => {
    vi.stubEnv('SENTINEL_VAULT_KEY', 'a'.repeat(63));

    expect(() => loadVaultConfig()).toThrow('64-character hex string');
  });

  it('throws when SENTINEL_VAULT_KEY is 65 characters (one over)', () => {
    vi.stubEnv('SENTINEL_VAULT_KEY', 'a'.repeat(65));

    expect(() => loadVaultConfig()).toThrow('64-character hex string');
  });

  it('accepts uppercase hex characters', () => {
    vi.stubEnv('SENTINEL_VAULT_KEY', 'A'.repeat(64));

    const config = loadVaultConfig();

    expect(config.encryptionKey).toBe('A'.repeat(64));
  });
});

// ---------------------------------------------------------------------------
// Encryption round-trip
// ---------------------------------------------------------------------------

describe('CredentialVault — encryption round-trip', () => {
  it('encrypts and decrypts a credential returning the original plaintext', () => {
    const { vault } = makeVault();
    const user = makeAuthorisedUser();

    const createResult = vault.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const { id } = createResult.credential;
    const plaintextResult = vault.getCredentialPlaintext(id, user);

    expect(plaintextResult.ok).toBe(true);
    if (!plaintextResult.ok || 'notFound' in plaintextResult) return;

    expect(plaintextResult.credential.username).toBe(SAMPLE_INPUT.username);
    expect(plaintextResult.credential.password).toBe(SAMPLE_INPUT.password);
  });

  it('preserves the optional url field through an encrypt–decrypt cycle', () => {
    const { vault } = makeVault();
    const user = makeAuthorisedUser();

    const createResult = vault.createCredential(SAMPLE_INPUT_WITH_URL, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const plaintextResult = vault.getCredentialPlaintext(createResult.credential.id, user);
    expect(plaintextResult.ok).toBe(true);
    if (!plaintextResult.ok || 'notFound' in plaintextResult) return;

    expect(plaintextResult.credential.url).toBe(SAMPLE_INPUT_WITH_URL.url);
  });

  it('produces unique ciphertexts for identical inputs on each call', () => {
    const { vault } = makeVault();
    const user = makeAuthorisedUser();

    const result1 = vault.createCredential(SAMPLE_INPUT, user);
    const result2 = vault.createCredential(SAMPLE_INPUT, user);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;

    // IVs must differ — same plaintext should never produce the same ciphertext
    expect(Buffer.from(result1.credential.iv).toString('hex')).not.toBe(
      Buffer.from(result2.credential.iv).toString('hex'),
    );
    expect(Buffer.from(result1.credential.encryptedValue).toString('hex')).not.toBe(
      Buffer.from(result2.credential.encryptedValue).toString('hex'),
    );
  });
});

// ---------------------------------------------------------------------------
// Wrong-key decryption failure (core security requirement)
// ---------------------------------------------------------------------------

describe('CredentialVault — wrong key rejection', () => {
  it('throws when attempting to decrypt a credential with a different encryption key', () => {
    // Encrypt with VALID_KEY
    const { vault: vaultA } = makeVault(VALID_KEY);
    const user = makeAuthorisedUser();

    const createResult = vaultA.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const stored = createResult.credential;

    // Attempt to decrypt using a vault configured with a different key
    const vaultB = new CredentialVault(
      { encryptionKey: DIFFERENT_KEY },
      {
        save: () => undefined,
        findById: () => stored,
        findAll: () => [stored],
        delete: () => false,
      },
    );

    // GCM auth tag verification will fail — decryption should throw
    expect(() => {
      vaultB.getCredentialPlaintext(stored.id, user);
    }).toThrow();
  });

  it('stored encrypted bytes cannot be decoded to a readable payload without the correct key', () => {
    const { vault } = makeVault(VALID_KEY);
    const user = makeAuthorisedUser();

    const createResult = vault.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const { encryptedValue } = createResult.credential;

    // The raw bytes must not contain the plaintext password
    const rawBytes = Buffer.from(encryptedValue).toString('utf8');
    expect(rawBytes).not.toContain(SAMPLE_INPUT.password);

    const hexBytes = Buffer.from(encryptedValue).toString('hex');
    expect(hexBytes).not.toContain(Buffer.from(SAMPLE_INPUT.password).toString('hex'));
  });
});

// ---------------------------------------------------------------------------
// Masked credential
// ---------------------------------------------------------------------------

describe('CredentialVault — masked credential', () => {
  it('returns password as "***" in the masked credential', () => {
    const { vault } = makeVault();
    const user = makeAuthorisedUser();

    const createResult = vault.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const getResult = vault.getCredential(createResult.credential.id, user);
    expect(getResult.ok).toBe(true);
    if (!getResult.ok || 'notFound' in getResult) return;

    expect(getResult.credential.password).toBe('***');
  });

  it('includes the correct username in the masked credential', () => {
    const { vault } = makeVault();
    const user = makeAuthorisedUser();

    const createResult = vault.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const getResult = vault.getCredential(createResult.credential.id, user);
    expect(getResult.ok).toBe(true);
    if (!getResult.ok || 'notFound' in getResult) return;

    expect(getResult.credential.username).toBe(SAMPLE_INPUT.username);
  });

  it('includes the optional url in the masked credential when present', () => {
    const { vault } = makeVault();
    const user = makeAuthorisedUser();

    const createResult = vault.createCredential(SAMPLE_INPUT_WITH_URL, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const getResult = vault.getCredential(createResult.credential.id, user);
    expect(getResult.ok).toBe(true);
    if (!getResult.ok || 'notFound' in getResult) return;

    expect(getResult.credential.url).toBe(SAMPLE_INPUT_WITH_URL.url);
  });

  it('omits url from the masked credential when it was not provided', () => {
    const { vault } = makeVault();
    const user = makeAuthorisedUser();

    const createResult = vault.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const getResult = vault.getCredential(createResult.credential.id, user);
    expect(getResult.ok).toBe(true);
    if (!getResult.ok || 'notFound' in getResult) return;

    expect(getResult.credential.url).toBeUndefined();
  });

  it('includes createdAt and updatedAt in the masked credential', () => {
    const { vault } = makeVault();
    const user = makeAuthorisedUser();

    const createResult = vault.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const getResult = vault.getCredential(createResult.credential.id, user);
    expect(getResult.ok).toBe(true);
    if (!getResult.ok || 'notFound' in getResult) return;

    expect(getResult.credential.createdAt).toBeInstanceOf(Date);
    expect(getResult.credential.updatedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

describe('CredentialVault — CRUD', () => {
  let vault: CredentialVault;
  let user: AuthUser;

  beforeEach(() => {
    ({ vault } = makeVault());
    user = makeAuthorisedUser();
  });

  it('stores multiple credentials and retrieves them via listCredentials', () => {
    vault.createCredential(SAMPLE_INPUT, user);
    vault.createCredential(SAMPLE_INPUT_WITH_URL, user);

    const listResult = vault.listCredentials(user);
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;

    expect(listResult.credentials).toHaveLength(2);
  });

  it('returns notFound when getting a credential with an unknown id', () => {
    const result = vault.getCredential('non-existent-id', user);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect('notFound' in result).toBe(true);
    }
  });

  it('deletes a credential and subsequent lookup returns notFound', () => {
    const createResult = vault.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const { id } = createResult.credential;

    const deleteResult = vault.deleteCredential(id, user);
    expect(deleteResult.ok).toBe(true);
    if (!deleteResult.ok) return;
    expect(deleteResult.deleted).toBe(true);

    const getResult = vault.getCredential(id, user);
    expect(getResult.ok).toBe(false);
    if (!getResult.ok) {
      expect('notFound' in getResult).toBe(true);
    }
  });

  it('delete returns deleted: false when the id does not exist', () => {
    const result = vault.deleteCredential('ghost-id', user);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deleted).toBe(false);
  });

  it('deletion permanently removes the encrypted value — it cannot be decrypted afterwards', () => {
    const createResult = vault.createCredential(SAMPLE_INPUT, user);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const { id } = createResult.credential;

    vault.deleteCredential(id, user);

    const plaintextResult = vault.getCredentialPlaintext(id, user);
    expect(plaintextResult.ok).toBe(false);
    if (!plaintextResult.ok) {
      expect('notFound' in plaintextResult).toBe(true);
    }
  });

  it('listCredentials returns an empty list when no credentials exist', () => {
    const result = vault.listCredentials(user);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.credentials).toHaveLength(0);
  });

  it('each created credential gets a unique id', () => {
    const result1 = vault.createCredential(SAMPLE_INPUT, user);
    const result2 = vault.createCredential(SAMPLE_INPUT, user);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;

    expect(result1.credential.id).not.toBe(result2.credential.id);
  });
});

// ---------------------------------------------------------------------------
// Permission enforcement — requests without credentials:manage get 403
// ---------------------------------------------------------------------------

describe('CredentialVault — permission enforcement', () => {
  let vault: CredentialVault;
  let authorisedUser: AuthUser;
  let unauthorisedUser: AuthUser;

  beforeEach(() => {
    ({ vault } = makeVault());
    authorisedUser = makeAuthorisedUser();
    unauthorisedUser = makeUnauthorisedUser();
  });

  it('createCredential rejects a user without credentials:manage with 403', () => {
    const result = vault.createCredential(SAMPLE_INPUT, unauthorisedUser);

    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('getCredential rejects a user without credentials:manage with 403', () => {
    // Create with authorised user first
    const created = vault.createCredential(SAMPLE_INPUT, authorisedUser);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = vault.getCredential(created.credential.id, unauthorisedUser);

    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('listCredentials rejects a user without credentials:manage with 403', () => {
    const result = vault.listCredentials(unauthorisedUser);

    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('getCredentialPlaintext rejects a user without credentials:manage with 403', () => {
    const created = vault.createCredential(SAMPLE_INPUT, authorisedUser);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = vault.getCredentialPlaintext(created.credential.id, unauthorisedUser);

    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('deleteCredential rejects a user without credentials:manage with 403', () => {
    const created = vault.createCredential(SAMPLE_INPUT, authorisedUser);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = vault.deleteCredential(created.credential.id, unauthorisedUser);

    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error.statusCode).toBe(403);
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('403 error includes the required permission name in the message', () => {
    const result = vault.createCredential(SAMPLE_INPUT, unauthorisedUser);

    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error.message).toContain(PERMISSIONS.CREDENTIALS_MANAGE);
    }
  });

  it('user with only other permissions is still rejected with 403', () => {
    const partialUser = makeUser({
      permissions: [PERMISSIONS.TESTS_CREATE, PERMISSIONS.RESULTS_READ],
    });
    const result = vault.createCredential(SAMPLE_INPUT, partialUser);

    expect(result.ok).toBe(false);
    if (!result.ok && 'error' in result) {
      expect(result.error.statusCode).toBe(403);
    }
  });

  it('user with credentials:manage among multiple permissions is accepted', () => {
    const multiPermUser = makeUser({
      permissions: [PERMISSIONS.TESTS_CREATE, PERMISSIONS.CREDENTIALS_MANAGE],
    });
    const result = vault.createCredential(SAMPLE_INPUT, multiPermUser);

    expect(result.ok).toBe(true);
  });
});
