import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AuthAdminModule } from '../features/auth/index.js';
import { RbacAdminModule } from '../features/rbac/index.js';
import { StatusAdminModule } from '../features/status/index.js';

@Module({
  imports: [
    AuthAdminModule,
    RbacAdminModule,
    StatusAdminModule,
    RouterModule.register([
      {
        path: 'admin/v1',
        module: AuthAdminModule,
      },
      {
        path: 'admin/v1',
        module: RbacAdminModule,
      },
      {
        path: 'admin/v1',
        module: StatusAdminModule,
      },
    ]),
  ],
})
export class AdminApiModule {}
