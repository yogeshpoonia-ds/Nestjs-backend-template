import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PermissionEffect, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { paginate, type PaginatedResult } from '../../shared/pagination.js';
import { expandDependencies } from './definitions/permission-graph.js';
import { PermissionResolutionService } from './services/permission-resolution.service.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionResolution: PermissionResolutionService,
  ) {}

  async listRoles(
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Awaited<ReturnType<typeof this.getRole>>>> {
    const { skip, take } = paginate(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.role.findMany({
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          permissions: {
            include: { permission: true },
          },
          _count: { select: { users: true } },
        },
      }),
      this.prisma.role.count(),
    ]);

    return {
      items: items.map((role) => this.mapRole(role)),
      total,
      page,
      limit,
    };
  }

  async getRole(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
    });

    if (role === null) {
      throw new NotFoundException('Role not found');
    }

    return this.mapRole(role);
  }

  async createRole(input: {
    name: string;
    displayName: string;
    description: string;
    permissionIds?: string[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.role.findUnique({
        where: { name: input.name },
      });

      if (existing !== null) {
        throw new ConflictException('Role name already exists');
      }

      const role = await tx.role.create({
        data: {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          isSystem: false,
          isActive: true,
          grantsAllPermissions: false,
        },
      });

      if (input.permissionIds !== undefined && input.permissionIds.length > 0) {
        await this.assignPermissionsToRole(tx, role.id, input.permissionIds);
      }

      await this.bumpGlobalVersion(tx);
      return this.getRoleInTx(tx, role.id);
    });
  }

  async updateRole(
    roleId: string,
    input: {
      displayName?: string;
      description?: string;
      isActive?: boolean;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id: roleId } });

      if (role === null) {
        throw new NotFoundException('Role not found');
      }

      if (role.isSystem) {
        throw new ForbiddenException('System roles cannot be modified');
      }

      await tx.role.update({
        where: { id: roleId },
        data: {
          displayName: input.displayName,
          description: input.description,
          isActive: input.isActive,
        },
      });

      if (input.isActive !== undefined) {
        await this.bumpGlobalVersion(tx);
      }

      return this.getRoleInTx(tx, roleId);
    });
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id: roleId } });

      if (role === null) {
        throw new NotFoundException('Role not found');
      }

      if (role.isSystem) {
        throw new ForbiddenException('System roles cannot be deleted');
      }

      await tx.role.delete({ where: { id: roleId } });
      await this.bumpGlobalVersion(tx);
    });
  }

  async assignPermissionsToRolePublic(
    roleId: string,
    permissionIds: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCustomRole(tx, roleId);
      await this.assignPermissionsToRole(tx, roleId, permissionIds);
      await this.bumpGlobalVersion(tx);
      return this.getRoleInTx(tx, roleId);
    });
  }

  async removePermissionsFromRole(roleId: string, permissionIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertCustomRole(tx, roleId);

      const current = await tx.rolePermission.findMany({
        where: { roleId },
        include: { permission: true },
      });

      const currentNames = new Set(
        current.map((item) => item.permission.name),
      );
      const removing = current.filter((item) =>
        permissionIds.includes(item.permissionId),
      );

      for (const item of removing) {
        const dependents = [...currentNames].filter((name) => {
          if (name === item.permission.name) {
            return false;
          }

          const closure = expandDependencies([name]);
          return closure.has(item.permission.name);
        });

        if (dependents.length > 0) {
          throw new BadRequestException(
            `Cannot remove "${item.permission.name}" while required by: ${dependents.join(', ')}`,
          );
        }
      }

      await tx.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId: { in: permissionIds },
        },
      });

      await this.bumpGlobalVersion(tx);
      return this.getRoleInTx(tx, roleId);
    });
  }

  async listPermissions(input: {
    page: number;
    limit: number;
    resource?: string;
  }) {
    const { skip, take } = paginate(input.page, input.limit);
    const where = {
      deprecatedAt: null,
      ...(input.resource ? { resource: input.resource } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take,
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        include: {
          dependencies: {
            include: { dependsOn: true },
          },
          dependents: {
            include: { permission: true },
          },
        },
      }),
      this.prisma.permission.count({ where }),
    ]);

    return {
      items: items.map((permission) => ({
        id: permission.id,
        name: permission.name,
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
        isSystem: permission.isSystem,
        dependsOn: permission.dependencies.map((edge) => ({
          id: edge.dependsOn.id,
          name: edge.dependsOn.name,
        })),
        requiredBy: permission.dependents.map((edge) => ({
          id: edge.permission.id,
          name: edge.permission.name,
        })),
      })),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async getPermission(permissionId: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        dependencies: { include: { dependsOn: true } },
        dependents: { include: { permission: true } },
      },
    });

    if (permission === null) {
      throw new NotFoundException('Permission not found');
    }

    return {
      id: permission.id,
      name: permission.name,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      isSystem: permission.isSystem,
      deprecatedAt: permission.deprecatedAt,
      dependsOn: permission.dependencies.map((edge) => ({
        id: edge.dependsOn.id,
        name: edge.dependsOn.name,
      })),
      requiredBy: permission.dependents.map((edge) => ({
        id: edge.permission.id,
        name: edge.permission.name,
      })),
    };
  }

  async assignRoleToUser(input: {
    userId: string;
    roleId: string;
    assignedById?: string;
    expiresAt?: Date | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertUserExists(tx, input.userId);
      const role = await tx.role.findUnique({ where: { id: input.roleId } });

      if (role === null) {
        throw new NotFoundException('Role not found');
      }

      if (!role.isActive) {
        throw new BadRequestException('Cannot assign an inactive role');
      }

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: input.userId,
            roleId: input.roleId,
          },
        },
        create: {
          userId: input.userId,
          roleId: input.roleId,
          assignedById: input.assignedById,
          expiresAt: input.expiresAt ?? null,
        },
        update: {
          assignedById: input.assignedById,
          expiresAt: input.expiresAt ?? null,
          assignedAt: new Date(),
        },
      });

      await this.bumpUserVersion(tx, input.userId);
      return this.listUserRolesInTx(tx, input.userId);
    });
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.userRole.findUnique({
        where: {
          userId_roleId: { userId, roleId },
        },
      });

      if (assignment === null) {
        throw new NotFoundException('User role assignment not found');
      }

      await tx.userRole.delete({
        where: { id: assignment.id },
      });
      await this.bumpUserVersion(tx, userId);
    });
  }

  async setUserPermission(input: {
    userId: string;
    permissionId: string;
    effect: PermissionEffect;
    assignedById?: string;
    expiresAt?: Date | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertUserExists(tx, input.userId);
      const permission = await tx.permission.findUnique({
        where: { id: input.permissionId },
      });

      if (permission === null) {
        throw new NotFoundException('Permission not found');
      }

      if (permission.deprecatedAt !== null) {
        throw new BadRequestException('Cannot assign a deprecated permission');
      }

      await tx.userPermission.upsert({
        where: {
          userId_permissionId: {
            userId: input.userId,
            permissionId: input.permissionId,
          },
        },
        create: {
          userId: input.userId,
          permissionId: input.permissionId,
          effect: input.effect,
          assignedById: input.assignedById,
          expiresAt: input.expiresAt ?? null,
        },
        update: {
          effect: input.effect,
          assignedById: input.assignedById,
          expiresAt: input.expiresAt ?? null,
          assignedAt: new Date(),
        },
      });

      await this.bumpUserVersion(tx, input.userId);
      return this.listUserPermissionsInTx(tx, input.userId);
    });
  }

  async removeUserPermission(
    userId: string,
    permissionId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.userPermission.findUnique({
        where: {
          userId_permissionId: { userId, permissionId },
        },
      });

      if (assignment === null) {
        throw new NotFoundException('User permission assignment not found');
      }

      await tx.userPermission.delete({ where: { id: assignment.id } });
      await this.bumpUserVersion(tx, userId);
    });
  }

  async listUserRoles(userId: string) {
    await this.assertUserExists(this.prisma, userId);
    return this.listUserRolesInTx(this.prisma, userId);
  }

  async listUserPermissions(userId: string) {
    await this.assertUserExists(this.prisma, userId);
    return this.listUserPermissionsInTx(this.prisma, userId);
  }

  async getEffectivePermissions(userId: string) {
    await this.assertUserExists(this.prisma, userId);
    const permissions =
      await this.permissionResolution.getEffectivePermissions(userId);
    return [...permissions].sort();
  }

  private mapRole(role: {
    id: string;
    name: string;
    displayName: string;
    description: string;
    isSystem: boolean;
    isActive: boolean;
    grantsAllPermissions: boolean;
    createdAt: Date;
    updatedAt: Date;
    permissions: Array<{
      permission: {
        id: string;
        name: string;
        resource: string;
        action: string;
      };
    }>;
    _count: { users: number };
  }) {
    return {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      grantsAllPermissions: role.grantsAllPermissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.users,
      permissions: role.permissions.map((item) => ({
        id: item.permission.id,
        name: item.permission.name,
        resource: item.permission.resource,
        action: item.permission.action,
      })),
    };
  }

  private async getRoleInTx(tx: Tx, roleId: string) {
    const role = await tx.role.findUniqueOrThrow({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });

    return this.mapRole(role);
  }

  private async assertCustomRole(tx: Tx, roleId: string) {
    const role = await tx.role.findUnique({ where: { id: roleId } });

    if (role === null) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new ForbiddenException(
        'System role permissions cannot be modified through admin APIs',
      );
    }

    return role;
  }

  private async assignPermissionsToRole(
    tx: Tx,
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    const permissions = await tx.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions were not found');
    }

    for (const permission of permissions) {
      if (permission.deprecatedAt !== null) {
        throw new BadRequestException(
          `Cannot assign deprecated permission "${permission.name}"`,
        );
      }
    }

    for (const permissionId of permissionIds) {
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        create: { roleId, permissionId },
        update: {},
      });
    }
  }

  private async listUserRolesInTx(tx: Tx | PrismaService, userId: string) {
    const assignments = await tx.userRole.findMany({
      where: { userId },
      include: { role: true },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      roleId: assignment.roleId,
      assignedAt: assignment.assignedAt,
      expiresAt: assignment.expiresAt,
      role: {
        id: assignment.role.id,
        name: assignment.role.name,
        displayName: assignment.role.displayName,
        isSystem: assignment.role.isSystem,
        isActive: assignment.role.isActive,
      },
    }));
  }

  private async listUserPermissionsInTx(
    tx: Tx | PrismaService,
    userId: string,
  ) {
    const assignments = await tx.userPermission.findMany({
      where: { userId },
      include: { permission: true },
      orderBy: { assignedAt: 'desc' },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      permissionId: assignment.permissionId,
      effect: assignment.effect,
      assignedAt: assignment.assignedAt,
      expiresAt: assignment.expiresAt,
      permission: {
        id: assignment.permission.id,
        name: assignment.permission.name,
        resource: assignment.permission.resource,
        action: assignment.permission.action,
      },
    }));
  }

  private async assertUserExists(
    tx: Tx | PrismaService,
    userId: string,
  ): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (user === null) {
      throw new NotFoundException('User not found');
    }
  }

  private async bumpUserVersion(tx: Tx, userId: string): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: { authzVersion: { increment: 1 } },
    });
  }

  private async bumpGlobalVersion(tx: Tx): Promise<void> {
    await tx.rbacState.upsert({
      where: { id: 1 },
      create: { id: 1, version: 1 },
      update: { version: { increment: 1 } },
    });
  }
}
