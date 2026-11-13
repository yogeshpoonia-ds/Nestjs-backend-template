import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service.js';
import { CacheService } from '../../../infra/cache/cache.service.js';
import {
  buildDependencyMap,
  type PermissionDependencyMap,
} from '../definitions/permission-graph.js';
import {
  computeEffectivePermissions,
  evaluatePermissionMode,
} from './compute-effective-permissions.js';

const DEFAULT_CACHE_TTL_SECONDS = 300;

@Injectable()
export class PermissionResolutionService {
  private readonly logger = new Logger(PermissionResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    const versions = await this.loadVersions(userId);
    const cacheKey = this.cacheKey(
      userId,
      versions.globalVersion,
      versions.userVersion,
    );

    try {
      const cached = await this.cache.get(cacheKey);

      if (cached !== null) {
        return new Set(JSON.parse(cached) as string[]);
      }
    } catch (error) {
      this.logger.warn(
        `RBAC cache read failed for user ${userId}: ${errorMessage(error)}`,
      );
    }

    const resolved = await this.resolveFromDatabase(userId);
    const permissions = [...resolved.permissions].sort();
    const ttl = this.resolveTtlSeconds(resolved.earliestExpiry);

    try {
      await this.cache.set(cacheKey, JSON.stringify(permissions), ttl);
    } catch (error) {
      this.logger.warn(
        `RBAC cache write failed for user ${userId}: ${errorMessage(error)}`,
      );
    }

    return resolved.permissions;
  }

  async hasPermissions(
    userId: string,
    required: readonly string[],
    mode: 'ALL' | 'ANY' = 'ALL',
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId);
    return evaluatePermissionMode(effective, required, mode);
  }

  async resolveFromDatabase(userId: string): Promise<{
    permissions: Set<string>;
    earliestExpiry: Date | null;
  }> {
    const now = new Date();
    const [userRoles, userPermissions, allPermissions, dependencies] =
      await Promise.all([
        this.prisma.userRole.findMany({
          where: { userId },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.userPermission.findMany({
          where: { userId },
          include: {
            permission: true,
          },
        }),
        this.prisma.permission.findMany({
          where: { deprecatedAt: null },
          select: { name: true },
        }),
        this.prisma.permissionDependency.findMany({
          include: {
            permission: { select: { name: true } },
            dependsOn: { select: { name: true } },
          },
        }),
      ]);

    const dependencyMap = new Map<string, string[]>();

    for (const edge of dependencies) {
      const existing = dependencyMap.get(edge.permission.name) ?? [];
      dependencyMap.set(edge.permission.name, [
        ...existing,
        edge.dependsOn.name,
      ]);
    }

    if (dependencyMap.size === 0) {
      for (const [key, deps] of buildDependencyMap()) {
        dependencyMap.set(key, [...deps]);
      }
    }

    const frozenDependencyMap: PermissionDependencyMap = dependencyMap;

    let earliestExpiry: Date | null = null;

    const considerExpiry = (expiresAt: Date | null): void => {
      if (expiresAt === null) {
        return;
      }

      if (expiresAt <= now) {
        return;
      }

      if (earliestExpiry === null || expiresAt < earliestExpiry) {
        earliestExpiry = expiresAt;
      }
    };

    const roleGrants = userRoles.map((assignment) => {
      considerExpiry(assignment.expiresAt);

      return {
        isActive: assignment.role.isActive,
        isSystem: assignment.role.isSystem,
        grantsAllPermissions: assignment.role.grantsAllPermissions,
        expiresAt: assignment.expiresAt,
        permissionNames: assignment.role.permissions
          .filter((rolePermission) => rolePermission.permission.deprecatedAt === null)
          .map((rolePermission) => rolePermission.permission.name),
      };
    });

    const directPermissions = userPermissions.map((assignment) => {
      considerExpiry(assignment.expiresAt);

      return {
        name: assignment.permission.name,
        effect: assignment.effect,
        expiresAt: assignment.expiresAt,
      };
    });

    const permissions = computeEffectivePermissions({
      now,
      roleGrants,
      directPermissions,
      allPermissionNames: allPermissions.map((permission) => permission.name),
      dependencyMap: frozenDependencyMap,
    });

    return { permissions, earliestExpiry };
  }

  private async loadVersions(
    userId: string,
  ): Promise<{ globalVersion: number; userVersion: number }> {
    const [user, state] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { authzVersion: true },
      }),
      this.prisma.rbacState.findUnique({
        where: { id: 1 },
        select: { version: true },
      }),
    ]);

    return {
      globalVersion: state?.version ?? 0,
      userVersion: user?.authzVersion ?? 0,
    };
  }

  private cacheKey(
    userId: string,
    globalVersion: number,
    userVersion: number,
  ): string {
    return `rbac:perm:${userId}:${globalVersion}:${userVersion}`;
  }

  private resolveTtlSeconds(earliestExpiry: Date | null): number {
    const configured = Number.parseInt(
      process.env.RBAC_CACHE_TTL_SECONDS ?? `${DEFAULT_CACHE_TTL_SECONDS}`,
      10,
    );
    const baseTtl =
      Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_CACHE_TTL_SECONDS;

    if (earliestExpiry === null) {
      return baseTtl;
    }

    const untilExpiry = Math.floor(
      (earliestExpiry.getTime() - Date.now()) / 1000,
    );

    if (untilExpiry <= 0) {
      return 1;
    }

    return Math.min(baseTtl, untilExpiry);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
