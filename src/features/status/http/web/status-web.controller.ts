import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiSurface } from '../../../auth/decorators/api-surface.decorator.js';
import { Public } from '../../../auth/decorators/public.decorator.js';
import { StatusService } from '../../status.service.js';

/** Relative routes. WebApiModule mounts this module at /web/v1. */
@ApiTags('web / status')
@ApiSurface('web')
@Controller('status')
export class StatusWebController {
  constructor(private readonly statusService: StatusService) {}

  @Public()
  @Get()
  getStatus() {
    return this.statusService.getStatus();
  }
}
