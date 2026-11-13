import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { createPrismaClient } from '../../src/infra/database/prisma-client.js';
import { SYSTEM_ROLES } from '../../src/features/rbac/definitions/roles.js';
import {
  bootstrapSuperAdmin,
  resolveSuperAdminBootstrapConfig,
} from '../../src/features/users/bootstrap/super-admin.bootstrap.js';

const shouldRun = Boolean(process.env.DATABASE_URL);

describe.skipIf(!shouldRun)('Super Admin bootstrap', () => {
  let prisma: PrismaClient;
  const email = `super-admin-${Date.now()}@example.com`;
  const password = 'Bootstrap-Password-1!';

  beforeAll(() => {
    prisma = createPrismaClient();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('rejects missing bootstrap credentials', () => {
    expect(() =>
      resolveSuperAdminBootstrapConfig({
        SUPER_ADMIN_EMAIL: '',
        SUPER_ADMIN_PASSWORD: '',
      }),
    ).toThrow(/required/);
  });

  it('creates the Super Admin once and preserves them on repeat runs', async () => {
    const first = await bootstrapSuperAdmin(prisma, {
      email,
      password,
      name: 'Bootstrap Admin',
    });
    expect(first.createdUser).toBe(true);
    expect(first.assignedRole).toBe(true);

    const before = await prisma.user.findUniqueOrThrow({
      where: { email },
    });

    const second = await bootstrapSuperAdmin(prisma, {
      email,
      password: 'Different-Password-2!',
      name: 'Changed Name',
    });
    expect(second.createdUser).toBe(false);
    expect(second.assignedRole).toBe(false);

    const after = await prisma.user.findUniqueOrThrow({
      where: { email },
    });

    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.name).toBe(before.name);

    const role = await prisma.role.findUniqueOrThrow({
      where: { name: SYSTEM_ROLES.SUPER_ADMIN.name },
    });
    const assignment = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: after.id,
          roleId: role.id,
        },
      },
    });
    expect(assignment).not.toBeNull();
  });
});
