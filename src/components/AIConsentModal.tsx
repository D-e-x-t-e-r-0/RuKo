import React from 'react';
import { useTranslation } from 'react-i18next';
import { setAIEnabled } from '../ai/ai';

interface AIConsentModalProps {
  onComplete: () => void;
}

export const AIConsentModal: React.FC<AIConsentModalProps> = ({ onComplete }) => {
  const { t } = useTranslation();

  const handleChoice = (enable: boolean) => {
    setAIEnabled(enable);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[90] bg-navy/95 backdrop-blur-sm flex items-center justify-center p-4 max-w-md mx-auto">
      <div className="bg-slate-800 border-2 border-saffron/60 rounded-3xl p-6 shadow-2xl space-y-5 text-cream w-full animate-fade-in">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-saffron/20 border border-saffron/40 text-saffron text-xs font-bold uppercase tracking-wider">
            <span>✨</span>
            <span>AI</span>
          </div>
          <h2 className="text-xl font-black text-cream">
            {t('ai_consent.title')}
          </h2>
        </div>

        <div className="text-xs text-slate-300 space-y-2.5 leading-relaxed bg-slate-900/80 p-4 rounded-2xl border border-slate-700/60">
          <p className="font-semibold text-slate-200">
            {t('ai_consent.subtitle')}
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300">
            <li>{t('ai_consent.item_why')}</li>
            <li>{t('ai_consent.item_signals')}</li>
            <li>{t('ai_consent.item_lang')}</li>
          </ul>
          <p className="text-[11px] text-rukoGreen font-bold pt-1 border-t border-slate-800">
            {t('ai_consent.privacy_note')}
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => handleChoice(true)}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-saffron text-navy font-black text-base hover:bg-[#e09430] active:scale-95 transition-all shadow-md"
          >
            {t('ai_consent.btn_turn_on')}
          </button>
          <button
            type="button"
            onClick={() => handleChoice(false)}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-slate-700/80 text-slate-300 font-bold text-sm hover:bg-slate-700 hover:text-cream active:scale-95 transition-all"
          >
            {t('ai_consent.btn_not_now')}
          </button>
        </div>
      </div>
    </div>
  );
};
