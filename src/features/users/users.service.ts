import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service.js';
import { paginate, type PaginatedResult } from '../../shared/pagination.js';
import { hashPassword } from '../auth/crypto/password.crypto.js';
import { normalizeEmail } from '../auth/utils/email.util.js';

export type UserPublic = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getByIdOrThrow(id: string): Promise<UserPublic> {
    const user = await this.findById(id);

    if (user === null) {
      throw new NotFoundException('User not found');
    }

    return this.toPublic(user);
  }

  async create(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<UserPublic> {
    const email = normalizeEmail(input.email);
    const existing = await this.findByEmail(email);

    if (existing !== null) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      },
    });

    return this.toPublic(user);
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
      },
    });
  }

  async list(
    page: number,
    limit: number,
  ): Promise<PaginatedResult<UserPublic>> {
    const { skip, take } = paginate(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: items.map((user) => this.toPublic(user)),
      total,
      page,
      limit,
    };
  }

  private toPublic(user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserPublic {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
