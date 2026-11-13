import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { resolveAuthSettings } from '../src/features/auth/config/auth.config.js';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '../src/features/auth/crypto/password.crypto.js';
import {
  randomToken,
  sha256,
} from '../src/features/auth/crypto/token.crypto.js';
import { TokenService } from '../src/features/auth/token.service.js';

const validEnv = {
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  JWT_ISSUER: 'issuer',
  JWT_AUDIENCE_ADMIN: 'aud-admin',
  JWT_AUDIENCE_WEB: 'aud-web',
  JWT_AUDIENCE_MOBILE: 'aud-mobile',
} satisfies NodeJS.ProcessEnv;

describe('resolveAuthSettings', () => {
  it('applies defaults', () => {
    const settings = resolveAuthSettings(validEnv);

    expect(settings.jwt.accessTtlSeconds).toBe(900);
    expect(settings.refreshTokenTtlDays).toBe(30);
    expect(settings.passwordResetTtlMinutes).toBe(30);
    expect(settings.sessionCacheTtlSeconds).toBe(60);
    expect(settings.cookieSecure).toBe(true);
  });

  it('allows disabling secure cookies', () => {
    expect(
      resolveAuthSettings({ ...validEnv, COOKIE_SECURE: 'false' }).cookieSecure,
    ).toBe(false);
  });

  it('reports every missing or invalid variable', () => {
    expect(() => resolveAuthSettings({ JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET must be at least 32[\s\S]*JWT_ISSUER is required[\s\S]*JWT_AUDIENCE_MOBILE is required/,
    );
  });

  it('rejects non-positive TTLs', () => {
    expect(() =>
      resolveAuthSettings({ ...validEnv, REFRESH_TOKEN_TTL_DAYS: '0' }),
    ).toThrow(/REFRESH_TOKEN_TTL_DAYS/);
  });
});

describe('crypto', () => {
  it('generates url-safe random tokens and stable hashes', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
    expect(sha256('a')).toBe(
      'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    );
  });

  it('hashes and verifies passwords with argon2id', async () => {
    const hash = await hashPassword('correct horse');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
    expect(await verifyPassword(DUMMY_PASSWORD_HASH, 'wrong')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});

describe('TokenService', () => {
  const settings = resolveAuthSettings(validEnv);
  const tokens = new TokenService(new JwtService(), settings);

  it('signs and verifies per-surface tokens', async () => {
    const token = await tokens.signAccessToken({
      userId: 'u1',
      sessionId: 's1',
      surface: 'web',
    });
    const claims = await tokens.verifyAccessToken(token, 'web');

    expect(claims).toMatchObject({
      sub: 'u1',
      sid: 's1',
      surface: 'web',
      iss: 'issuer',
      aud: 'aud-web',
    });
    expect(claims.jti).toBeTruthy();
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('rejects tokens presented to another surface', async () => {
    const token = await tokens.signAccessToken({
      userId: 'u1',
      sessionId: 's1',
      surface: 'web',
    });

    await expect(tokens.verifyAccessToken(token, 'admin')).rejects.toThrow();
    await expect(tokens.verifyAccessToken(token, 'mobile')).rejects.toThrow();
  });
});
