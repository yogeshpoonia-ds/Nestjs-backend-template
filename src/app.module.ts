import { Module } from '@nestjs/common';
import { CacheModule } from './infra/cache/cache.module.js';
import { DatabaseModule } from './infra/database/database.module.js';
import { QueueModule } from './infra/queue/queue.module.js';
import { AdminApiModule } from './surfaces/admin-api.module.js';
import { MobileApiModule } from './surfaces/mobile-api.module.js';
import { WebApiModule } from './surfaces/web-api.module.js';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    QueueModule,
    AdminApiModule,
    WebApiModule,
    MobileApiModule,
  ],
})
export class AppModule {}
