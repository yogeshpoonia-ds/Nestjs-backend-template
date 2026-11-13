import { Controller, Get } from '@nestjs/common';
import { StatusService } from '../../status.service.js';

/** Relative routes. MobileApiModule mounts this module at /mobile/v1. */
@Controller('status')
export class StatusMobileController {
  constructor(private readonly statusService: StatusService) {}

  @Get()
  getStatus() {
    return this.statusService.getStatus();
  }
}
