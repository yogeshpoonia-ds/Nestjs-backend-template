import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth.module.js';
import { AuthWebController } from './auth-web.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [AuthWebController],
})
export class AuthWebModule {}
