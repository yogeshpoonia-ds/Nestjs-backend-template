import { Controller, Get } from '@nestjs/common';
import { StatusService } from '../../status.service.js';

/** Relative routes. AdminApiModule mounts this module at /admin/v1. */
@Controller('status')
export class StatusAdminController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  getStatus() {
    return this.statusService.getStatus();
  }
}
