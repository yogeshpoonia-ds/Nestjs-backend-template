import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module.js';
import { RbacModule } from '../../../rbac/rbac.module.js';
import { UsersModule } from '../../users.module.js';
import { UsersAdminController } from './users-admin.controller.js';

@Module({
  imports: [UsersModule, AuthModule, RbacModule],
  controllers: [UsersAdminController],
})
export class UsersAdminModule {}
