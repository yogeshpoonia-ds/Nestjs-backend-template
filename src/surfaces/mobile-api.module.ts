import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AuthMobileModule } from '../features/auth/index.js';
import { RbacMobileModule } from '../features/rbac/index.js';
import { StatusMobileModule } from '../features/status/index.js';

@Module({
  imports: [
    AuthMobileModule,
    RbacMobileModule,
    StatusMobileModule,
    RouterModule.register([
      {
        path: 'mobile/v1',
        module: AuthMobileModule,
      },
      {
        path: 'mobile/v1',
        module: RbacMobileModule,
      },
      {
        path: 'mobile/v1',
        module: StatusMobileModule,
      },
    ]),
  ],
})
export class MobileApiModule {}
