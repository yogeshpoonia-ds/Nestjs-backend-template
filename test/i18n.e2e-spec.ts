import {
  Body,
  Controller,
  Get,
  Module,
  Post,
} from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { IsEmail, IsString, MinLength } from 'class-validator';
import {
  I18nContext,
  I18nService,
  i18nValidationMessage,
} from 'nestjs-i18n';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { I18nModule } from '../src/i18n/i18n.module.js';

class CreateUserDto {
  @IsEmail({}, { message: i18nValidationMessage('validation.INVALID_EMAIL') })
  email!: string;

  @IsString({ message: i18nValidationMessage('validation.REQUIRED') })
  @MinLength(8, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  password!: string;
}

@Controller('i18n-check')
class I18nCheckController {
  constructor(private readonly i18n: I18nService) {}

  @Get()
  async check() {
    const lang = I18nContext.current()?.lang ?? 'en';

    return {
      lang,
      message: await this.i18n.translate('common.SUCCESS', { lang }),
    };
  }

  @Post('users')
  create(@Body() body: CreateUserDto) {
    return body;
  }
}

@Module({
  controllers: [I18nCheckController],
})
class AdminProbeModule {}

@Module({
  controllers: [I18nCheckController],
})
class WebProbeModule {}

@Module({
  controllers: [I18nCheckController],
})
class MobileProbeModule {}

@Module({
  imports: [
    I18nModule,
    AdminProbeModule,
    WebProbeModule,
    MobileProbeModule,
    RouterModule.register([
      { path: 'admin/v1', module: AdminProbeModule },
      { path: 'web/v1', module: WebProbeModule },
      { path: 'mobile/v1', module: MobileProbeModule },
    ]),
  ],
})
class ProbeRootModule {}

describe('i18n', () => {
  let app: NestFastifyApplication;
  let i18n: I18nService;

  beforeAll(async () => {
    process.env.DEFAULT_LANGUAGE = 'en';
    process.env.SUPPORTED_LANGUAGES = 'en,hi';

    const moduleRef = await Test.createTestingModule({
      imports: [ProbeRootModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    i18n = app.get(I18nService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('resolves English translation keys', () => {
    expect(i18n.translate('auth.LOGIN_SUCCESS', { lang: 'en' })).toBe(
      'Login successful',
    );
  });

  it('resolves Hindi translation keys', () => {
    expect(i18n.translate('auth.LOGIN_SUCCESS', { lang: 'hi' })).toBe(
      'लॉगिन सफल',
    );
  });

  it('interpolates validation parameters', () => {
    expect(
      i18n.translate('validation.MIN_LENGTH', {
        lang: 'en',
        args: { property: 'password', constraints: [8] },
      }),
    ).toBe('password must be at least 8 characters');
  });

  it('uses the default language when Accept-Language is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/v1/i18n-check',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      lang: 'en',
      message: 'Success',
    });
  });

  it('resolves Hindi from Accept-Language', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/web/v1/i18n-check',
      headers: { 'accept-language': 'hi' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      lang: 'hi',
      message: 'सफल',
    });
  });

  it('falls back for unsupported Accept-Language values', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/mobile/v1/i18n-check',
      headers: { 'accept-language': 'fr' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      lang: 'en',
      message: 'Success',
    });
  });

  it('returns localized validation errors in English', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/admin/v1/i18n-check/users',
      headers: {
        'content-type': 'application/json',
        'accept-language': 'en',
      },
      payload: { email: 'not-an-email', password: 'short' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { message: string | string[] };
    const messages = Array.isArray(body.message)
      ? body.message
      : [body.message];

    expect(messages).toEqual(
      expect.arrayContaining([
        'Email is required',
        expect.stringContaining('password must be at least 8 characters'),
      ]),
    );
  });

  it('returns localized validation errors in Hindi', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/web/v1/i18n-check/users',
      headers: {
        'content-type': 'application/json',
        'accept-language': 'hi',
      },
      payload: { email: 'not-an-email', password: 'short' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as { message: string | string[] };
    const messages = Array.isArray(body.message)
      ? body.message
      : [body.message];

    expect(messages).toEqual(
      expect.arrayContaining([
        'ईमेल आवश्यक है',
        expect.stringMatching(/password.*8/),
      ]),
    );
  });

  it.each(['/admin/v1/i18n-check', '/web/v1/i18n-check', '/mobile/v1/i18n-check'])(
    'exposes translations on %s',
    async (url) => {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { 'accept-language': 'hi' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        lang: 'hi',
        message: 'सफल',
      });
    },
  );
});
