import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../i18n';

export const Header: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language.startsWith('hi') ? 'hi' : 'en';

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-[#14213D]/95 backdrop-blur border-b border-slate-800 max-w-md mx-auto h-14 px-4 flex items-center justify-between">
      <Link
        to="/"
        className="flex items-center space-x-2 text-saffron font-black text-xl tracking-tight hover:opacity-90 transition-opacity"
      >
        <span className="w-7 h-7 rounded-full bg-saffron text-navy flex items-center justify-center text-sm font-black">
          रु
        </span>
        <span>रुको · Ruko</span>
      </Link>

      <div className="flex items-center bg-slate-900 border border-slate-700 rounded-full p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => changeAppLanguage('hi')}
          className={`min-h-[32px] px-2.5 py-1 rounded-full transition-all ${
            currentLang === 'hi'
              ? 'bg-saffron text-navy shadow-sm'
              : 'text-slate-400 hover:text-cream'
          }`}
          aria-label="Hindi language"
        >
          हि
        </button>
        <span className="text-slate-600 px-0.5 select-none">|</span>
        <button
          type="button"
          onClick={() => changeAppLanguage('en')}
          className={`min-h-[32px] px-2.5 py-1 rounded-full transition-all ${
            currentLang === 'en'
              ? 'bg-saffron text-navy shadow-sm'
              : 'text-slate-400 hover:text-cream'
          }`}
          aria-label="English language"
        >
          EN
        </button>
      </div>
    </header>
  );
};
