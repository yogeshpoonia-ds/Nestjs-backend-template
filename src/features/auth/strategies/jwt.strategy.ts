import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  type StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { AUTH_SETTINGS, type AuthSettings } from '../config/auth.config.js';
import { SessionService } from '../session.service.js';
import { TokenService } from '../token.service.js';
import type {
  AuthenticatedUser,
  AuthSurfaceName,
} from '../types/authenticated-user.js';

function strategyOptions(
  settings: AuthSettings,
  surface: AuthSurfaceName,
): StrategyOptionsWithoutRequest {
  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: settings.jwt.accessSecret,
    issuer: settings.jwt.issuer,
    audience: settings.jwt.audience[surface],
    algorithms: ['HS256'],
  };
}

async function validateAccessPayload(
  payload: unknown,
  surface: AuthSurfaceName,
  tokens: TokenService,
  sessions: SessionService,
): Promise<AuthenticatedUser> {
  const user = tokens.toAuthenticatedUser(payload, surface);

  await sessions.assertActive(user.sessionId);

  return user;
}

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(
    @Inject(AUTH_SETTINGS) settings: AuthSettings,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {
    super(strategyOptions(settings, 'admin'));
  }

  validate(payload: unknown): Promise<AuthenticatedUser> {
    return validateAccessPayload(payload, 'admin', this.tokens, this.sessions);
  }
}

@Injectable()
export class JwtWebStrategy extends PassportStrategy(Strategy, 'jwt-web') {
  constructor(
    @Inject(AUTH_SETTINGS) settings: AuthSettings,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {
    super(strategyOptions(settings, 'web'));
  }

  validate(payload: unknown): Promise<AuthenticatedUser> {
    return validateAccessPayload(payload, 'web', this.tokens, this.sessions);
  }
}

@Injectable()
export class JwtMobileStrategy extends PassportStrategy(
  Strategy,
  'jwt-mobile',
) {
  constructor(
    @Inject(AUTH_SETTINGS) settings: AuthSettings,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {
    super(strategyOptions(settings, 'mobile'));
  }

  validate(payload: unknown): Promise<AuthenticatedUser> {
    return validateAccessPayload(payload, 'mobile', this.tokens, this.sessions);
  }
}
