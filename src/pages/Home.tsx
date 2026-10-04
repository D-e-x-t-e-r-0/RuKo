import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../db';
import { getRandomSnippet, type Snippet } from '../engine/snippets';

export const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [todayPauses, setTodayPauses] = useState(0);
  const [todaySaved, setTodaySaved] = useState(0);
  const [hasPendingReflection, setHasPendingReflection] = useState(false);
  const [thought] = useState<Snippet>(() => getRandomSnippet());

  const getGreetingKey = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'home.greeting_morning';
    if (hour >= 12 && hour < 17) return 'home.greeting_afternoon';
    if (hour >= 17 && hour < 22) return 'home.greeting_evening';
    return 'home.greeting_night';
  };

  useEffect(() => {
    async function loadStats() {
      try {
        const all = await db.decisions.toArray();
      const now = new Date();
      const isToday = (ts: number) => {
        const d = new Date(ts);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      };

      const todayDecisions = all.filter(d => isToday(d.ts));
      setTodayPauses(todayDecisions.length);
      setTodaySaved(
        todayDecisions.filter(d => d.outcome === 'abandoned' || d.outcome === 'delayed').length
      );

      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
      const unreviewed = all.some(
        d => !d.reflection && !d.feeling && d.ts <= sixHoursAgo
      );
      setHasPendingReflection(unreviewed);
      } catch (_) {
        setTodayPauses(0);
        setTodaySaved(0);
        setHasPendingReflection(false);
      }
    }

    loadStats();
  }, []);

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-140px)] max-w-md mx-auto p-4 pb-24 space-y-6">
      {/* Header & Time-Aware Greeting */}
      <header className="text-center pt-3 space-y-2 w-full rise">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-abyss/70 border border-saffron/25 text-xs font-semibold text-saffron">
          <span className="w-1.5 h-1.5 rounded-full bg-saffron animate-glow-pulse" aria-hidden="true" />
          {t(getGreetingKey())}
        </div>
        <h1 className="font-ritual text-5xl font-black tracking-tight text-cream leading-none">
          {t('app_name')}
        </h1>
        <div className="jaali-line w-40 mx-auto" aria-hidden="true" />
        <p className="text-sm text-slate-300 font-medium">
          {t('app_tagline')}
        </p>
      </header>

      {/* Main Pause Action */}
      <div className="w-full my-auto flex flex-col items-center py-4 rise rise-1">
        <div className="w-full max-w-xs aspect-square flex items-center justify-center p-2">
          <button
            onClick={() => navigate('/pause')}
            className="diya-ring group relative w-56 h-56 rounded-full bg-gradient-to-b from-saffron via-saffron to-ember text-night font-black text-4xl hover:scale-105 active:scale-95 transition-all duration-200 border-8 border-saffron/20 flex flex-col items-center justify-center space-y-1"
            aria-label={t('home.pause_button')}
          >
            <span className="font-ritual tracking-tight">{t('home.pause_button')}</span>
            <span className="text-[11px] font-sans font-semibold tracking-[0.18em] uppercase opacity-80">
              {t('home.tap_before_trading')}
            </span>
          </button>
        </div>
      </div>

      {/* Thought for Today */}
      <div className="paper-card w-full border border-slate-700/70 rounded-3xl p-5 shadow-card space-y-2 rise rise-2">
        <div className="flex items-center space-x-2 text-saffron text-[11px] uppercase font-bold tracking-[0.16em]">
          <span aria-hidden="true">🪔</span>
          <span>{t('home.thought_for_today')}</span>
        </div>
        <p className="font-ritual text-lg italic font-medium text-cream leading-relaxed">
          "{t(`snippets.${thought.key}`)}"
        </p>
        {thought.sourceKey && (
          <p className="text-xs text-slate-400 font-sans">
            — {t(`snippets.${thought.sourceKey}`)}
          </p>
        )}
      </div>

      {/* Info & Reflection Section */}
      <div className="w-full space-y-4 rise rise-3">
        {/* Pending Reflection Alert */}
        {hasPendingReflection && (
          <div className="bg-amber-950/40 border border-saffron/60 rounded-2xl p-4 shadow-sm">
            <h3 className="text-base font-bold text-saffron">
              {t('home.pending_reflection_title')}
            </h3>
            <p className="text-sm text-cream/90 mt-1">
              {t('home.pending_reflection_desc')}
            </p>
            <div className="mt-3">
              <button
                onClick={() => navigate('/journal')}
                className="w-full min-h-[48px] py-2 px-4 rounded-xl bg-saffron text-navy font-bold text-sm hover:bg-[#e09430]"
              >
                {t('home.review_now')}
              </button>
            </div>
          </div>
        )}

        {/* Today's Counts */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-md">
          <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3">
            {t('home.today_stats_title')}
          </h2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-900/60 rounded-xl p-3">
              <div className="text-2xl font-bold text-cream">{todayPauses}</div>
              <div className="text-xs text-slate-400 mt-1">{t('home.today_pauses')}</div>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3">
              <div className="text-2xl font-bold text-rukoGreen">{todaySaved}</div>
              <div className="text-xs text-slate-400 mt-1">{t('home.today_saved')}</div>
            </div>
          </div>
        </div>

        {/* Practice Mode Promo Card */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-cream">
              {t('home.try_practice_title')}
            </h3>
            <p className="text-xs text-slate-400">
              {t('home.try_practice_desc')}
            </p>
          </div>
          <button
            onClick={() => navigate('/practice')}
            className="py-2.5 px-4 rounded-xl bg-saffron text-navy font-bold text-xs hover:bg-[#e09430] whitespace-nowrap ml-3"
          >
            {t('home.try_practice_btn')}
          </button>
        </div>
      </div>
    </div>
  );
};
