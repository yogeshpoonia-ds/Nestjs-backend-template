import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import {
  PERMISSIONS_METADATA_KEY,
  type RequiredPermissionsMetadata,
} from '../../src/features/rbac/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../../src/features/rbac/guards/permissions.guard.js';
import { PERMISSIONS } from '../../src/features/rbac/definitions/permissions.js';
import type { PermissionResolutionService } from '../../src/features/rbac/services/permission-resolution.service.js';

function createContext(input: {
  user?: { userId: string };
  handlerMeta?: RequiredPermissionsMetadata;
  classMeta?: RequiredPermissionsMetadata;
}) {
  const handler = function handler() {
    return undefined;
  };
  const controller = class Controller {};

  return {
    context: {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({ user: input.user }),
      }),
    } as never,
    handler,
    controller,
    handlerMeta: input.handlerMeta,
    classMeta: input.classMeta,
  };
}

describe('PermissionsGuard', () => {
  it('skips resolution when no permission metadata is present', async () => {
    const hasPermissions = vi.fn();
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector, {
      hasPermissions,
    } as unknown as PermissionResolutionService);

    const { context } = createContext({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(hasPermissions).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the request is unauthenticated', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue({
        permissions: [PERMISSIONS.USERS.READ],
        mode: 'ALL',
      } satisfies RequiredPermissionsMetadata),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector, {
      hasPermissions: vi.fn(),
    } as unknown as PermissionResolutionService);

    const { context } = createContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when permissions are missing', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue({
        permissions: [PERMISSIONS.USERS.READ],
        mode: 'ALL',
      }),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector, {
      hasPermissions: vi.fn().mockResolvedValue(false),
    } as unknown as PermissionResolutionService);

    const { context } = createContext({ user: { userId: 'user-1' } });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('passes ALL and ANY checks to the resolution service', async () => {
    const hasPermissions = vi.fn().mockResolvedValue(true);
    const reflector = new Reflector();
    const guard = new PermissionsGuard(reflector, {
      hasPermissions,
    } as unknown as PermissionResolutionService);

    const anyMeta: RequiredPermissionsMetadata = {
      permissions: [PERMISSIONS.USERS.READ, PERMISSIONS.PROJECTS.READ],
      mode: 'ANY',
    };
    const { context, handler, controller } = createContext({
      user: { userId: 'user-1' },
    });
    Reflect.defineMetadata(PERMISSIONS_METADATA_KEY, anyMeta, handler);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(hasPermissions).toHaveBeenCalledWith(
      'user-1',
      anyMeta.permissions,
      'ANY',
    );

    const classMeta: RequiredPermissionsMetadata = {
      permissions: [PERMISSIONS.USERS.READ],
      mode: 'ALL',
    };
    Reflect.defineMetadata(PERMISSIONS_METADATA_KEY, classMeta, controller);
    Reflect.defineMetadata(
      PERMISSIONS_METADATA_KEY,
      {
        permissions: [PERMISSIONS.USERS.DELETE],
        mode: 'ALL',
      } satisfies RequiredPermissionsMetadata,
      handler,
    );

    await guard.canActivate(context);
    expect(hasPermissions).toHaveBeenLastCalledWith(
      'user-1',
      [PERMISSIONS.USERS.DELETE],
      'ALL',
    );
  });
});
