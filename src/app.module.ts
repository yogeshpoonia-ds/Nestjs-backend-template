import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './features/auth/auth.module.js';
import { JwtAuthGuard } from './features/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './features/rbac/guards/permissions.guard.js';
import { RbacModule } from './features/rbac/rbac.module.js';
import { I18nModule } from './i18n/i18n.module.js';
import { CacheModule } from './infra/cache/cache.module.js';
import { DatabaseModule } from './infra/database/database.module.js';
import { QueueModule } from './infra/queue/queue.module.js';
import { AdminApiModule } from './surfaces/admin-api.module.js';
import { MobileApiModule } from './surfaces/mobile-api.module.js';
import { WebApiModule } from './surfaces/web-api.module.js';

@Module({
  imports: [
    I18nModule,
    DatabaseModule,
    CacheModule,
    QueueModule,
    AuthModule,
    RbacModule,
    AdminApiModule,
    WebApiModule,
    MobileApiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
