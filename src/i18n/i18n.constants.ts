export const FALLBACK_LANGUAGE = 'en';

export type I18nSettings = {
  defaultLanguage: string;
  supportedLanguages: string[];
};

export function resolveI18nSettings(
  env: NodeJS.ProcessEnv = process.env,
): I18nSettings {
  const defaultLanguage = (env.DEFAULT_LANGUAGE ?? FALLBACK_LANGUAGE).trim();
  const supportedLanguages = (env.SUPPORTED_LANGUAGES ?? 'en,hi')
    .split(',')
    .map((language) => language.trim())
    .filter(Boolean);

  if (supportedLanguages.length === 0) {
    throw new Error('SUPPORTED_LANGUAGES must include at least one language');
  }

  if (!supportedLanguages.includes(defaultLanguage)) {
    throw new Error(
      `DEFAULT_LANGUAGE "${defaultLanguage}" must be one of SUPPORTED_LANGUAGES: ${supportedLanguages.join(', ')}`,
    );
  }

  return {
    defaultLanguage,
    supportedLanguages,
  };
}
