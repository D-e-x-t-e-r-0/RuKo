import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clearAll } from '../db';
import { seed } from '../seed/seed';
import { BigButton } from '../components/BigButton';
import { LANGUAGES, changeAppLanguage, normalizeLang } from '../i18n';
import { isAIEnabled, setAIEnabled } from '../ai/ai';
import { getVoiceMode, setVoiceMode, type VoiceMode } from '../lib/sarvam';

export const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [aiOn, setAiOn] = useState(() => isAIEnabled());
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(() => getVoiceMode());
  const currentLang = normalizeLang(i18n.language);

  const toggleLanguage = (lang: string) => {
    changeAppLanguage(lang);
  };

  const pickVoice = (mode: VoiceMode) => {
    setVoiceMode(mode);
    setVoiceModeState(mode);
  };

  const handleLoadDemo = async () => {
    try {
      await seed();
      setStatusMessage(t('settings.demo_loaded'));
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Failed to load demo data:', err);
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm(t('settings.delete_confirm'))) {
      await clearAll();
      setStatusMessage(t('settings.data_cleared'));
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-20 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-cream">
          {t('settings.title')}
        </h1>
      </header>

      {statusMessage && (
        <div className="p-3 bg-rukoGreen/20 border border-rukoGreen/60 rounded-xl text-sm font-semibold text-cream text-center">
          {statusMessage}
        </div>
      )}

      {/* Language Grid — all 12 supported languages */}
      <section className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3">
        <h2 className="text-xs uppercase font-bold text-saffron tracking-wider">
          {t('settings.language')}
        </h2>
        <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={t('settings.language')}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => toggleLanguage(l.code)}
              aria-pressed={currentLang === l.code}
              className={`min-h-[48px] py-2 px-3 rounded-xl font-bold text-sm transition-all ${
                currentLang === l.code
                  ? 'bg-saffron text-night shadow-diya'
                  : 'bg-slate-900 text-slate-300 border border-slate-700'
              }`}
            >
              <span className="block leading-tight">{l.nativeName}</span>
              <span className="block text-[10px] font-semibold opacity-70">{l.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Voice engine — Sarvam AI with device fallback */}
      <section className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div>
          <h2 className="text-xs uppercase font-bold text-saffron tracking-wider">
            {t('settings.voice_title')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('settings.voice_desc')}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2" role="group" aria-label={t('settings.voice_title')}>
          {(
            [
              ['auto', t('settings.voice_auto')],
              ['sarvam', t('settings.voice_sarvam')],
              ['device', t('settings.voice_device')],
            ] as [VoiceMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => pickVoice(mode)}
              aria-pressed={voiceMode === mode}
              className={`min-h-[48px] py-2 px-4 rounded-xl font-bold text-sm text-left transition-all ${
                voiceMode === mode
                  ? 'bg-saffron text-night shadow-diya'
                  : 'bg-slate-900 text-slate-300 border border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Smart Reflection (AI) Toggle */}
      <section className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-cream flex items-center space-x-1.5">
              <span>✨</span>
              <span>{t('settings.ai_toggle_title')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('settings.ai_toggle_desc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !aiOn;
              setAIEnabled(next);
              setAiOn(next);
            }}
            className={`min-h-[36px] px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              aiOn
                ? 'bg-saffron text-navy shadow-md'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {aiOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </section>

      {/* Demo Data & Reset */}
      <section className="space-y-3">
        <BigButton
          variant="secondary"
          onClick={handleLoadDemo}
        >
          {t('settings.demo_data')}
        </BigButton>

        <BigButton
          variant="danger"
          onClick={handleDeleteAll}
        >
          {t('settings.delete_data')}
        </BigButton>
      </section>

      {/* Privacy Guarantee Note */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
        <p className="text-xs text-slate-400 font-medium">
          🔒 {t('settings.privacy_note')}
        </p>
      </div>
    </div>
  );
};
