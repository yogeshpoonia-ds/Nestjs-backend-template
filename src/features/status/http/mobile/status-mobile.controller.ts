import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiSurface } from '../../../auth/decorators/api-surface.decorator.js';
import { Public } from '../../../auth/decorators/public.decorator.js';
import { StatusService } from '../../status.service.js';

/** Relative routes. MobileApiModule mounts this module at /mobile/v1. */
@ApiTags('mobile / status')
@ApiSurface('mobile')
@Controller('status')
export class StatusMobileController {
  constructor(private readonly statusService: StatusService) {}

  @Public()
  @Get()
  getStatus() {
    return this.statusService.getStatus();
  }
}
