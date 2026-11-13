import { describe, expect, it } from 'vitest';
import { resolveI18nSettings } from '../src/i18n/i18n.constants.js';

describe('resolveI18nSettings', () => {
  it('uses English as the default language', () => {
    expect(
      resolveI18nSettings({
        DEFAULT_LANGUAGE: undefined,
        SUPPORTED_LANGUAGES: undefined,
      }),
    ).toEqual({
      defaultLanguage: 'en',
      supportedLanguages: ['en', 'hi'],
    });
  });

  it('rejects a default language that is not supported', () => {
    expect(() =>
      resolveI18nSettings({
        DEFAULT_LANGUAGE: 'fr',
        SUPPORTED_LANGUAGES: 'en,hi',
      }),
    ).toThrow(/DEFAULT_LANGUAGE "fr"/);
  });

  it('rejects an empty supported languages list', () => {
    expect(() =>
      resolveI18nSettings({
        DEFAULT_LANGUAGE: 'en',
        SUPPORTED_LANGUAGES: ' , ',
      }),
    ).toThrow(/SUPPORTED_LANGUAGES/);
  });
});
