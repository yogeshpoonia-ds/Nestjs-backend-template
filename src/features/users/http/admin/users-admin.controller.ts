import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiSurface } from '../../../auth/decorators/api-surface.decorator.js';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { PERMISSIONS } from '../../../rbac/definitions/permissions.js';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../../../rbac/guards/permissions.guard.js';
import { PaginationQueryDto } from '../../../../shared/pagination.js';
import { UsersService } from '../../users.service.js';

@ApiTags('admin / users')
@ApiBearerAuth()
@ApiSurface('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  @RequirePermissions(PERMISSIONS.USERS.READ)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.users.list(query.page, query.limit);
  }

  @RequirePermissions(PERMISSIONS.USERS.READ)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getByIdOrThrow(id);
  }
}
