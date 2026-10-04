import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import hi from './hi.json';
import en from './en.json';

export interface LanguageConfig {
  code: string;
  name: string;
  speechCode: 'hi-IN' | 'en-IN' | string;
}

export const LANGUAGES: LanguageConfig[] = [
  { code: 'hi', name: 'हिन्दी', speechCode: 'hi-IN' },
  { code: 'en', name: 'English', speechCode: 'en-IN' },
];

export function getSpeechCode(lang?: string): 'hi-IN' | 'en-IN' {
  const current = lang || i18n.language || 'hi';
  const match = LANGUAGES.find(l => current.startsWith(l.code));
  return (match ? match.speechCode : 'hi-IN') as 'hi-IN' | 'en-IN';
}

export function changeAppLanguage(lang: string): void {
  i18n.changeLanguage(lang);
  try {
    localStorage.setItem('ruko.lang', lang);
    localStorage.setItem('ruko_lang', lang);
  } catch (_) {}
}

const savedLang =
  (typeof localStorage !== 'undefined' &&
    (localStorage.getItem('ruko.lang') || localStorage.getItem('ruko_lang'))) ||
  'hi';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      hi: { translation: hi },
      en: { translation: en },
    },
    lng: savedLang,
    fallbackLng: 'hi',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
