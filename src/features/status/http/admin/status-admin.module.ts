import { Module } from '@nestjs/common';
import { StatusModule } from '../../status.module.js';
import { StatusAdminController } from './status-admin.controller.js';

@Module({
  imports: [StatusModule],
  controllers: [StatusAdminController],
})
export class StatusAdminModule {}
