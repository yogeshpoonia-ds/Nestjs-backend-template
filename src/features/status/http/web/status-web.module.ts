import { Module } from '@nestjs/common';
import { StatusModule } from '../../status.module.js';
import { StatusWebController } from './status-web.controller.js';

@Module({
  imports: [StatusModule],
  controllers: [StatusWebController],
})
export class StatusWebModule {}
