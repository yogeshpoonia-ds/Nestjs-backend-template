import 'dotenv/config';
import { createPrismaClient } from '../infra/database/prisma-client.js';
import {
  bootstrapSuperAdmin,
  resolveSuperAdminBootstrapConfig,
} from '../features/users/bootstrap/super-admin.bootstrap.js';

async function main(): Promise<void> {
  const config = resolveSuperAdminBootstrapConfig();
  const prisma = createPrismaClient();

  try {
    const result = await bootstrapSuperAdmin(prisma, config);

    if (result.createdUser) {
      console.log('Super Admin user created and role assigned');
      return;
    }

    if (result.assignedRole) {
      console.log('Existing Super Admin received the super_admin role');
      return;
    }

    console.log('Super Admin already exists; no changes applied');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
