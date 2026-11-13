import type { AuthSurfaceName } from '../types/authenticated-user.js';

export const AUTH_SETTINGS = Symbol('AUTH_SETTINGS');

export type AuthSettings = {
  jwt: {
    accessSecret: string;
    issuer: string;
    audience: Record<AuthSurfaceName, string>;
    accessTtlSeconds: number;
  };
  refreshTokenTtlDays: number;
  passwordResetTtlMinutes: number;
  cookieSecure: boolean;
  sessionCacheTtlSeconds: number;
};

const MIN_SECRET_LENGTH = 32;

function readRequired(
  env: NodeJS.ProcessEnv,
  name: string,
  errors: string[],
): string {
  const value = env[name]?.trim();

  if (!value) {
    errors.push(`${name} is required`);
    return '';
  }

  return value;
}

function readPositiveInt(
  env: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
  errors: string[],
): number {
  const raw = env[name]?.trim();

  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${name} must be a positive integer (received "${raw}")`);
    return defaultValue;
  }

  return value;
}

export function resolveAuthSettings(
  env: NodeJS.ProcessEnv = process.env,
): AuthSettings {
  const errors: string[] = [];

  const accessSecret = readRequired(env, 'JWT_ACCESS_SECRET', errors);

  if (accessSecret && accessSecret.length < MIN_SECRET_LENGTH) {
    errors.push(
      `JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`,
    );
  }

  const issuer = readRequired(env, 'JWT_ISSUER', errors);
  const audience: Record<AuthSurfaceName, string> = {
    admin: readRequired(env, 'JWT_AUDIENCE_ADMIN', errors),
    web: readRequired(env, 'JWT_AUDIENCE_WEB', errors),
    mobile: readRequired(env, 'JWT_AUDIENCE_MOBILE', errors),
  };

  const accessTtlSeconds = readPositiveInt(
    env,
    'JWT_ACCESS_TTL_SECONDS',
    900,
    errors,
  );
  const refreshTokenTtlDays = readPositiveInt(
    env,
    'REFRESH_TOKEN_TTL_DAYS',
    30,
    errors,
  );
  const passwordResetTtlMinutes = readPositiveInt(
    env,
    'PASSWORD_RESET_TTL_MINUTES',
    30,
    errors,
  );
  const sessionCacheTtlSeconds = readPositiveInt(
    env,
    'SESSION_CACHE_TTL_SECONDS',
    60,
    errors,
  );
  const cookieSecure = env.COOKIE_SECURE?.trim().toLowerCase() !== 'false';

  if (errors.length > 0) {
    throw new Error(
      `Invalid auth configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  return {
    jwt: { accessSecret, issuer, audience, accessTtlSeconds },
    refreshTokenTtlDays,
    passwordResetTtlMinutes,
    cookieSecure,
    sessionCacheTtlSeconds,
  };
}
