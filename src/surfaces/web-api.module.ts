import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AuthWebModule } from '../features/auth/index.js';
import { RbacWebModule } from '../features/rbac/index.js';
import { StatusWebModule } from '../features/status/index.js';

@Module({
  imports: [
    AuthWebModule,
    RbacWebModule,
    StatusWebModule,
    RouterModule.register([
      {
        path: 'web/v1',
        module: AuthWebModule,
      },
      {
        path: 'web/v1',
        module: RbacWebModule,
      },
      {
        path: 'web/v1',
        module: StatusWebModule,
      },
    ]),
  ],
})
export class WebApiModule {}
