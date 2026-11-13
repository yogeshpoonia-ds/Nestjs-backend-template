import { randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CacheService } from '../../infra/cache/cache.service.js';
import { PrismaService } from '../../infra/database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AUTH_SETTINGS, type AuthSettings } from './config/auth.config.js';
import { randomToken, sha256 } from './crypto/token.crypto.js';
import { TokenService } from './token.service.js';
import {
  toPrismaSurface,
  toSurfaceName,
  type AuthSurfaceName,
} from './types/authenticated-user.js';

export type CreateSessionInput = {
  userId: string;
  surface: AuthSurfaceName;
  userAgent?: string | null;
  ipAddress?: string | null;
  deviceName?: string | null;
};

export type SessionSummary = {
  id: string;
  surface: AuthSurfaceName;
  userAgent: string | null;
  ipAddress: string | null;
  deviceName: string | null;
  lastActivityAt: Date;
  createdAt: Date;
  expiresAt: Date;
  isCurrent?: boolean;
};

export type SessionTokens = {
  session: SessionSummary;
  userId: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: Date;
};

export type RevokeAllOptions = {
  exceptSessionId?: string;
  reason?: string;
};

const SESSION_SELECT = {
  id: true,
  userId: true,
  surface: true,
  userAgent: true,
  ipAddress: true,
  deviceName: true,
  lastActivityAt: true,
  createdAt: true,
  expiresAt: true,
} satisfies Prisma.SessionSelect;

