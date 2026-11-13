import { Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { RbacService } from './rbac.service.js';
import { PermissionResolutionService } from './services/permission-resolution.service.js';

@Module({
  providers: [RbacService, PermissionResolutionService, PermissionsGuard],
  exports: [RbacService, PermissionResolutionService, PermissionsGuard],
})
export class RbacModule {}
