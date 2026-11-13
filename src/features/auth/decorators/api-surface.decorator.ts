import { SetMetadata } from '@nestjs/common';
import type { AuthSurfaceName } from '../types/authenticated-user.js';

export const API_SURFACE_KEY = 'auth:apiSurface';

export const ApiSurface = (
  surface: AuthSurfaceName,
): MethodDecorator & ClassDecorator => SetMetadata(API_SURFACE_KEY, surface);
