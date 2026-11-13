import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module.js';
import { RbacModule } from '../../rbac.module.js';
import { RbacAdminController } from './rbac-admin.controller.js';

@Module({
  imports: [RbacModule, AuthModule],
  controllers: [RbacAdminController],
})
export class RbacAdminModule {}
