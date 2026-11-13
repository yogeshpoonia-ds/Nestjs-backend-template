import 'dotenv/config';
import { createPrismaClient } from '../infra/database/prisma-client.js';
import { syncRbacDefinitions } from '../features/rbac/sync/rbac-sync.js';

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  try {
    await syncRbacDefinitions(prisma);
    console.log('RBAC definitions synchronized');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