type SessionRow = Prisma.SessionGetPayload<{ select: typeof SESSION_SELECT }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFRESH_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_META_LENGTH = 255;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly tokens: TokenService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  async createSession(input: CreateSessionInput): Promise<SessionTokens> {
    const sessionId = randomUUID();
    const refreshToken = this.newRefreshToken(sessionId);
    const refreshTokenExpiresAt = this.newRefreshExpiry();

    const row = await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: input.userId,
        surface: toPrismaSurface(input.surface),
        refreshTokenHash: sha256(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: truncate(input.userAgent),
        ipAddress: truncate(input.ipAddress),
        deviceName: truncate(input.deviceName),
      },
      select: SESSION_SELECT,
    });

    return this.buildTokens(row, refreshToken);
  }

  /**
   * Single-use refresh token rotation. The compare-and-swap is one atomic
   * UPDATE keyed on the current token hash, so concurrent or replayed requests
   * can only succeed once. A replay against a live session is treated as token
   * theft and revokes the session.
   */
  async rotateRefreshToken(
    refreshToken: string,
    surface: AuthSurfaceName,
  ): Promise<SessionTokens> {
    const sessionId = parseRefreshToken(refreshToken);

    if (sessionId === null) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const nextRefreshToken = this.newRefreshToken(sessionId);
    const refreshTokenExpiresAt = this.newRefreshExpiry();

    const updated = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        surface: toPrismaSurface(surface),
        refreshTokenHash: sha256(refreshToken),
        revokedAt: null,
        expiresAt: { gt: now },
        user: { isActive: true },
      },
      data: {
        refreshTokenHash: sha256(nextRefreshToken),
        tokenVersion: { increment: 1 },
        lastActivityAt: now,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    if (updated.count === 0) {
      await this.handleFailedRotation(sessionId, surface, now);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const row = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: SESSION_SELECT,
    });

    if (row === null) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildTokens(row, nextRefreshToken);
  }

  async logout(sessionId: string): Promise<void> {
    await this.revokeWhere({ id: sessionId }, 'logout');
    await this.invalidateSessionCache(sessionId);
  }

  async logoutAll(
    userId: string,
    options: RevokeAllOptions = {},
  ): Promise<void> {
    const ids = await this.prisma.$transaction((tx) =>
      this.revokeAllForUser(tx, userId, options),
    );

    await this.invalidateSessionCaches(ids);
  }

  /**
   * Revokes every active session of a user using the supplied transaction so
   * callers can make revocation atomic with other writes. Callers must call
   * `invalidateSessionCaches` with the returned ids after commit.
   */
  async revokeAllForUser(
    tx: Prisma.TransactionClient,
    userId: string,
    options: RevokeAllOptions = {},
  ): Promise<string[]> {
    const where: Prisma.SessionWhereInput = {
      userId,
      revokedAt: null,
      ...(options.exceptSessionId !== undefined
        ? { id: { not: options.exceptSessionId } }
        : {}),
    };

    const active = await tx.session.findMany({ where, select: { id: true } });

    if (active.length === 0) {
      return [];
    }

    const ids = active.map((session) => session.id);

    await tx.session.updateMany({
      where: { id: { in: ids }, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: options.reason ?? 'logout_all',
      },
    });

    return ids;
  }

  async listSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionSummary[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActivityAt: 'desc' },
      select: SESSION_SELECT,
    });

    return rows.map((row) => ({
      ...toSummary(row),
      ...(currentSessionId !== undefined
        ? { isCurrent: row.id === currentSessionId }
        : {}),
    }));
  }

  /**
   * Revokes a session that belongs to `actorUserId`. Admin endpoints that act
   * on another user's sessions pass that user's id here after the controller's
   * permission check (`sessions.revoke`).
   */
  async revokeSession(actorUserId: string, sessionId: string): Promise<void> {
    if (!UUID_PATTERN.test(sessionId)) {
      throw new NotFoundException('Session not found');
    }

    const revoked = await this.revokeWhere(
      { id: sessionId, userId: actorUserId },
      'revoked',
    );

    if (revoked === 0) {
      throw new NotFoundException('Session not found');
    }

    await this.invalidateSessionCache(sessionId);
  }

  /** Throws UnauthorizedException unless the session is live. */
  async assertActive(sessionId: string): Promise<void> {
    const key = cacheKey(sessionId);

    try {
      const cached = await this.cache.get(key);

      if (cached !== null && Number(cached) > Date.now()) {
        return;
      }
    } catch (error) {
      this.logger.warn(
        `Session cache read failed, falling back to database: ${errorMessage(error)}`,
      );
    }

    if (!UUID_PATTERN.test(sessionId)) {
      throw new UnauthorizedException('Session is no longer active');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        revokedAt: true,
        expiresAt: true,
        user: { select: { isActive: true } },
      },
    });

    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    const remainingSeconds = Math.floor(
      (session.expiresAt.getTime() - Date.now()) / 1000,
    );
    const ttl = Math.min(
      this.settings.sessionCacheTtlSeconds,
      remainingSeconds,
    );

    if (ttl > 0) {
      try {
        await this.cache.set(key, String(Date.now() + ttl * 1000), ttl);
      } catch (error) {
        this.logger.warn(`Session cache write failed: ${errorMessage(error)}`);
      }
    }
  }

  async invalidateSessionCache(sessionId: string): Promise<void> {
    try {
      await this.cache.del(cacheKey(sessionId));
    } catch (error) {
      this.logger.warn(
        `Session cache invalidation failed for ${sessionId}: ${errorMessage(error)}`,
      );
    }
  }

  async invalidateSessionCaches(sessionIds: readonly string[]): Promise<void> {
    await Promise.all(sessionIds.map((id) => this.invalidateSessionCache(id)));
  }

  private async handleFailedRotation(
    sessionId: string,
    surface: AuthSurfaceName,
    now: Date,
  ): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        surface: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { isActive: true } },
      },
    });

    if (
      session === null ||
      session.surface !== toPrismaSurface(surface) ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      return;
    }

    if (!session.user.isActive) {
      await this.revokeWhere({ id: sessionId }, 'user_inactive');
    } else {
      // Session is live but the presented token is not the current one:
      // a previously rotated token was replayed.
      this.logger.warn(`Refresh token reuse detected for session ${sessionId}`);
      await this.revokeWhere({ id: sessionId }, 'refresh_token_reuse');
    }

    await this.invalidateSessionCache(sessionId);
  }

  private async revokeWhere(
    where: Prisma.SessionWhereInput,
    reason: string,
  ): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });

    return result.count;
  }

  private async buildTokens(
    row: SessionRow,
    refreshToken: string,
  ): Promise<SessionTokens> {
    const surface = toSurfaceName(row.surface);
    const accessToken = await this.tokens.signAccessToken({
      userId: row.userId,
      sessionId: row.id,
      surface,
    });

    return {
      session: toSummary(row),
      userId: row.userId,
      refreshToken,
      accessToken,
      accessTokenExpiresIn: this.tokens.accessTtlSeconds,
      refreshTokenExpiresAt: row.expiresAt,
    };
  }

  private newRefreshToken(sessionId: string): string {
    return `${sessionId}.${randomToken(32)}`;
  }

  private newRefreshExpiry(): Date {
    return new Date(Date.now() + this.settings.refreshTokenTtlDays * DAY_MS);
  }
}

function cacheKey(sessionId: string): string {
  return `auth:session:${sessionId}`;
}

/** Returns the session id embedded in a well-formed refresh token, else null. */
function parseRefreshToken(refreshToken: string): string | null {
  const separator = refreshToken.indexOf('.');

  if (separator === -1) {
    return null;
  }

  const sessionId = refreshToken.slice(0, separator);
  const secret = refreshToken.slice(separator + 1);

  if (!UUID_PATTERN.test(sessionId) || !REFRESH_SECRET_PATTERN.test(secret)) {
    return null;
  }

  return sessionId;
}

function toSummary(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    surface: toSurfaceName(row.surface),
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    deviceName: row.deviceName,
    lastActivityAt: row.lastActivityAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

function truncate(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value.slice(0, MAX_META_LENGTH);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
