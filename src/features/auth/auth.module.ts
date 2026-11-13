import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { RbacModule } from '../rbac/rbac.module.js';
import { AuthService } from './auth.service.js';
import { AUTH_SETTINGS, resolveAuthSettings } from './config/auth.config.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { SessionService } from './session.service.js';
import {
  JwtAdminStrategy,
  JwtMobileStrategy,
  JwtWebStrategy,
} from './strategies/jwt.strategy.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      useFactory: () => {
        const settings = resolveAuthSettings(process.env);

        return {
          secret: settings.jwt.accessSecret,
          signOptions: { algorithm: 'HS256' },
          verifyOptions: { algorithms: ['HS256'] },
        };
      },
    }),
    RbacModule,
  ],
  providers: [
    {
      provide: AUTH_SETTINGS,
      useFactory: () => resolveAuthSettings(process.env),
    },
    AuthService,
    SessionService,
    TokenService,
    JwtAdminStrategy,
    JwtWebStrategy,
    JwtMobileStrategy,
    JwtAuthGuard,
    CsrfGuard,
  ],
  exports: [
    AUTH_SETTINGS,
    AuthService,
    SessionService,
    TokenService,
    JwtAuthGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}
