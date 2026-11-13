import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../definitions/permissions.js';

export const PERMISSIONS_METADATA_KEY = 'rbac:permissions';

export type PermissionCheckMode = 'ALL' | 'ANY';

export type RequirePermissionsOptions = {
  mode?: PermissionCheckMode;
};

export type RequiredPermissionsMetadata = {
  permissions: PermissionKey[];
  mode: PermissionCheckMode;
};

type RequirePermissionsArg =
  | PermissionKey
  | RequirePermissionsOptions;

export function RequirePermissions(
  ...args: RequirePermissionsArg[]
): MethodDecorator & ClassDecorator {
  const permissions: PermissionKey[] = [];
  let mode: PermissionCheckMode = 'ALL';

  for (const arg of args) {
    if (typeof arg === 'string') {
      permissions.push(arg);
      continue;
    }

    if (arg.mode !== undefined) {
      mode = arg.mode;
    }
  }

  const metadata: RequiredPermissionsMetadata = {
    permissions,
    mode,
  };

  return SetMetadata(PERMISSIONS_METADATA_KEY, metadata);
}
