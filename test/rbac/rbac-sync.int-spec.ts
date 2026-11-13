import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createPrismaClient } from '../../src/infra/database/prisma-client.js';
import { SYSTEM_ROLES } from '../../src/features/rbac/definitions/roles.js';
import { PERMISSION_DEFINITIONS } from '../../src/features/rbac/definitions/permissions.js';
import { syncRbacDefinitions } from '../../src/features/rbac/sync/rbac-sync.js';

const shouldRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!shouldRun)('RBAC sync integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPrismaClient();
    await syncRbacDefinitions(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seeds system permissions and roles idempotently', async () => {
    await syncRbacDefinitions(prisma);
    await syncRbacDefinitions(prisma);

    const permissionCount = await prisma.permission.count({
      where: { isSystem: true, deprecatedAt: null },
    });
    const roleCount = await prisma.role.count({
      where: { isSystem: true },
    });

    expect(permissionCount).toBe(PERMISSION_DEFINITIONS.length);
    expect(roleCount).toBe(Object.keys(SYSTEM_ROLES).length);

    const superAdmin = await prisma.role.findUnique({
      where: { name: SYSTEM_ROLES.SUPER_ADMIN.name },
    });
    expect(superAdmin?.grantsAllPermissions).toBe(true);
  });

  it('preserves custom roles across sync runs', async () => {
    const custom = await prisma.role.upsert({
      where: { name: 'custom_sync_role' },
      create: {
        name: 'custom_sync_role',
        displayName: 'Custom Sync Role',
        description: 'Should survive sync',
        isSystem: false,
      },
      update: {},
    });

    await syncRbacDefinitions(prisma);

    const surviving = await prisma.role.findUnique({
      where: { id: custom.id },
    });
    expect(surviving).not.toBeNull();
  });
});
