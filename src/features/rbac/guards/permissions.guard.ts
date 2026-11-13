import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_METADATA_KEY,
  type RequiredPermissionsMetadata,
} from '../decorators/require-permissions.decorator.js';
import { PermissionResolutionService } from '../services/permission-resolution.service.js';

type AuthenticatedRequestUser = {
  userId: string;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionResolution: PermissionResolutionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<
      RequiredPermissionsMetadata | undefined
    >(PERMISSIONS_METADATA_KEY, [context.getHandler(), context.getClass()]);

    if (metadata === undefined || metadata.permissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedRequestUser;
    }>();
    const user = request.user;

    if (user?.userId === undefined) {
      throw new UnauthorizedException();
    }

    const allowed = await this.permissionResolution.hasPermissions(
      user.userId,
      metadata.permissions,
      metadata.mode,
    );

    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
