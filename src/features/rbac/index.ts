export { RbacModule } from './rbac.module.js';
export { RbacService } from './rbac.service.js';
export { PermissionResolutionService } from './services/permission-resolution.service.js';
export { PermissionsGuard } from './guards/permissions.guard.js';
export { RequirePermissions } from './decorators/require-permissions.decorator.js';
export {
  PERMISSIONS,
  PERMISSION_DEFINITIONS,
  SYSTEM_ROLES,
  type PermissionKey,
} from './definitions/index.js';
export { RbacAdminModule } from './http/admin/rbac-admin.module.js';
export { RbacWebModule } from './http/web/rbac-web.module.js';
export { RbacMobileModule } from './http/mobile/rbac-mobile.module.js';
