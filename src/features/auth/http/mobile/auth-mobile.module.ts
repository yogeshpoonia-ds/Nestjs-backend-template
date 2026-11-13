import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth.module.js';
import { AuthMobileController } from './auth-mobile.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AuthMobileController],
})
export class AuthMobileModule {}
