import { randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_SETTINGS, type AuthSettings } from './config/auth.config.js';
import {
  isAuthSurfaceName,
  type AuthenticatedUser,
  type AuthSurfaceName,
} from './types/authenticated-user.js';

export type AccessTokenClaims = {
  sub: string;
  sid: string;
  surface: AuthSurfaceName;
  jti: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat?: number;
};

export type SignAccessTokenInput = {
  userId: string;
  sessionId: string;
  surface: AuthSurfaceName;
};

const ALGORITHM = 'HS256' as const;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  get accessTtlSeconds(): number {
    return this.settings.jwt.accessTtlSeconds;
  }

  signAccessToken(input: SignAccessTokenInput): Promise<string> {
    return this.jwt.signAsync(
      { sid: input.sessionId, surface: input.surface },
      {
        algorithm: ALGORITHM,
        secret: this.settings.jwt.accessSecret,
        subject: input.userId,
        jwtid: randomUUID(),
        issuer: this.settings.jwt.issuer,
        audience: this.settings.jwt.audience[input.surface],
        expiresIn: this.settings.jwt.accessTtlSeconds,
      },
    );
  }

  async verifyAccessToken(
    token: string,
    surface: AuthSurfaceName,
  ): Promise<AccessTokenClaims> {
    let payload: unknown;

    try {
      payload = await this.jwt.verifyAsync<object>(token, {
        algorithms: [ALGORITHM],
        secret: this.settings.jwt.accessSecret,
        issuer: this.settings.jwt.issuer,
        audience: this.settings.jwt.audience[surface],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return this.assertClaims(payload, surface);
  }

  /** Validates already-verified JWT claims and maps them to the request user. */
  toAuthenticatedUser(
    payload: unknown,
    surface: AuthSurfaceName,
  ): AuthenticatedUser {
    const claims = this.assertClaims(payload, surface);

    return {
      userId: claims.sub,
      sessionId: claims.sid,
      surface: claims.surface,
    };
  }

  private assertClaims(
    payload: unknown,
    surface: AuthSurfaceName,
  ): AccessTokenClaims {
    if (typeof payload !== 'object' || payload === null) {
      throw new UnauthorizedException('Invalid access token');
    }

    const claims = payload as Record<string, unknown>;

    if (
      typeof claims.sub !== 'string' ||
      typeof claims.sid !== 'string' ||
      typeof claims.jti !== 'string' ||
      typeof claims.iss !== 'string' ||
      typeof claims.exp !== 'number' ||
      !isAuthSurfaceName(claims.surface) ||
      claims.surface !== surface
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      sub: claims.sub,
      sid: claims.sid,
      surface: claims.surface,
      jti: claims.jti,
      iss: claims.iss,
      aud: claims.aud as string | string[],
      exp: claims.exp,
      iat: typeof claims.iat === 'number' ? claims.iat : undefined,
    };
  }
}
