import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiSurface } from '../../../auth/decorators/api-surface.decorator.js';
import { Public } from '../../../auth/decorators/public.decorator.js';
import { StatusService } from '../../status.service.js';

/** Relative routes. AdminApiModule mounts this module at /admin/v1. */
@ApiTags('admin / status')
@ApiSurface('admin')
@Controller('status')
export class StatusAdminController {
  constructor(private readonly statusService: StatusService) {}

  @Public()
  @Get()
  getStatus() {
    return this.statusService.getStatus();
  }
}
