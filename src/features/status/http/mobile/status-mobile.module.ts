import { Module } from '@nestjs/common';
import { StatusModule } from '../../status.module.js';
import { StatusMobileController } from './status-mobile.controller.js';

@Module({
  imports: [StatusModule],
  controllers: [StatusMobileController],
})
export class StatusMobileModule {}
