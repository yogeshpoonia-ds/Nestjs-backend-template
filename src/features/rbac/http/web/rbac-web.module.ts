import { Module } from '@nestjs/common';
import { RbacModule } from '../../rbac.module.js';
import { RbacWebController } from './rbac-web.controller.js';

@Module({
  imports: [RbacModule],
  controllers: [RbacWebController],
})
export class RbacWebModule {}
