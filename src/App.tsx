import React, { useState } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from './components/Header';
import { LanguagePicker } from './components/LanguagePicker';
import { AIConsentModal } from './components/AIConsentModal';
import { Home } from './pages/Home';
import { Pause } from './pages/Pause';
import { Practice } from './pages/Practice';
import { Debrief } from './pages/Debrief';
import { Journal } from './pages/Journal';
import { Mirror } from './pages/Mirror';
import { Trades } from './pages/Trades';
import { Rules } from './pages/Rules';
import { Settings } from './pages/Settings';

const MoreMenu: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-cream mb-6">
        {t('nav.more')}
      </h1>
      <div className="space-y-3">
        <Link
          to="/trades"
          className="flex items-center justify-between min-h-[52px] p-4 bg-slate-800/90 border border-slate-700 hover:border-saffron rounded-2xl text-cream font-bold text-base transition-colors shadow-sm"
        >
          <span>{t('trades.title')}</span>
          <span className="text-slate-400">→</span>
        </Link>
        <Link
          to="/rules"
          className="flex items-center justify-between min-h-[52px] p-4 bg-slate-800/90 border border-slate-700 hover:border-saffron rounded-2xl text-cream font-bold text-base transition-colors shadow-sm"
        >
          <span>{t('rules.title')}</span>
          <span className="text-slate-400">→</span>
        </Link>
        <Link
          to="/settings"
          className="flex items-center justify-between min-h-[52px] p-4 bg-slate-800/90 border border-slate-700 hover:border-saffron rounded-2xl text-cream font-bold text-base transition-colors shadow-sm"
        >
          <span>{t('settings.title')}</span>
          <span className="text-slate-400">→</span>
        </Link>
      </div>
    </div>
  );
};

const NavigationBar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  // Hide bottom bar during active pause flow
  if (location.pathname === '/pause') {
    return null;
  }

  const isMoreActive =
    location.pathname === '/more' ||
    location.pathname === '/trades' ||
    location.pathname === '/rules' ||
    location.pathname === '/settings';

  return (
    <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E162E]/92 backdrop-blur-md border-t border-saffron/15 max-w-md mx-auto">
      <div className="grid grid-cols-5 h-16 items-center px-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] text-xs font-bold transition-colors select-none ${
              isActive ? 'text-saffron' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          {t('nav.home')}
        </NavLink>

        <NavLink
          to="/practice"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] text-xs font-bold transition-colors select-none ${
              isActive ? 'text-saffron' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          {t('nav.practice')}
        </NavLink>

        <NavLink
          to="/journal"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] text-xs font-bold transition-colors select-none ${
              isActive ? 'text-saffron' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          {t('nav.journal')}
        </NavLink>

        <NavLink
          to="/mirror"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center h-full min-h-[48px] text-xs font-bold transition-colors select-none ${
              isActive ? 'text-saffron' : 'text-slate-400 hover:text-slate-200'
            }`
          }
        >
          {t('nav.mirror')}
        </NavLink>

        <NavLink
          to="/more"
          className={`flex flex-col items-center justify-center h-full min-h-[48px] text-xs font-bold transition-colors select-none ${
            isMoreActive ? 'text-saffron' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('nav.more')}
        </NavLink>
      </div>
    </nav>
  );
};

export const App: React.FC = () => {
  const [hasLang, setHasLang] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('ruko.lang'));
  });

  const [aiModalDismissed, setAiModalDismissed] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('ruko.ai') !== null;
  });

  return (
    <>
      {!hasLang && <LanguagePicker onSelect={() => setHasLang(true)} />}
      {hasLang && !aiModalDismissed && (
        <AIConsentModal onComplete={() => setAiModalDismissed(true)} />
      )}
      <HashRouter>
        <div className="min-h-screen bg-navy text-slate-100 flex flex-col justify-between">
          <Header />
          <main className="flex-1 w-full max-w-md mx-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/pause" element={<Pause />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/debrief" element={<Debrief />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/mirror" element={<Mirror />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/more" element={<MoreMenu />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
          <NavigationBar />
        </div>
      </HashRouter>
    </>
  );
};

export default App;
