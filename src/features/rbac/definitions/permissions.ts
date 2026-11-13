export const PERMISSIONS = {
  USERS: {
    CREATE: 'users.create',
    READ: 'users.read',
    UPDATE: 'users.update',
    DELETE: 'users.delete',
  },
  ROLES: {
    CREATE: 'roles.create',
    READ: 'roles.read',
    UPDATE: 'roles.update',
    DELETE: 'roles.delete',
    ASSIGN: 'roles.assign',
  },
  PERMISSIONS: {
    READ: 'permissions.read',
    ASSIGN: 'permissions.assign',
  },
  PROJECTS: {
    CREATE: 'projects.create',
    READ: 'projects.read',
    UPDATE: 'projects.update',
    DELETE: 'projects.delete',
  },
  SESSIONS: {
    READ: 'sessions.read',
    REVOKE: 'sessions.revoke',
  },
  ADMIN: {
    ACCESS: 'admin.access',
  },
} as const;

type NestedValues<T> = T extends string
  ? T
  : { [K in keyof T]: NestedValues<T[K]> }[keyof T];

export type PermissionKey = NestedValues<typeof PERMISSIONS>;

export type PermissionDefinition = {
  key: PermissionKey;
  resource: string;
  action: string;
  description: string;
  isSystem: true;
  dependsOn: readonly PermissionKey[];
};

function definition(
  key: PermissionKey,
  description: string,
  dependsOn: readonly PermissionKey[] = [],
): PermissionDefinition {
  const [resource, action] = key.split('.') as [string, string];

  return {
    key,
    resource,
    action,
    description,
    isSystem: true,
    dependsOn,
  };
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  definition(PERMISSIONS.USERS.CREATE, 'Create users'),
  definition(PERMISSIONS.USERS.READ, 'Read users'),
  definition(PERMISSIONS.USERS.UPDATE, 'Update users', [
    PERMISSIONS.USERS.READ,
  ]),
  definition(PERMISSIONS.USERS.DELETE, 'Delete users', [
    PERMISSIONS.USERS.READ,
  ]),
  definition(PERMISSIONS.ROLES.CREATE, 'Create roles'),
  definition(PERMISSIONS.ROLES.READ, 'Read roles'),
  definition(PERMISSIONS.ROLES.UPDATE, 'Update roles', [
    PERMISSIONS.ROLES.READ,
  ]),
  definition(PERMISSIONS.ROLES.DELETE, 'Delete roles', [
    PERMISSIONS.ROLES.READ,
  ]),
  definition(PERMISSIONS.ROLES.ASSIGN, 'Assign roles to users', [
    PERMISSIONS.ROLES.READ,
    PERMISSIONS.PERMISSIONS.READ,
  ]),
  definition(PERMISSIONS.PERMISSIONS.READ, 'Read permissions'),
  definition(PERMISSIONS.PERMISSIONS.ASSIGN, 'Assign direct permissions', [
    PERMISSIONS.PERMISSIONS.READ,
  ]),
  definition(PERMISSIONS.PROJECTS.CREATE, 'Create projects'),
  definition(PERMISSIONS.PROJECTS.READ, 'Read projects'),
  definition(PERMISSIONS.PROJECTS.UPDATE, 'Update projects', [
    PERMISSIONS.PROJECTS.READ,
  ]),
  definition(PERMISSIONS.PROJECTS.DELETE, 'Delete projects', [
    PERMISSIONS.PROJECTS.READ,
  ]),
  definition(PERMISSIONS.SESSIONS.READ, 'Read user sessions'),
  definition(PERMISSIONS.SESSIONS.REVOKE, 'Revoke user sessions', [
    PERMISSIONS.SESSIONS.READ,
  ]),
  definition(PERMISSIONS.ADMIN.ACCESS, 'Access the Admin API'),
];

export const PERMISSION_KEYS = PERMISSION_DEFINITIONS.map(
  (permission) => permission.key,
) as PermissionKey[];

export const PERMISSION_BY_KEY: ReadonlyMap<
  PermissionKey,
  PermissionDefinition
> = new Map(
  PERMISSION_DEFINITIONS.map((permission) => [permission.key, permission]),
);
