import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../i18n';

export const Header: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language.startsWith('hi') ? 'hi' : 'en';

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 max-w-md mx-auto h-16 px-4 flex items-center justify-between">
      <Link
        to="/"
        className="flex items-center space-x-2.5 text-navy font-ritual font-black text-xl tracking-tight hover:opacity-90 transition-opacity min-h-[48px]"
        aria-label="Ruko home"
      >
        <span className="relative w-9 h-9 rounded-full bg-gradient-to-b from-saffron to-ember text-night flex items-center justify-center text-base font-black shadow-neu-btn">
          <span className="animate-flicker">रु</span>
        </span>
        <span>रुको <span className="text-slate-500 font-sans font-bold text-sm tracking-wide">· RUKO</span></span>
      </Link>

      <div
        className="flex items-center bg-stone-100 border border-slate-200 rounded-full p-1 text-xs font-bold"
        role="group"
        aria-label="Language"
      >
        {/* Header exception to the 48px rule: 40px keeps the 64px bar from
            overflowing on 360px phones; still exceeds the 24px WCAG minimum. */}
        <button
          type="button"
          onClick={() => changeAppLanguage('hi')}
          aria-pressed={currentLang === 'hi'}
          className={`min-h-[40px] min-w-[40px] px-3 py-1 rounded-full transition-all ${
            currentLang === 'hi'
              ? 'bg-navy text-white'
              : 'text-slate-500 hover:text-navy'
          }`}
          aria-label="Hindi language"
        >
          हि
        </button>
        <span className="text-slate-600 px-0.5 select-none" aria-hidden="true">|</span>
        <button
          type="button"
          onClick={() => changeAppLanguage('en')}
          aria-pressed={currentLang === 'en'}
          className={`min-h-[40px] min-w-[40px] px-3 py-1 rounded-full transition-all ${
            currentLang === 'en'
              ? 'bg-navy text-white'
              : 'text-slate-500 hover:text-navy'
          }`}
          aria-label="English language"
        >
          EN
        </button>
      </div>
    </header>
  );
};
