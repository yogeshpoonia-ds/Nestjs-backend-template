import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PERMISSIONS } from '../../../rbac/definitions/permissions.js';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from '../../../rbac/guards/permissions.guard.js';
import { AUTH_SETTINGS, type AuthSettings } from '../../config/auth.config.js';
import { AuthService } from '../../auth.service.js';
import { ApiSurface } from '../../decorators/api-surface.decorator.js';
import { CurrentUser } from '../../decorators/current-user.decorator.js';
import { Public } from '../../decorators/public.decorator.js';
import {
  AcceptedResponseDto,
  AccessTokenResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ProfileDto,
  ResetPasswordDto,
  SessionDto,
} from '../../dto/index.js';
import { CsrfGuard } from '../../guards/csrf.guard.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { SessionService, type SessionSummary } from '../../session.service.js';
import type { AuthenticatedUser } from '../../types/authenticated-user.js';
import { toAccessTokenResponse } from '../auth-response.util.js';
import {
  ADMIN_AUTH_COOKIE_PATH,
  clearAuthCookies,
  readRefreshCookie,
  setAuthCookies,
} from '../cookie.util.js';
import { extractRequestMeta } from '../request-meta.util.js';

/** Relative routes. AdminApiModule mounts this module at /admin/v1. */
@ApiTags('admin / auth')
@ApiBearerAuth()
@ApiSurface('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('auth')
export class AuthAdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AccessTokenResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AccessTokenResponseDto> {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      'admin',
      extractRequestMeta(request, dto.deviceName),
    );
    const csrfToken = setAuthCookies(reply, {
      path: ADMIN_AUTH_COOKIE_PATH,
      secure: this.settings.cookieSecure,
      refreshToken: result.refreshToken,
      expiresAt: result.refreshTokenExpiresAt,
    });

    return toAccessTokenResponse(result, { csrfToken });
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AccessTokenResponseDto })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AccessTokenResponseDto> {
    const refreshToken = readRefreshCookie(request);

    if (refreshToken === undefined) {
      throw new UnauthorizedException('Missing refresh token');
    }

    try {
      const result = await this.auth.refresh(refreshToken, 'admin');
      const csrfToken = setAuthCookies(reply, {
        path: ADMIN_AUTH_COOKIE_PATH,
        secure: this.settings.cookieSecure,
        refreshToken: result.refreshToken,
        expiresAt: result.refreshTokenExpiresAt,
      });

      return toAccessTokenResponse(result, { csrfToken });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.clearCookies(reply);
      }

      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.logout(user.sessionId);
    this.clearCookies(reply);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.logoutAll(user.userId);
    this.clearCookies(reply);
  }

  @Get('me')
  @ApiOkResponse({ type: ProfileDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<ProfileDto> {
    return this.auth.getProfile(user);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.auth.changePassword(user, dto.currentPassword, dto.newPassword);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ type: AcceptedResponseDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<AcceptedResponseDto> {
    await this.auth.forgotPassword(dto.email);

    return { accepted: true };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Get('sessions')
  @ApiOkResponse({ type: [SessionDto] })
  listSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionSummary[]> {
    return this.sessions.listSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    return this.sessions.revokeSession(user.userId, sessionId);
  }

  @Get('users/:userId/sessions')
  @RequirePermissions(PERMISSIONS.SESSIONS.READ)
  @ApiOkResponse({ type: [SessionDto] })
  listUserSessions(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<SessionSummary[]> {
    return this.sessions.listSessions(userId);
  }

  @Delete('users/:userId/sessions/:id')
  @RequirePermissions(PERMISSIONS.SESSIONS.REVOKE)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeUserSession(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    return this.sessions.revokeSession(userId, sessionId);
  }

  private clearCookies(reply: FastifyReply): void {
    clearAuthCookies(reply, {
      path: ADMIN_AUTH_COOKIE_PATH,
      secure: this.settings.cookieSecure,
    });
  }
}
