import { Module } from '@nestjs/common';
import { RbacModule } from '../../../rbac/rbac.module.js';
import { AuthModule } from '../../auth.module.js';
import { AuthAdminController } from './auth-admin.controller.js';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [AuthAdminController],
})
export class AuthAdminModule {}
