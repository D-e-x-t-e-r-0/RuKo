import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import hi from './hi.json';
import en from './en.json';
import bn from './bn.json';
import mr from './mr.json';
import ta from './ta.json';
import te from './te.json';
import kn from './kn.json';
import ml from './ml.json';
import gu from './gu.json';
import pa from './pa.json';
import or from './or.json';
import as from './as.json';

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  /** BCP-47 speech tag for Web Speech + Sarvam voices */
  speechCode: string;
  /** Sarvam API language code (STT/translate). TTS lacks as-IN — falls back per SPEECH_FALLBACK. */
  sarvamCode: string;
}

export const LANGUAGES: LanguageConfig[] = [
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechCode: 'hi-IN', sarvamCode: 'hi-IN' },
  { code: 'en', name: 'English', nativeName: 'English', speechCode: 'en-IN', sarvamCode: 'en-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', speechCode: 'bn-IN', sarvamCode: 'bn-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', speechCode: 'mr-IN', sarvamCode: 'mr-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', speechCode: 'ta-IN', sarvamCode: 'ta-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', speechCode: 'te-IN', sarvamCode: 'te-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speechCode: 'kn-IN', sarvamCode: 'kn-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', speechCode: 'ml-IN', sarvamCode: 'ml-IN' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', speechCode: 'gu-IN', sarvamCode: 'gu-IN' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speechCode: 'pa-IN', sarvamCode: 'pa-IN' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speechCode: 'or-IN', sarvamCode: 'od-IN' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', speechCode: 'as-IN', sarvamCode: 'as-IN' },
];

/** Sarvam TTS (bulbul) does not serve every code — map to the closest voice. */
const SARVAM_TTS_FALLBACK: Record<string, string> = {
  'as-IN': 'bn-IN',
};

export function getSarvamTtsCode(speechCode: string): string {
  return SARVAM_TTS_FALLBACK[speechCode] ?? speechCode;
}

export function normalizeLang(lang?: string): string {
  const current = (lang || i18n.language || 'hi').toLowerCase();
  const match = LANGUAGES.find(l => current === l.code || current.startsWith(l.code + '-') || current.startsWith(l.code));
  return match ? match.code : 'hi';
}

export function getSpeechCode(lang?: string): string {
  const code = normalizeLang(lang);
  return LANGUAGES.find(l => l.code === code)?.speechCode ?? 'hi-IN';
}

export function getSarvamCode(lang?: string): string {
  const code = normalizeLang(lang);
  return LANGUAGES.find(l => l.code === code)?.sarvamCode ?? 'hi-IN';
}

function readStoredLang(): string | null {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return null;
    }
    return localStorage.getItem('ruko.lang') || localStorage.getItem('ruko_lang');
  } catch (_) {
    return null;
  }
}

function writeStoredLang(code: string): void {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return;
    localStorage.setItem('ruko.lang', code);
    localStorage.setItem('ruko_lang', code);
  } catch (_) {}
}

export function changeAppLanguage(lang: string): void {
  const code = normalizeLang(lang);
  i18n.changeLanguage(code);
  writeStoredLang(code);
  try {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code;
    }
  } catch (_) {}
}

const savedLang = readStoredLang() || 'hi';

if (typeof document !== 'undefined') {
  document.documentElement.lang = normalizeLang(savedLang);
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      hi: { translation: hi },
      en: { translation: en },
      bn: { translation: bn },
      mr: { translation: mr },
      ta: { translation: ta },
      te: { translation: te },
      kn: { translation: kn },
      ml: { translation: ml },
      gu: { translation: gu },
      pa: { translation: pa },
      or: { translation: or },
      as: { translation: as },
    },
    lng: normalizeLang(savedLang),
    fallbackLng: ['en', 'hi'],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
