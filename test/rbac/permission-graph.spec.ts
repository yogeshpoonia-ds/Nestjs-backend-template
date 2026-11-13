import { describe, expect, it } from 'vitest';
import {
  buildDependencyMap,
  expandDependencies,
  validatePermissionGraph,
} from '../../src/features/rbac/definitions/permission-graph.js';
import {
  PERMISSION_DEFINITIONS,
  PERMISSIONS,
  type PermissionDefinition,
} from '../../src/features/rbac/definitions/permissions.js';

describe('permission graph', () => {
  it('accepts the source-defined permission dependency graph', () => {
    expect(() => validatePermissionGraph()).not.toThrow();
  });

  it('expands recursive and multiple dependencies', () => {
    const expanded = expandDependencies([PERMISSIONS.ROLES.ASSIGN]);

    expect(expanded.has(PERMISSIONS.ROLES.ASSIGN)).toBe(true);
    expect(expanded.has(PERMISSIONS.ROLES.READ)).toBe(true);
    expect(expanded.has(PERMISSIONS.PERMISSIONS.READ)).toBe(true);
  });

  it('rejects self-dependencies', () => {
    const broken: PermissionDefinition[] = [
      {
        key: PERMISSIONS.USERS.READ,
        resource: 'users',
        action: 'read',
        description: 'broken',
        isSystem: true,
        dependsOn: [PERMISSIONS.USERS.READ],
      },
    ];

    expect(() => validatePermissionGraph(broken)).toThrow(/itself/);
  });

  it('rejects circular dependencies', () => {
    const broken: PermissionDefinition[] = [
      {
        key: PERMISSIONS.USERS.READ,
        resource: 'users',
        action: 'read',
        description: 'a',
        isSystem: true,
        dependsOn: [PERMISSIONS.USERS.UPDATE],
      },
      {
        key: PERMISSIONS.USERS.UPDATE,
        resource: 'users',
        action: 'update',
        description: 'b',
        isSystem: true,
        dependsOn: [PERMISSIONS.USERS.READ],
      },
    ];

    expect(() => validatePermissionGraph(broken)).toThrow(/Circular/);
  });

  it('rejects missing dependency keys', () => {
    const broken: PermissionDefinition[] = [
      {
        key: PERMISSIONS.USERS.READ,
        resource: 'users',
        action: 'read',
        description: 'a',
        isSystem: true,
        dependsOn: ['missing.permission' as never],
      },
    ];

    expect(() => validatePermissionGraph(broken)).toThrow(/unknown permission/);
  });

  it('builds a dependency map for every definition', () => {
    const map = buildDependencyMap(PERMISSION_DEFINITIONS);
    expect(map.get(PERMISSIONS.PROJECTS.DELETE)).toEqual([
      PERMISSIONS.PROJECTS.READ,
    ]);
  });
});
