import type { StoredCredential } from '@sentinel/shared';

/** Storage abstraction for encrypted credentials. Concrete implementations swap backing stores. */
export interface CredentialStore {
  save(credential: StoredCredential): void;
  findById(id: string): StoredCredential | undefined;
  findAll(): readonly StoredCredential[];
  delete(id: string): boolean;
}

/** Volatile in-process store. Suitable for testing and single-node deployments. */
export class InMemoryCredentialStore implements CredentialStore {
  private readonly store = new Map<string, StoredCredential>();

  save(credential: StoredCredential): void {
    this.store.set(credential.id, credential);
  }

  findById(id: string): StoredCredential | undefined {
    return this.store.get(id);
  }

  findAll(): readonly StoredCredential[] {
    return Array.from(this.store.values());
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }
}
