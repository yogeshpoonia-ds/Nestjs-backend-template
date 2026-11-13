import { PERMISSIONS, type PermissionKey } from './permissions.js';

export const ALL_PERMISSIONS = '*' as const;

export type SystemRolePermissionGrant =
  | readonly PermissionKey[]
  | typeof ALL_PERMISSIONS;

export type SystemRoleDefinition = {
  name: string;
  displayName: string;
  description: string;
  permissions: SystemRolePermissionGrant;
};

export const SYSTEM_ROLES = {
  SUPER_ADMIN: {
    name: 'super_admin',
    displayName: 'Super Administrator',
    description: 'Full administrative access',
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Administrative access',
    permissions: [
      PERMISSIONS.ADMIN.ACCESS,
      PERMISSIONS.USERS.READ,
      PERMISSIONS.USERS.CREATE,
      PERMISSIONS.USERS.UPDATE,
      PERMISSIONS.ROLES.READ,
      PERMISSIONS.PERMISSIONS.READ,
      PERMISSIONS.SESSIONS.READ,
      PERMISSIONS.SESSIONS.REVOKE,
      PERMISSIONS.PROJECTS.READ,
    ],
  },
  SUB_ADMIN: {
    name: 'sub_admin',
    displayName: 'Sub Administrator',
    description: 'Limited administrative access',
    permissions: [
      PERMISSIONS.ADMIN.ACCESS,
      PERMISSIONS.USERS.READ,
      PERMISSIONS.PROJECTS.READ,
    ],
  },
} as const satisfies Record<string, SystemRoleDefinition>;

export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] =
  Object.values(SYSTEM_ROLES);

export function grantsAllPermissions(
  permissions: SystemRolePermissionGrant,
): permissions is typeof ALL_PERMISSIONS {
  return permissions === ALL_PERMISSIONS;
}
