import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import {
  PERMISSION_DEFINITIONS,
  SYSTEM_ROLE_DEFINITIONS,
  grantsAllPermissions,
  validatePermissionGraph,
} from '../definitions/index.js';

type Tx = Prisma.TransactionClient;

const RBAC_SYNC_LOCK_KEY = 4_201_337;

export async function syncRbacDefinitions(
  prisma: PrismaClient | Tx,
): Promise<void> {
  validatePermissionGraph();

  if ('$transaction' in prisma) {
    await prisma.$transaction(async (tx) => {
      await acquireLock(tx);
      await syncInsideTransaction(tx);
    });
    return;
  }

  await acquireLock(prisma);
  await syncInsideTransaction(prisma);
}

async function acquireLock(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RBAC_SYNC_LOCK_KEY})`;
}

async function syncInsideTransaction(tx: Tx): Promise<void> {
  await tx.rbacState.upsert({
    where: { id: 1 },
    create: { id: 1, version: 0 },
    update: {},
  });

  const permissionIds = new Map<string, string>();

  for (const definition of PERMISSION_DEFINITIONS) {
    const permission = await tx.permission.upsert({
      where: { name: definition.key },
      create: {
        name: definition.key,
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
        isSystem: true,
        deprecatedAt: null,
      },
      update: {
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
        isSystem: true,
        deprecatedAt: null,
      },
    });

    permissionIds.set(definition.key, permission.id);
  }

  const systemPermissionNames = PERMISSION_DEFINITIONS.map(
    (definition) => definition.key,
  );

  await tx.permission.updateMany({
    where: {
      isSystem: true,
      name: { notIn: systemPermissionNames },
      deprecatedAt: null,
    },
    data: {
      deprecatedAt: new Date(),
    },
  });

  const systemPermissionIdList = [...permissionIds.values()];

  await tx.permissionDependency.deleteMany({
    where: {
      permissionId: { in: systemPermissionIdList },
      dependsOnPermissionId: { in: systemPermissionIdList },
    },
  });

  for (const definition of PERMISSION_DEFINITIONS) {
    const permissionId = permissionIds.get(definition.key);

    if (permissionId === undefined) {
      continue;
    }

    for (const dependencyKey of definition.dependsOn) {
      const dependsOnPermissionId = permissionIds.get(dependencyKey);

      if (dependsOnPermissionId === undefined) {
        throw new Error(
          `Missing dependency permission "${dependencyKey}" for "${definition.key}"`,
        );
      }

      await tx.permissionDependency.create({
        data: {
          permissionId,
          dependsOnPermissionId,
        },
      });
    }
  }

  for (const roleDefinition of SYSTEM_ROLE_DEFINITIONS) {
    const grantsAll = grantsAllPermissions(roleDefinition.permissions);

    const role = await tx.role.upsert({
      where: { name: roleDefinition.name },
      create: {
        name: roleDefinition.name,
        displayName: roleDefinition.displayName,
        description: roleDefinition.description,
        isSystem: true,
        isActive: true,
        grantsAllPermissions: grantsAll,
      },
      update: {
        displayName: roleDefinition.displayName,
        description: roleDefinition.description,
        isSystem: true,
        grantsAllPermissions: grantsAll,
      },
    });

    await tx.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    if (grantsAll) {
      continue;
    }

    for (const permissionKey of roleDefinition.permissions) {
      const permissionId = permissionIds.get(permissionKey);

      if (permissionId === undefined) {
        throw new Error(
          `Missing permission "${permissionKey}" for role "${roleDefinition.name}"`,
        );
      }

      await tx.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId,
        },
      });
    }
  }

  await tx.rbacState.update({
    where: { id: 1 },
    data: {
      version: { increment: 1 },
    },
  });
}
