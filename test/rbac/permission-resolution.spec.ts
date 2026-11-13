import { describe, expect, it } from 'vitest';
import { buildDependencyMap } from '../../src/features/rbac/definitions/permission-graph.js';
import { PERMISSIONS } from '../../src/features/rbac/definitions/permissions.js';
import {
  computeEffectivePermissions,
  evaluatePermissionMode,
} from '../../src/features/rbac/services/compute-effective-permissions.js';

const dependencyMap = buildDependencyMap();
const allPermissionNames = [
  PERMISSIONS.USERS.READ,
  PERMISSIONS.USERS.DELETE,
  PERMISSIONS.PROJECTS.READ,
  PERMISSIONS.PROJECTS.DELETE,
  PERMISSIONS.ROLES.ASSIGN,
  PERMISSIONS.ROLES.READ,
  PERMISSIONS.PERMISSIONS.READ,
  PERMISSIONS.ADMIN.ACCESS,
];

describe('computeEffectivePermissions', () => {
  it('denies by default when the user has no roles or direct permissions', () => {
    const effective = computeEffectivePermissions({
      roleGrants: [],
      directPermissions: [],
      allPermissionNames,
      dependencyMap,
    });

    expect(effective.size).toBe(0);
  });

  it('includes permissions from one role and expands dependencies', () => {
    const effective = computeEffectivePermissions({
      roleGrants: [
        {
          isActive: true,
          isSystem: false,
          grantsAllPermissions: false,
          expiresAt: null,
          permissionNames: [PERMISSIONS.PROJECTS.DELETE],
        },
      ],
      directPermissions: [],
      allPermissionNames,
      dependencyMap,
    });

    expect(effective.has(PERMISSIONS.PROJECTS.DELETE)).toBe(true);
    expect(effective.has(PERMISSIONS.PROJECTS.READ)).toBe(true);
  });

  it('unions permissions across multiple roles', () => {
    const effective = computeEffectivePermissions({
      roleGrants: [
        {
          isActive: true,
          isSystem: false,
          grantsAllPermissions: false,
          expiresAt: null,
          permissionNames: [PERMISSIONS.USERS.READ],
        },
        {
          isActive: true,
          isSystem: false,
          grantsAllPermissions: false,
          expiresAt: null,
          permissionNames: [PERMISSIONS.PROJECTS.READ],
        },
      ],
      directPermissions: [],
      allPermissionNames,
      dependencyMap,
    });

    expect(effective.has(PERMISSIONS.USERS.READ)).toBe(true);
    expect(effective.has(PERMISSIONS.PROJECTS.READ)).toBe(true);
  });

  it('grants a direct ALLOW even without role grants', () => {
    const effective = computeEffectivePermissions({
      roleGrants: [],
      directPermissions: [
        {
          name: PERMISSIONS.USERS.READ,
          effect: 'ALLOW',
          expiresAt: null,
        },
      ],
      allPermissionNames,
      dependencyMap,
    });

    expect(effective.has(PERMISSIONS.USERS.READ)).toBe(true);
  });

  it('lets a direct DENY override role grants', () => {
    const effective = computeEffectivePermissions({
      roleGrants: [
        {
          isActive: true,
          isSystem: false,
          grantsAllPermissions: false,
          expiresAt: null,
          permissionNames: [PERMISSIONS.USERS.READ],
        },
      ],
      directPermissions: [
        {
          name: PERMISSIONS.USERS.READ,
          effect: 'DENY',
          expiresAt: null,
        },
      ],
      allPermissionNames,
      dependencyMap,
    });

    expect(effective.has(PERMISSIONS.USERS.READ)).toBe(false);
  });

  it('ignores expired direct permissions', () => {
    const effective = computeEffectivePermissions({
      now: new Date('2026-01-02T00:00:00.000Z'),
      roleGrants: [],
      directPermissions: [
        {
          name: PERMISSIONS.USERS.READ,
          effect: 'ALLOW',
          expiresAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      allPermissionNames,
      dependencyMap,
    });

    expect(effective.has(PERMISSIONS.USERS.READ)).toBe(false);
  });

  it('ignores inactive roles', () => {
    const effective = computeEffectivePermissions({
      roleGrants: [
        {
          isActive: false,
          isSystem: false,
          grantsAllPermissions: false,
          expiresAt: null,
          permissionNames: [PERMISSIONS.USERS.READ],
        },
      ],
      directPermissions: [],
      allPermissionNames,
      dependencyMap,
    });

    expect(effective.size).toBe(0);
  });

  it('honors the system-role wildcard and ignores it on custom roles', () => {
    const systemWildcard = computeEffectivePermissions({
      roleGrants: [
        {
          isActive: true,
          isSystem: true,
          grantsAllPermissions: true,
          expiresAt: null,
          permissionNames: [],
        },
      ],
      directPermissions: [],
      allPermissionNames,
      dependencyMap,
    });

    expect(systemWildcard.size).toBe(allPermissionNames.length);

    const customWildcard = computeEffectivePermissions({
      roleGrants: [
        {
          isActive: true,
          isSystem: false,
          grantsAllPermissions: true,
          expiresAt: null,
          permissionNames: [],
        },
      ],
      directPermissions: [],
      allPermissionNames,
      dependencyMap,
    });

    expect(customWildcard.size).toBe(0);
  });

  it('denies a dependent permission when a required dependency is denied', () => {
    const effective = computeEffectivePermissions({
      roleGrants: [
        {
          isActive: true,
          isSystem: false,
          grantsAllPermissions: false,
          expiresAt: null,
          permissionNames: [PERMISSIONS.USERS.DELETE],
        },
      ],
      directPermissions: [
        {
          name: PERMISSIONS.USERS.READ,
          effect: 'DENY',
          expiresAt: null,
        },
      ],
      allPermissionNames,
      dependencyMap,
    });

    expect(effective.has(PERMISSIONS.USERS.DELETE)).toBe(false);
    expect(effective.has(PERMISSIONS.USERS.READ)).toBe(false);
  });

  it('evaluates ALL and ANY permission modes', () => {
    const effective = new Set([PERMISSIONS.USERS.READ]);

    expect(
      evaluatePermissionMode(
        effective,
        [PERMISSIONS.USERS.READ, PERMISSIONS.PROJECTS.READ],
        'ALL',
      ),
    ).toBe(false);

    expect(
      evaluatePermissionMode(
        effective,
        [PERMISSIONS.USERS.READ, PERMISSIONS.PROJECTS.READ],
        'ANY',
      ),
    ).toBe(true);
  });
});
