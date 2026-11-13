import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomToken } from '../crypto/token.crypto.js';

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const CSRF_COOKIE_NAME = 'csrf_token';
/** Fastify lower-cases incoming header names. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

export const ADMIN_AUTH_COOKIE_PATH = '/admin/v1/auth';
export const WEB_AUTH_COOKIE_PATH = '/web/v1/auth';

export type AuthCookieOptions = {
  /** Cookie path, e.g. `/admin/v1/auth`. */
  path: string;
  secure: boolean;
};

export type SetAuthCookiesInput = AuthCookieOptions & {
  refreshToken: string;
  /** Refresh cookie lifetime. */
  expiresAt: Date;
};

/**
 * Sets the HttpOnly refresh cookie plus a script-readable CSRF cookie
 * (double-submit pattern). Returns the CSRF token so it can also be returned
 * in the response body for cross-origin clients that cannot read the cookie.
 */
export function setAuthCookies(
  reply: FastifyReply,
  input: SetAuthCookiesInput,
): string {
  const csrfToken = randomToken(32);

  reply.setCookie(REFRESH_COOKIE_NAME, input.refreshToken, {
    ...baseOptions(input),
    httpOnly: true,
    expires: input.expiresAt,
  });

  reply.setCookie(CSRF_COOKIE_NAME, csrfToken, {
    ...baseOptions(input),
    httpOnly: false,
    expires: input.expiresAt,
  });

  return csrfToken;
}

export function clearAuthCookies(
  reply: FastifyReply,
  options: AuthCookieOptions,
): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    ...baseOptions(options),
    httpOnly: true,
  });
  reply.clearCookie(CSRF_COOKIE_NAME, {
    ...baseOptions(options),
    httpOnly: false,
  });
}

export function readRefreshCookie(request: FastifyRequest): string | undefined {
  const value = request.cookies?.[REFRESH_COOKIE_NAME];

  return typeof value === 'string' && value !== '' ? value : undefined;
}

function baseOptions(options: AuthCookieOptions): CookieSerializeOptions {
  return {
    path: options.path,
    secure: options.secure,
    sameSite: 'strict',
  };
}
