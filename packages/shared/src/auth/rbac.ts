import type { AuthUser } from './types.js';

export const ROLES = {
  ADMIN: 'admin',
  ENGINEER: 'engineer',
  VIEWER: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  TESTS_CREATE: 'tests:create',
  TESTS_RUN: 'tests:run',
  TESTS_DELETE: 'tests:delete',
  RESULTS_READ: 'results:read',
  SETTINGS_MANAGE: 'settings:manage',
  CREDENTIALS_MANAGE: 'credentials:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Maps each role to the permissions it grants.
 * Admin receives all permissions; engineer and viewer receive progressively fewer.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS) as Permission[],
  [ROLES.ENGINEER]: [PERMISSIONS.TESTS_CREATE, PERMISSIONS.TESTS_RUN, PERMISSIONS.RESULTS_READ],
  [ROLES.VIEWER]: [PERMISSIONS.RESULTS_READ],
} as const;

export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

export function hasAllPermissions(user: AuthUser, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => user.permissions.includes(p));
}

export function hasAnyPermission(user: AuthUser, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => user.permissions.includes(p));
}

export function hasRole(user: AuthUser, role: Role): boolean {
  return user.roles.includes(role);
}
