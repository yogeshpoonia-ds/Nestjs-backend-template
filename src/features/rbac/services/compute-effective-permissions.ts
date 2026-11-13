import { expandDependencies } from '../definitions/permission-graph.js';

export type DirectPermissionInput = {
  name: string;
  effect: 'ALLOW' | 'DENY';
  expiresAt: Date | null;
};

export type RoleGrantInput = {
  isActive: boolean;
  isSystem: boolean;
  grantsAllPermissions: boolean;
  expiresAt: Date | null;
  permissionNames: readonly string[];
};

export type ComputeEffectivePermissionsInput = {
  now?: Date;
  roleGrants: readonly RoleGrantInput[];
  directPermissions: readonly DirectPermissionInput[];
  allPermissionNames: readonly string[];
  dependencyMap: ReadonlyMap<string, readonly string[]>;
};

function isActiveAssignment(expiresAt: Date | null, now: Date): boolean {
  return expiresAt === null || expiresAt > now;
}

/**
 * Pure effective-permission resolution.
 *
 * Priority: explicit DENY > explicit ALLOW > role grants (+ dependency expansion) > deny by default.
 * Wildcard (`grantsAllPermissions`) is honored only for system roles.
 */
export function computeEffectivePermissions(
  input: ComputeEffectivePermissionsInput,
): Set<string> {
  const now = input.now ?? new Date();
  const candidates = new Set<string>();
  const denied = new Set<string>();

  for (const grant of input.roleGrants) {
    if (!grant.isActive || !isActiveAssignment(grant.expiresAt, now)) {
      continue;
    }

    if (grant.isSystem && grant.grantsAllPermissions) {
      for (const name of input.allPermissionNames) {
        candidates.add(name);
      }
      continue;
    }

    for (const name of grant.permissionNames) {
      candidates.add(name);
    }
  }

  for (const permission of input.directPermissions) {
    if (!isActiveAssignment(permission.expiresAt, now)) {
      continue;
    }

    if (permission.effect === 'DENY') {
      denied.add(permission.name);
      continue;
    }

    candidates.add(permission.name);
  }

  const expanded = expandDependencies(candidates, input.dependencyMap);

  for (const name of denied) {
    expanded.delete(name);
  }

  for (const name of Array.from(expanded)) {
    const closure = expandDependencies([name], input.dependencyMap);

    for (const dependency of closure) {
      if (dependency === name) {
        continue;
      }

      if (denied.has(dependency)) {
        expanded.delete(name);
        break;
      }
    }
  }

  return expanded;
}

export function evaluatePermissionMode(
  effective: ReadonlySet<string>,
  required: readonly string[],
  mode: 'ALL' | 'ANY',
): boolean {
  if (required.length === 0) {
    return true;
  }

  if (mode === 'ANY') {
    return required.some((permission) => effective.has(permission));
  }

  return required.every((permission) => effective.has(permission));
}
