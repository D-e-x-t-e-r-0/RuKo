import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
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
  speechCode: string;
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

const SARVAM_TTS_FALLBACK: Record<string, string> = { 'as-IN': 'bn-IN' };

export function getSarvamTtsCode(speechCode: string): string {
  return SARVAM_TTS_FALLBACK[speechCode] ?? speechCode;
}

export function normalizeLang(lang?: string | null): string {
  const current = String(lang || i18n.language || 'hi').toLowerCase();
  const match = LANGUAGES.find(
    l => current === l.code || current.startsWith(l.code + '-') || current.startsWith(l.code)
  );
  return match ? match.code : 'hi';
}

export function getSpeechCode(lang?: string | null): string {
  const code = normalizeLang(lang);
  return LANGUAGES.find(l => l.code === code)?.speechCode ?? 'hi-IN';
}

export function getSarvamCode(lang?: string | null): string {
  const code = normalizeLang(lang);
  return LANGUAGES.find(l => l.code === code)?.sarvamCode ?? 'hi-IN';
}

const LANG_KEY = 'ruko.lang';

export async function changeAppLanguage(lang: string): Promise<void> {
  const code = normalizeLang(lang);
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANG_KEY, code);
  } catch (_) {}
}

export async function loadStoredLanguage(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    if (saved) return normalizeLang(saved);
  } catch (_) {}
  try {
    const locales = Localization.getLocales();
    const tag = locales?.[0]?.languageTag || locales?.[0]?.languageCode;
    if (tag) {
      const code = normalizeLang(tag);
      if (LANGUAGES.some(l => l.code === code) && code !== 'hi') return code;
    }
  } catch (_) {}
  return 'hi';
}

i18n.use(initReactI18next).init({
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
  lng: 'hi',
  fallbackLng: ['en', 'hi'],
  interpolation: { escapeValue: false },
});

export default i18n;
