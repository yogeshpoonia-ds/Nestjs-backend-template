import { AuthSurface } from '../../../generated/prisma/client.js';

export type AuthSurfaceName = 'admin' | 'web' | 'mobile';

export type AuthenticatedUser = {
  userId: string;
  sessionId: string;
  surface: AuthSurfaceName;
};

export const AUTH_SURFACE_NAMES: readonly AuthSurfaceName[] = [
  'admin',
  'web',
  'mobile',
];

const NAME_TO_PRISMA: Record<AuthSurfaceName, AuthSurface> = {
  admin: AuthSurface.ADMIN,
  web: AuthSurface.WEB,
  mobile: AuthSurface.MOBILE,
};

const PRISMA_TO_NAME: Record<AuthSurface, AuthSurfaceName> = {
  [AuthSurface.ADMIN]: 'admin',
  [AuthSurface.WEB]: 'web',
  [AuthSurface.MOBILE]: 'mobile',
};

export function isAuthSurfaceName(value: unknown): value is AuthSurfaceName {
  return (
    typeof value === 'string' &&
    (AUTH_SURFACE_NAMES as readonly string[]).includes(value)
  );
}

export function toPrismaSurface(name: AuthSurfaceName): AuthSurface {
  return NAME_TO_PRISMA[name];
}

export function toSurfaceName(surface: AuthSurface): AuthSurfaceName {
  return PRISMA_TO_NAME[surface];
}
