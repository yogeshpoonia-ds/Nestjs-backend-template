import type { FastifyRequest } from 'fastify';
import type { RequestMeta } from '../auth.service.js';

export function extractRequestMeta(
  request: FastifyRequest,
  deviceName?: string,
): RequestMeta {
  const userAgent = request.headers['user-agent'];

  return {
    userAgent: typeof userAgent === 'string' ? userAgent : null,
    ipAddress: request.ip,
    deviceName: deviceName ?? null,
  };
}
