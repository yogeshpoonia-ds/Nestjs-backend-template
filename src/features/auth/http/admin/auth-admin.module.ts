import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth.module.js';
import { AuthAdminController } from './auth-admin.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AuthAdminController],
})
export class AuthAdminModule {}
