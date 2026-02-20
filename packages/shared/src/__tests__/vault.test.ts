import { describe, it, expect } from 'vitest';
import type {
  StoredCredential,
  CredentialInput,
  PlaintextCredential,
  MaskedCredential,
  VaultConfig,
} from '../vault/index.js';

// ---------------------------------------------------------------------------
// Type-level tests — verified via TypeScript compilation, not runtime assertions
// ---------------------------------------------------------------------------

describe('vault types', () => {
  it('StoredCredential shape is correct', () => {
    const stored: StoredCredential = {
      id: 'cred-1',
      name: 'staging-login',
      encryptedValue: new Uint8Array([1, 2, 3]),
      iv: new Uint8Array([4, 5, 6]),
      authTag: new Uint8Array([7, 8, 9]),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(stored.id).toBe('cred-1');
    expect(stored.encryptedValue).toBeInstanceOf(Uint8Array);
    expect(stored.iv).toBeInstanceOf(Uint8Array);
    expect(stored.authTag).toBeInstanceOf(Uint8Array);
  });

  it('CredentialInput shape is correct', () => {
    const input: CredentialInput = {
      name: 'staging-login',
      username: 'admin',
      password: 's3cr3t',
    };

    expect(input.name).toBe('staging-login');
    expect(input.url).toBeUndefined();
  });

  it('CredentialInput accepts optional url', () => {
    const input: CredentialInput = {
      name: 'prod-login',
      username: 'admin',
      password: 's3cr3t',
      url: 'https://example.com',
    };

    expect(input.url).toBe('https://example.com');
  });

  it('PlaintextCredential shape is correct', () => {
    const plaintext: PlaintextCredential = {
      id: 'cred-1',
      name: 'staging-login',
      username: 'admin',
      password: 's3cr3t',
    };

    expect(plaintext.password).toBe('s3cr3t');
    expect(plaintext.url).toBeUndefined();
  });

  it('MaskedCredential always has password masked as literal "***"', () => {
    const masked: MaskedCredential = {
      id: 'cred-1',
      name: 'staging-login',
      username: 'admin',
      password: '***',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // TypeScript enforces this is the literal type '***' — the string value confirms it at runtime.
    expect(masked.password).toBe('***');
  });

  it('VaultConfig shape is correct', () => {
    const config: VaultConfig = {
      encryptionKey: 'a'.repeat(64),
    };

    expect(config.encryptionKey).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// Re-export accessibility from the package root
// ---------------------------------------------------------------------------

describe('vault type exports from @sentinel/shared', () => {
  it('imports StoredCredential type from vault index without error', () => {
    // If this file compiles the types are accessible — confirmed by TypeScript.
    const value: StoredCredential = {
      id: 'x',
      name: 'y',
      encryptedValue: new Uint8Array(),
      iv: new Uint8Array(),
      authTag: new Uint8Array(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(value.id).toBe('x');
  });
});
