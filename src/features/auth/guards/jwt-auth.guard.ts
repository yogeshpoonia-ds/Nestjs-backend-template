import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { API_SURFACE_KEY } from '../decorators/api-surface.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import {
  isAuthSurfaceName,
  type AuthSurfaceName,
} from '../types/authenticated-user.js';

export const JWT_STRATEGY_BY_SURFACE: Record<AuthSurfaceName, string> = {
  admin: 'jwt-admin',
  web: 'jwt-web',
  mobile: 'jwt-mobile',
};

type PassportGuard = CanActivate;

/**
 * Authenticates with the passport strategy that matches the controller's
 * `@ApiSurface()`. `@Public()` routes skip authentication; non-public routes
 * without a declared surface are denied.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly guards = new Map<AuthSurfaceName, PassportGuard>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (
      this.reflector.getAllAndOverride<boolean | undefined>(
        IS_PUBLIC_KEY,
        targets,
      )
    ) {
      return true;
    }

    const surface = this.reflector.getAllAndOverride<unknown>(
      API_SURFACE_KEY,
      targets,
    );

    if (!isAuthSurfaceName(surface)) {
      throw new ForbiddenException(
        'API surface is not declared for this route',
      );
    }

    return this.guardFor(surface).canActivate(context);
  }

  private guardFor(surface: AuthSurfaceName): PassportGuard {
    let guard = this.guards.get(surface);

    if (guard === undefined) {
      const GuardClass = AuthGuard(JWT_STRATEGY_BY_SURFACE[surface]);
      guard = new GuardClass();
      this.guards.set(surface, guard);
    }

    return guard;
  }
}
