import { describe, it, expect } from 'vitest';
import en from './en.json';
import hi from './hi.json';
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
import { LANGUAGES, normalizeLang, getSpeechCode, getSarvamCode, getSarvamTtsCode } from './index';

const LOCALES: Record<string, unknown> = { en, hi, bn, mr, ta, te, kn, ml, gu, pa, or, as };

function leafKeys(o: unknown, prefix = ''): string[] {
  if (typeof o !== 'object' || o === null) return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}/${k}` : k)
  );
}

function leafValues(o: unknown): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      out.push({ path, value: node });
    } else if (typeof node === 'object' && node !== null) {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, path ? `${path}/${k}` : k);
      }
    }
  };
  walk(o, '');
  return out;
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map(m => m[1]).sort().join(',');

describe('Multilingual locale coverage (12 languages)', () => {
  it('registers exactly the 12 supported app languages', () => {
    expect(LANGUAGES.map(l => l.code).sort()).toEqual(
      ['as', 'bn', 'en', 'gu', 'hi', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'].sort()
    );
  });

  it('every locale has the same leaf keys as en (no missing/extra)', () => {
    const enKeys = new Set(leafKeys(en));
    for (const [code, locale] of Object.entries(LOCALES)) {
      const ks = leafKeys(locale);
      const missing = ks.length === 0 ? ['<empty>'] : [...enKeys].filter(k => !new Set(ks).has(k));
      const extra = ks.filter(k => !enKeys.has(k));
      expect(missing, `${code} missing keys`).toEqual([]);
      expect(extra, `${code} extra keys`).toEqual([]);
    }
  });

  it('no leaf string is empty in any locale', () => {
    for (const [code, locale] of Object.entries(LOCALES)) {
      for (const { path, value } of leafValues(locale)) {
        expect(value.trim().length, `${code}:${path}`).toBeGreaterThan(0);
      }
    }
  });

  it('interpolation placeholders match en in every locale', () => {
    const enMap = new Map(leafValues(en).map(({ path, value }) => [path, placeholders(value)]));
    for (const [code, locale] of Object.entries(LOCALES)) {
      if (code === 'en') continue;
      for (const { path, value } of leafValues(locale)) {
        expect(placeholders(value), `${code}:${path}`).toBe(enMap.get(path));
      }
    }
  });
});

describe('Language helpers', () => {
  it('normalizes BCP-47 tags to app codes with hi fallback', () => {
    expect(normalizeLang('bn-IN')).toBe('bn');
    expect(normalizeLang('ta')).toBe('ta');
    expect(normalizeLang('xx')).toBe('hi');
    expect(normalizeLang(undefined)).toBe('hi');
  });

  it('maps app codes to speech + Sarvam codes (Odia uses od-IN upstream)', () => {
    expect(getSpeechCode('or')).toBe('or-IN');
    expect(getSarvamCode('or')).toBe('od-IN');
    expect(getSarvamCode('pa')).toBe('pa-IN');
  });

  it('falls back Assamese TTS to the closest Sarvam voice', () => {
    expect(getSarvamTtsCode('as-IN')).toBe('bn-IN');
    expect(getSarvamTtsCode('hi-IN')).toBe('hi-IN');
  });
});
