import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import {
  AcceptLanguageResolver,
  I18nModule as NestI18nModule,
  I18nValidationExceptionFilter,
  I18nValidationPipe,
} from 'nestjs-i18n';
import { resolveI18nSettings } from './i18n.constants.js';

const { defaultLanguage } = resolveI18nSettings();

@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: defaultLanguage,
      fallbacks: {
        'en-*': 'en',
        'hi-*': 'hi',
      },
      loaderOptions: {
        path: import.meta.dirname,
        watch: process.env.NODE_ENV === 'development',
      },
      resolvers: [AcceptLanguageResolver],
    }),
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new I18nValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    },
    {
      provide: APP_FILTER,
      useValue: new I18nValidationExceptionFilter({
        detailedErrors: false,
      }),
    },
  ],
  exports: [NestI18nModule],
})
export class I18nModule {}
