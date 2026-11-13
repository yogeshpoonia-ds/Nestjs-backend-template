import type { PrismaClient } from '../../../generated/prisma/client.js';
import { hashPassword } from '../../auth/crypto/password.crypto.js';
import { normalizeEmail } from '../../auth/utils/email.util.js';
import { SYSTEM_ROLES } from '../../rbac/definitions/roles.js';
import { syncRbacDefinitions } from '../../rbac/sync/rbac-sync.js';

const BOOTSTRAP_LOCK_KEY = 4_201_338;
const MIN_PASSWORD_LENGTH = 12;

export type SuperAdminBootstrapConfig = {
  email: string;
  password: string;
  name: string;
};

export function resolveSuperAdminBootstrapConfig(
  env: NodeJS.ProcessEnv = process.env,
): SuperAdminBootstrapConfig {
  const email = (env.SUPER_ADMIN_EMAIL ?? '').trim();
  const password = env.SUPER_ADMIN_PASSWORD ?? '';
  const name = (env.SUPER_ADMIN_NAME ?? 'System Administrator').trim();

  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required for Super Admin bootstrap',
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SUPER_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }

  return {
    email: normalizeEmail(email),
    password,
    name: name.length > 0 ? name : 'System Administrator',
  };
}

export type SuperAdminBootstrapResult = {
  createdUser: boolean;
  assignedRole: boolean;
  userId: string;
};

export async function bootstrapSuperAdmin(
  prisma: PrismaClient,
  config: SuperAdminBootstrapConfig = resolveSuperAdminBootstrapConfig(),
): Promise<SuperAdminBootstrapResult> {
  await syncRbacDefinitions(prisma);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`;

    const role = await tx.role.findUnique({
      where: { name: SYSTEM_ROLES.SUPER_ADMIN.name },
    });

    if (role === null) {
      throw new Error('System role super_admin was not seeded');
    }

    const existing = await tx.user.findUnique({
      where: { email: config.email },
    });

    let userId: string;
    let createdUser = false;

    if (existing === null) {
      const user = await tx.user.create({
        data: {
          email: config.email,
          name: config.name,
          passwordHash: await hashPassword(config.password),
          isActive: true,
        },
      });
      userId = user.id;
      createdUser = true;
    } else {
      userId = existing.id;
    }

    const existingAssignment = await tx.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
    });

    let assignedRole = false;

    if (existingAssignment === null) {
      await tx.userRole.create({
        data: {
          userId,
          roleId: role.id,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { authzVersion: { increment: 1 } },
      });
      assignedRole = true;
    }

    return { createdUser, assignedRole, userId };
  });
}
