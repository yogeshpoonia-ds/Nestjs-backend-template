import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { resolveAuthSettings } from '../../src/features/auth/config/auth.config.js';
import { TokenService } from '../../src/features/auth/token.service.js';

const settings = resolveAuthSettings({
  JWT_ACCESS_SECRET: 'unit-test-secret-with-enough-length-123456',
  JWT_ISSUER: 'unit-issuer',
  JWT_AUDIENCE_ADMIN: 'unit-admin',
  JWT_AUDIENCE_WEB: 'unit-web',
  JWT_AUDIENCE_MOBILE: 'unit-mobile',
  JWT_ACCESS_TTL_SECONDS: '60',
});

describe('TokenService', () => {
  const service = new TokenService(new JwtService(), settings);

  it('signs and verifies an access token for a surface', async () => {
    const token = await service.signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      surface: 'web',
    });

    const payload = await service.verifyAccessToken(token, 'web');
    expect(payload.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.sid).toBe('22222222-2222-2222-2222-222222222222');
    expect(payload.surface).toBe('web');
  });

  it('rejects tokens used on a different surface', async () => {
    const token = await service.signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      surface: 'web',
    });

    await expect(service.verifyAccessToken(token, 'admin')).rejects.toThrow();
  });

  it('rejects tokens with an invalid signature', async () => {
    const other = new TokenService(
      new JwtService(),
      resolveAuthSettings({
        ...process.env,
        JWT_ACCESS_SECRET: 'another-secret-with-enough-length-abcdef',
        JWT_ISSUER: 'unit-issuer',
        JWT_AUDIENCE_ADMIN: 'unit-admin',
        JWT_AUDIENCE_WEB: 'unit-web',
        JWT_AUDIENCE_MOBILE: 'unit-mobile',
      }),
    );

    const token = await other.signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      surface: 'web',
    });

    await expect(service.verifyAccessToken(token, 'web')).rejects.toThrow();
  });
});
