import { describe, it, expect } from 'vitest';
import {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  hasRole,
} from '../auth/rbac.js';
import type { AuthUser } from '../auth/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ROLES constants
// ---------------------------------------------------------------------------

describe('ROLES', () => {
  it('defines admin role', () => {
    expect(ROLES.ADMIN).toBe('admin');
  });

  it('defines engineer role', () => {
    expect(ROLES.ENGINEER).toBe('engineer');
  });

  it('defines viewer role', () => {
    expect(ROLES.VIEWER).toBe('viewer');
  });
});

// ---------------------------------------------------------------------------
// PERMISSIONS constants
// ---------------------------------------------------------------------------

describe('PERMISSIONS', () => {
  it('defines tests:create', () => {
    expect(PERMISSIONS.TESTS_CREATE).toBe('tests:create');
  });

  it('defines tests:run', () => {
    expect(PERMISSIONS.TESTS_RUN).toBe('tests:run');
  });

  it('defines tests:delete', () => {
    expect(PERMISSIONS.TESTS_DELETE).toBe('tests:delete');
  });

  it('defines results:read', () => {
    expect(PERMISSIONS.RESULTS_READ).toBe('results:read');
  });

  it('defines settings:manage', () => {
    expect(PERMISSIONS.SETTINGS_MANAGE).toBe('settings:manage');
  });

  it('defines credentials:manage', () => {
    expect(PERMISSIONS.CREDENTIALS_MANAGE).toBe('credentials:manage');
  });
});

// ---------------------------------------------------------------------------
// ROLE_PERMISSIONS mapping
// ---------------------------------------------------------------------------

describe('ROLE_PERMISSIONS', () => {
  it('maps admin to all permissions', () => {
    const allPermissions = Object.values(PERMISSIONS);
    const adminPermissions = ROLE_PERMISSIONS[ROLES.ADMIN];

    expect(adminPermissions).toHaveLength(allPermissions.length);
    for (const permission of allPermissions) {
      expect(adminPermissions).toContain(permission);
    }
  });

  it('maps engineer to create, run, and read permissions', () => {
    const engineerPermissions = ROLE_PERMISSIONS[ROLES.ENGINEER];

    expect(engineerPermissions).toContain(PERMISSIONS.TESTS_CREATE);
    expect(engineerPermissions).toContain(PERMISSIONS.TESTS_RUN);
    expect(engineerPermissions).toContain(PERMISSIONS.RESULTS_READ);
    expect(engineerPermissions).not.toContain(PERMISSIONS.TESTS_DELETE);
    expect(engineerPermissions).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    expect(engineerPermissions).not.toContain(PERMISSIONS.CREDENTIALS_MANAGE);
  });

  it('maps viewer to results:read only', () => {
    const viewerPermissions = ROLE_PERMISSIONS[ROLES.VIEWER];

    expect(viewerPermissions).toHaveLength(1);
    expect(viewerPermissions).toContain(PERMISSIONS.RESULTS_READ);
  });
});

// ---------------------------------------------------------------------------
// hasPermission
// ---------------------------------------------------------------------------

describe('hasPermission', () => {
  it('returns true when user has the specified permission', () => {
    const user = makeUser({ permissions: [PERMISSIONS.RESULTS_READ] });

    expect(hasPermission(user, PERMISSIONS.RESULTS_READ)).toBe(true);
  });

  it('returns false when user lacks the specified permission', () => {
    const user = makeUser({ permissions: [PERMISSIONS.RESULTS_READ] });

    expect(hasPermission(user, PERMISSIONS.TESTS_CREATE)).toBe(false);
  });

  it('returns false for a user with no permissions', () => {
    const user = makeUser({ permissions: [] });

    expect(hasPermission(user, PERMISSIONS.RESULTS_READ)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasAllPermissions
// ---------------------------------------------------------------------------

describe('hasAllPermissions', () => {
  it('returns true when user has all required permissions', () => {
    const user = makeUser({
      permissions: [PERMISSIONS.TESTS_CREATE, PERMISSIONS.TESTS_RUN, PERMISSIONS.RESULTS_READ],
    });

    expect(hasAllPermissions(user, [PERMISSIONS.TESTS_CREATE, PERMISSIONS.RESULTS_READ])).toBe(
      true,
    );
  });

  it('returns false when user is missing at least one required permission', () => {
    const user = makeUser({ permissions: [PERMISSIONS.RESULTS_READ] });

    expect(hasAllPermissions(user, [PERMISSIONS.RESULTS_READ, PERMISSIONS.TESTS_CREATE])).toBe(
      false,
    );
  });

  it('returns true for an empty permissions list', () => {
    const user = makeUser({ permissions: [] });

    expect(hasAllPermissions(user, [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasAnyPermission
// ---------------------------------------------------------------------------

describe('hasAnyPermission', () => {
  it('returns true when user has at least one of the required permissions', () => {
    const user = makeUser({ permissions: [PERMISSIONS.RESULTS_READ] });

    expect(hasAnyPermission(user, [PERMISSIONS.TESTS_CREATE, PERMISSIONS.RESULTS_READ])).toBe(true);
  });

  it('returns false when user has none of the required permissions', () => {
    const user = makeUser({ permissions: [PERMISSIONS.RESULTS_READ] });

    expect(hasAnyPermission(user, [PERMISSIONS.TESTS_CREATE, PERMISSIONS.TESTS_RUN])).toBe(false);
  });

  it('returns false for an empty permissions list', () => {
    const user = makeUser({ permissions: [PERMISSIONS.RESULTS_READ] });

    expect(hasAnyPermission(user, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasRole
// ---------------------------------------------------------------------------

describe('hasRole', () => {
  it('returns true when user has the specified role', () => {
    const user = makeUser({ roles: [ROLES.ENGINEER] });

    expect(hasRole(user, ROLES.ENGINEER)).toBe(true);
  });

  it('returns false when user does not have the specified role', () => {
    const user = makeUser({ roles: [ROLES.VIEWER] });

    expect(hasRole(user, ROLES.ADMIN)).toBe(false);
  });

  it('returns false for a user with no roles', () => {
    const user = makeUser({ roles: [] });

    expect(hasRole(user, ROLES.VIEWER)).toBe(false);
  });
});
