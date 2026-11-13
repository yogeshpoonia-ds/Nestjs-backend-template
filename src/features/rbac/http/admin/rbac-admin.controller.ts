import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSurface } from '../../../auth/decorators/api-surface.decorator.js';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.js';
import { PaginationQueryDto } from '../../../../shared/pagination.js';
import { PERMISSIONS } from '../../definitions/permissions.js';
import { RequirePermissions } from '../../decorators/require-permissions.decorator.js';
import { AssignRoleDto } from '../../dto/assign-role.dto.js';
import { CreateRoleDto } from '../../dto/create-role.dto.js';
import { ListPermissionsQueryDto } from '../../dto/list-permissions-query.dto.js';
import { RolePermissionsDto } from '../../dto/role-permissions.dto.js';
import { SetUserPermissionDto } from '../../dto/set-user-permission.dto.js';
import { UpdateRoleDto } from '../../dto/update-role.dto.js';
import { PermissionsGuard } from '../../guards/permissions.guard.js';
import { RbacService } from '../../rbac.service.js';

@ApiTags('admin / rbac')
@ApiBearerAuth()
@ApiSurface('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rbac')
export class RbacAdminController {
  constructor(private readonly rbac: RbacService) {}

  @RequirePermissions(PERMISSIONS.ROLES.CREATE)
  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rbac.createRole(dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES.READ)
  @Get('roles')
  listRoles(@Query() query: PaginationQueryDto) {
    return this.rbac.listRoles(query.page, query.limit);
  }

  @RequirePermissions(PERMISSIONS.ROLES.READ)
  @Get('roles/:id')
  getRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbac.getRole(id);
  }

  @RequirePermissions(PERMISSIONS.ROLES.UPDATE)
  @Patch('roles/:id')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbac.updateRole(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES.DELETE)
  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRole(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.rbac.deleteRole(id);
  }

  @RequirePermissions(PERMISSIONS.ROLES.UPDATE)
  @Post('roles/:id/permissions')
  assignRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RolePermissionsDto,
  ) {
    return this.rbac.assignPermissionsToRolePublic(id, dto.permissionIds);
  }

  @RequirePermissions(PERMISSIONS.ROLES.UPDATE)
  @Delete('roles/:id/permissions')
  removeRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RolePermissionsDto,
  ) {
    return this.rbac.removePermissionsFromRole(id, dto.permissionIds);
  }

  @RequirePermissions(PERMISSIONS.PERMISSIONS.READ)
  @Get('permissions')
  listPermissions(@Query() query: ListPermissionsQueryDto) {
    return this.rbac.listPermissions({
      page: query.page,
      limit: query.limit,
      resource: query.resource,
    });
  }

  @RequirePermissions(PERMISSIONS.PERMISSIONS.READ)
  @Get('permissions/:id')
  @ApiOkResponse()
  getPermission(@Param('id', ParseUUIDPipe) id: string) {
    return this.rbac.getPermission(id);
  }

  @RequirePermissions(PERMISSIONS.ROLES.ASSIGN)
  @Post('users/:userId/roles')
  assignUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rbac.assignRoleToUser({
      userId,
      roleId: dto.roleId,
      assignedById: user.userId,
      expiresAt: dto.expiresAt,
    });
  }

  @RequirePermissions(PERMISSIONS.ROLES.ASSIGN)
  @Delete('users/:userId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    await this.rbac.removeRoleFromUser(userId, roleId);
  }

  @RequirePermissions(PERMISSIONS.PERMISSIONS.ASSIGN)
  @Put('users/:userId/permissions/:permissionId')
  setUserPermission(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Body() dto: SetUserPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rbac.setUserPermission({
      userId,
      permissionId,
      effect: dto.effect,
      assignedById: user.userId,
      expiresAt: dto.expiresAt,
    });
  }

  @RequirePermissions(PERMISSIONS.PERMISSIONS.ASSIGN)
  @Delete('users/:userId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeUserPermission(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    await this.rbac.removeUserPermission(userId, permissionId);
  }

  @RequirePermissions(PERMISSIONS.ROLES.READ)
  @Get('users/:userId/roles')
  listUserRoles(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.rbac.listUserRoles(userId);
  }

  @RequirePermissions(PERMISSIONS.PERMISSIONS.READ)
  @Get('users/:userId/permissions')
  listUserPermissions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.rbac.listUserPermissions(userId);
  }

  @RequirePermissions(PERMISSIONS.PERMISSIONS.READ)
  @Get('users/:userId/effective-permissions')
  async effectivePermissions(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return {
      permissions: await this.rbac.getEffectivePermissions(userId),
    };
  }
}
