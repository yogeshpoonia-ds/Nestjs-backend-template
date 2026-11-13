import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
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
import type { FastifyRequest } from 'fastify';
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
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  SessionDto,
} from '../../dto/index.js';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard.js';
import { SessionService, type SessionSummary } from '../../session.service.js';
import type { AuthenticatedUser } from '../../types/authenticated-user.js';
import { toAccessTokenResponse } from '../auth-response.util.js';
import { extractRequestMeta } from '../request-meta.util.js';

const NO_STORE = 'no-store';

/** Relative routes. MobileApiModule mounts this module at /mobile/v1. */
@ApiTags('mobile / auth')
@ApiBearerAuth()
@ApiSurface('mobile')
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthMobileController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('register')
  @Header('Cache-Control', NO_STORE)
  @Header('Pragma', 'no-cache')
  @ApiCreatedResponse({ type: AccessTokenResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
  ): Promise<AccessTokenResponseDto> {
    const result = await this.auth.register(
      { email: dto.email, password: dto.password, name: dto.name },
      'mobile',
      extractRequestMeta(request, dto.deviceName),
    );

    return toAccessTokenResponse(result, { includeRefreshToken: true });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @Header('Pragma', 'no-cache')
  @ApiOkResponse({ type: AccessTokenResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
  ): Promise<AccessTokenResponseDto> {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      'mobile',
      extractRequestMeta(request, dto.deviceName),
    );

    return toAccessTokenResponse(result, { includeRefreshToken: true });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE)
  @Header('Pragma', 'no-cache')
  @ApiOkResponse({ type: AccessTokenResponseDto })
  async refresh(@Body() dto: RefreshDto): Promise<AccessTokenResponseDto> {
    if (dto.refreshToken === undefined) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const result = await this.auth.refresh(dto.refreshToken, 'mobile');

    return toAccessTokenResponse(result, { includeRefreshToken: true });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.auth.logout(user.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.auth.logoutAll(user.userId);
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
}
