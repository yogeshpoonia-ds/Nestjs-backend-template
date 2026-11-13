import { Controller, Get } from '@nestjs/common';
import { StatusService } from '../../status.service.js';

/** Relative routes. WebApiModule mounts this module at /web/v1. */
@Controller('status')
export class StatusWebController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  getStatus() {
    return this.statusService.getStatus();
  }
}
