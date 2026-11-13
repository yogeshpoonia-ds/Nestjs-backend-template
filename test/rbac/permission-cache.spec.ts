import { describe, expect, it, vi } from 'vitest';
import type { CacheService } from '../../src/infra/cache/cache.service.js';
import type { PrismaService } from '../../src/infra/database/prisma.service.js';
import { PermissionResolutionService } from '../../src/features/rbac/services/permission-resolution.service.js';
import { PERMISSIONS } from '../../src/features/rbac/definitions/permissions.js';

describe('PermissionResolutionService cache', () => {
  it('returns cached permissions on a cache hit', async () => {
    const cache = {
      get: vi
        .fn()
        .mockResolvedValue(JSON.stringify([PERMISSIONS.USERS.READ])),
      set: vi.fn(),
      del: vi.fn(),
    } as unknown as CacheService;

    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ authzVersion: 1 }),
      },
      rbacState: {
        findUnique: vi.fn().mockResolvedValue({ version: 2 }),
      },
    } as unknown as PrismaService;

    const service = new PermissionResolutionService(prisma, cache);
    const resolveSpy = vi.spyOn(service, 'resolveFromDatabase');

    const permissions = await service.getEffectivePermissions('user-1');

    expect([...permissions]).toEqual([PERMISSIONS.USERS.READ]);
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledWith('rbac:perm:user-1:2:1');
  });

  it('falls back to the database when Redis fails', async () => {
    const cache = {
      get: vi.fn().mockRejectedValue(new Error('redis down')),
      set: vi.fn().mockRejectedValue(new Error('redis down')),
      del: vi.fn(),
    } as unknown as CacheService;

    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ authzVersion: 0 }),
      },
      rbacState: {
        findUnique: vi.fn().mockResolvedValue({ version: 0 }),
      },
    } as unknown as PrismaService;

    const service = new PermissionResolutionService(prisma, cache);
    vi.spyOn(service, 'resolveFromDatabase').mockResolvedValue({
      permissions: new Set([PERMISSIONS.USERS.READ]),
      earliestExpiry: null,
    });

    const permissions = await service.getEffectivePermissions('user-1');

    expect(permissions.has(PERMISSIONS.USERS.READ)).toBe(true);
    expect(cache.set).toHaveBeenCalled();
  });

  it('uses a new cache key after an authz version bump', async () => {
    const cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn(),
    } as unknown as CacheService;

    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ authzVersion: 5 }),
      },
      rbacState: {
        findUnique: vi.fn().mockResolvedValue({ version: 9 }),
      },
    } as unknown as PrismaService;

    const service = new PermissionResolutionService(prisma, cache);
    vi.spyOn(service, 'resolveFromDatabase').mockResolvedValue({
      permissions: new Set([PERMISSIONS.PROJECTS.READ]),
      earliestExpiry: null,
    });

    await service.getEffectivePermissions('user-2');

    expect(cache.get).toHaveBeenCalledWith('rbac:perm:user-2:9:5');
    expect(cache.set).toHaveBeenCalledWith(
      'rbac:perm:user-2:9:5',
      JSON.stringify([PERMISSIONS.PROJECTS.READ]),
      expect.any(Number),
    );
  });
});
