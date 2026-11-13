import { Module } from '@nestjs/common';
import { RbacModule } from '../../rbac.module.js';
import { RbacAdminController } from './rbac-admin.controller.js';

@Module({
  imports: [RbacModule],
  controllers: [RbacAdminController],
})
export class RbacAdminModule {}
