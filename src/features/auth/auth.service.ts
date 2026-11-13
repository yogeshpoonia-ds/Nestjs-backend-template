import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { QueueService } from '../../infra/queue/queue.service.js';
import { PERMISSIONS } from '../rbac/definitions/permissions.js';
import { PermissionResolutionService } from '../rbac/services/permission-resolution.service.js';
import { AUTH_SETTINGS, type AuthSettings } from './config/auth.config.js';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from './crypto/password.crypto.js';
import { randomToken, sha256 } from './crypto/token.crypto.js';
import { SessionService, type SessionTokens } from './session.service.js';
import type {
  AuthenticatedUser,
  AuthSurfaceName,
} from './types/authenticated-user.js';
import { normalizeEmail } from './utils/email.util.js';

export const MAIL_QUEUE = 'mail';
export const PASSWORD_RESET_JOB = 'password-reset';

export type RequestMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceName?: string | null;
};

export type AuthUserProfile = {
  id: string;
  email: string;
  name: string;
};

export type AuthResult = SessionTokens & { user: AuthUserProfile };

export type PasswordResetMailJob = {
  userId: string;
  email: string;
  name: string;
  token: string;
  expiresAt: string;
};

const INVALID_CREDENTIALS = 'Invalid credentials';
const MINUTE_MS = 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly queue: QueueService,
    private readonly permissions: PermissionResolutionService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  async login(
    email: string,
    password: string,
    surface: AuthSurfaceName,
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        isActive: true,
      },
    });

    // Always run a verification so response time does not reveal whether the
    // email exists.
    const passwordValid = await verifyPassword(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      password,
    );

    if (user === null || !passwordValid || !user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (surface === 'admin' && !(await this.hasAdminAccess(user.id))) {
      // Same error as a bad password: do not reveal which accounts are admins.
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const tokens = await this.sessions.createSession({
      userId: user.id,
      surface,
      ...meta,
    });

    return { ...tokens, user: toProfile(user) };
  }

  async register(
    input: { email: string; password: string; name: string },
    surface: AuthSurfaceName,
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    if (surface === 'admin') {
      throw new BadRequestException(
        'Registration is not available on this surface',
      );
    }

    const passwordHash = await hashPassword(input.password);

    let user: AuthUserProfile;

    try {
      user = await this.prisma.user.create({
        data: {
          email: normalizeEmail(input.email),
          name: input.name.trim(),
          passwordHash,
        },
        select: { id: true, email: true, name: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }

    const tokens = await this.sessions.createSession({
      userId: user.id,
      surface,
      ...meta,
    });

    return { ...tokens, user };
  }

  async refresh(
    refreshToken: string,
    surface: AuthSurfaceName,
  ): Promise<AuthResult> {
    const tokens = await this.sessions.rotateRefreshToken(
      refreshToken,
      surface,
    );

    if (surface === 'admin' && !(await this.hasAdminAccess(tokens.userId))) {
      await this.sessions.logout(tokens.session.id);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tokens.userId },
      select: { id: true, email: true, name: true },
    });

    if (user === null) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { ...tokens, user };
  }

  logout(sessionId: string): Promise<void> {
    return this.sessions.logout(sessionId);
  }

  logoutAll(userId: string): Promise<void> {
    return this.sessions.logoutAll(userId);
  }

  async getProfile(
    user: AuthenticatedUser,
  ): Promise<
    AuthUserProfile & { sessionId: string; surface: AuthSurfaceName }
  > {
    const record = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, name: true },
    });

    if (record === null) {
      throw new UnauthorizedException();
    }

    return { ...record, sessionId: user.sessionId, surface: user.surface };
  }

  async changePassword(
    user: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const record = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (record === null || !record.isActive) {
      throw new UnauthorizedException();
    }

    if (!(await verifyPassword(record.passwordHash, currentPassword))) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await hashPassword(newPassword);

    const revokedIds = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      });

      // Keep the caller signed in; sign every other device out.
      return this.sessions.revokeAllForUser(tx, record.id, {
        exceptSessionId: user.sessionId,
        reason: 'password_changed',
      });
    });

    await this.sessions.invalidateSessionCaches(revokedIds);
  }

  /**
   * Always resolves without revealing whether the email is registered. The
   * controller responds 202 regardless of the outcome.
   */
  async forgotPassword(email: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: normalizeEmail(email) },
        select: { id: true, email: true, name: true, isActive: true },
      });

      if (user === null || !user.isActive) {
        return;
      }

      const token = randomToken(32);
      const expiresAt = new Date(
        Date.now() + this.settings.passwordResetTtlMinutes * MINUTE_MS,
      );

      await this.prisma.$transaction([
        this.prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        this.prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash: sha256(token), expiresAt },
        }),
      ]);

      const job: PasswordResetMailJob = {
        userId: user.id,
        email: user.email,
        name: user.name,
        token,
        expiresAt: expiresAt.toISOString(),
      };

      await this.queue.add(MAIL_QUEUE, PASSWORD_RESET_JOB, job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
      });
    } catch (error) {
      this.logger.error(
        'Failed to process forgot-password request',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (
      record === null ||
      record.usedAt !== null ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);

    const revokedIds = await this.prisma.$transaction(async (tx) => {
      // Atomic single-use: only one concurrent request can flip usedAt.
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (claimed.count === 0) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      return this.sessions.revokeAllForUser(tx, record.userId, {
        reason: 'password_reset',
      });
    });

    await this.sessions.invalidateSessionCaches(revokedIds);
  }

  private hasAdminAccess(userId: string): Promise<boolean> {
    return this.permissions.hasPermissions(userId, [PERMISSIONS.ADMIN.ACCESS]);
  }
}

function toProfile(user: AuthUserProfile): AuthUserProfile {
  return { id: user.id, email: user.email, name: user.name };
}
