import { Module } from '@nestjs/common';
import { RbacModule } from '../../rbac.module.js';
import { RbacMobileController } from './rbac-mobile.controller.js';

@Module({
  imports: [RbacModule],
  controllers: [RbacMobileController],
})
export class RbacMobileModule {}
