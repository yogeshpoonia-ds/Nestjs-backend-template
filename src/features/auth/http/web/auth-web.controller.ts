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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
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
  RegisterDto,
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
  WEB_AUTH_COOKIE_PATH,
  clearAuthCookies,
  readRefreshCookie,
  setAuthCookies,
} from '../cookie.util.js';
import { extractRequestMeta } from '../request-meta.util.js';

/** Relative routes. WebApiModule mounts this module at /web/v1. */
@ApiTags('web / auth')
@ApiBearerAuth()
@ApiSurface('web')
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthWebController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({ type: AccessTokenResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AccessTokenResponseDto> {
    const result = await this.auth.register(
      { email: dto.email, password: dto.password, name: dto.name },
      'web',
      extractRequestMeta(request, dto.deviceName),
    );
    const csrfToken = setAuthCookies(reply, {
      path: WEB_AUTH_COOKIE_PATH,
      secure: this.settings.cookieSecure,
      refreshToken: result.refreshToken,
      expiresAt: result.refreshTokenExpiresAt,
    });

    return toAccessTokenResponse(result, { csrfToken });
  }

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
      'web',
      extractRequestMeta(request, dto.deviceName),
    );
    const csrfToken = setAuthCookies(reply, {
      path: WEB_AUTH_COOKIE_PATH,
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
      const result = await this.auth.refresh(refreshToken, 'web');
      const csrfToken = setAuthCookies(reply, {
        path: WEB_AUTH_COOKIE_PATH,
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

  private clearCookies(reply: FastifyReply): void {
    clearAuthCookies(reply, {
      path: WEB_AUTH_COOKIE_PATH,
      secure: this.settings.cookieSecure,
    });
  }
}
