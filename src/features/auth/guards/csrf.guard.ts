import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../http/cookie.util.js';

/**
 * Double-submit CSRF check for endpoints authenticated by cookie (refresh).
 * The `csrf_token` cookie must equal the `X-CSRF-Token` header.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerValue = request.headers[CSRF_HEADER_NAME];
    const headerToken = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (
      typeof cookieToken !== 'string' ||
      cookieToken === '' ||
      typeof headerToken !== 'string' ||
      !safeEqual(cookieToken, headerToken)
    ) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}
