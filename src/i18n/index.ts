/**
 * i18n setup for Censoris.
 *
 * - All user-facing strings live in src/i18n/locales/*.json. No hardcoded
 *   strings in components (enforced by review).
 * - Eight languages: en, hi, ta, te, bn, mr, gu, kn.
 * - English and Hindi are complete. The other six carry "_needsReview": true
 *   at the top level until a native speaker checks them
 *   (see scripts/check-locales.js).
 * - Language can change at runtime without restarting (i18n.changeLanguage).
 * - Device language from expo-localization picks the initial language if the
 *   user has not chosen one in Settings yet.
 */
import { getLocales } from 'expo-localization';
import i18n, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import bn from './locales/bn.json';
import mr from './locales/mr.json';
import gu from './locales/gu.json';
import kn from './locales/kn.json';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  bn: 'বাংলা',
  mr: 'मराठी',
  gu: 'ગુજરાતી',
  kn: 'ಕನ್ನಡ',
};

/** Languages whose draft translations still need a native-speaker review. */
export const LANGUAGES_NEEDING_REVIEW: readonly Language[] = ['ta', 'te', 'bn', 'mr', 'gu', 'kn'];

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  ta: { translation: ta },
  te: { translation: te },
  bn: { translation: bn },
  mr: { translation: mr },
  gu: { translation: gu },
  kn: { translation: kn },
};

export function isSupportedLanguage(code: string): code is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** Best supported match for a device locale like "hi-IN" or "en-US". */
export function matchDeviceLanguage(deviceLanguages: readonly string[]): Language {
  for (const tag of deviceLanguages) {
    const base = tag.split('-')[0].toLowerCase();
    if (isSupportedLanguage(base)) return base;
  }
  return 'en';
}

export function detectDeviceLanguage(): Language {
  try {
    const locales = getLocales();
    return matchDeviceLanguage(locales.map((l) => l.languageCode ?? '').filter(Boolean));
  } catch {
    // Happens in some test environments; English is the safe default.
    return 'en';
  }
}

function createInstance(): I18nInstance {
  const instance = i18n.createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
  return instance;
}

export const i18nInstance = createInstance();

/** Change language at runtime; resolves once resources are active. */
export async function setLanguage(lang: Language): Promise<void> {
  await i18nInstance.changeLanguage(lang);
}

export default i18nInstance;
