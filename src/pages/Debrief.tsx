import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../db';
import type { PracticeSession } from '../types';
import { askAI } from '../ai/ai';
import { getFallbackSummary } from '../ai/fallback';
import { AIBadge } from '../components/AIBadge';
import { BigButton } from '../components/BigButton';
import { MicButton } from '../components/MicButton';

export const Debrief: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionIdParam = searchParams.get('id');
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // AI Summary state
  const [summaryText, setSummaryText] = useState<string>('');
  const [isAISummary, setIsAISummary] = useState<boolean>(false);

  // Self reflection state
  const [selfReflection, setSelfReflection] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    async function loadSession() {
      if (!sessionIdParam) {
        setLoading(false);
        return;
      }

      const id = parseInt(sessionIdParam, 10);
      if (isNaN(id)) {
        setLoading(false);
        return;
      }

      const s = await db.sessions.get(id);
      if (s) {
        setSession(s);
        if (s.selfReflection) {
          setSelfReflection(s.selfReflection);
          setIsSaved(true);
        }

        const lang = i18n.language.startsWith('hi') ? 'hi' : 'en';
        const tradesOpened = s.tradesOpened ?? 0;
        const payload = {
          context: 'practice',
          pauses: s.pausesTaken ?? 0,
          abandoned: s.abandonedOrDelayed ?? 0,
          delayed: 0,
          proceeded: Math.max(0, tradesOpened - (s.abandonedOrDelayed ?? 0)),
          impulsivePercent: tradesOpened > 0 ? Math.round(((s.tradesAfterLoss ?? 0) / tradesOpened) * 100) : 0,
          regretCount: 0,
          calmCount: 0,
          practice: {
            tradesAfterLoss: s.tradesAfterLoss ?? 0,
            sizeIncreasePercent: s.sizeIncreasePercent ?? 0,
            maxDrawdownPercent: s.maxDrawdownPercent ?? 0,
          },
        };

        askAI<{ summary: string }>('summary', lang, payload)
          .then(aiRes => {
            if (aiRes && aiRes.summary) {
              setSummaryText(aiRes.summary);
              setIsAISummary(true);
            } else {
              setSummaryText(getFallbackSummary(payload, lang));
              setIsAISummary(false);
            }
          })
          .catch(() => {
            setSummaryText(getFallbackSummary(payload, lang));
            setIsAISummary(false);
          });
      }
      setLoading(false);
    }

    loadSession();
  }, [sessionIdParam, i18n.language]);

  const handleSaveNote = async () => {
    if (!session || !session.id) return;
    await db.sessions.update(session.id, {
      selfReflection,
    });
    setIsSaved(true);
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 text-center text-slate-400">
        Loading...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto p-4 text-center space-y-4">
        <p className="text-slate-400">Session not found.</p>
        <BigButton variant="secondary" onClick={() => navigate('/practice')}>
          {t('debrief.practice_again')}
        </BigButton>
      </div>
    );
  }

  const pnl = session.finalPnl ?? 0;
  const pnlSign = pnl >= 0 ? '+' : '-';
  const pnlFormatted = `${pnlSign}₹${Math.abs(pnl).toLocaleString('en-IN')}`;

  return (
    <div className="max-w-md mx-auto p-4 pb-20 space-y-6">
      <header className="space-y-1">
        <h1 className="font-ritual text-3xl font-black text-cream">
          {t('debrief.title')}
        </h1>
        <p className="text-xs text-saffron uppercase font-bold tracking-[0.16em]">
          {t(`practice.scenarios.${session.scenario}_title`, session.scenario)}
        </p>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
          <div className="text-xs text-slate-400">{t('debrief.final_pnl')}</div>
          <div className="text-lg font-bold font-mono text-cream mt-0.5">
            {pnlFormatted}
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
          <div className="text-xs text-slate-400">{t('debrief.max_drawdown')}</div>
          <div className="text-lg font-bold font-mono text-cream mt-0.5">
            {session.maxDrawdownPercent ?? 0}%
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
          <div className="text-xs text-slate-400">{t('debrief.trades_opened')}</div>
          <div className="text-lg font-bold font-mono text-cream mt-0.5">
            {session.tradesOpened ?? 0}
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
          <div className="text-xs text-slate-400">{t('debrief.quick_reentry')}</div>
          <div className="text-lg font-bold font-mono text-cream mt-0.5">
            {session.tradesAfterLoss ?? 0}
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
          <div className="text-xs text-slate-400">{t('debrief.size_change')}</div>
          <div className="text-lg font-bold font-mono text-cream mt-0.5">
            {session.sizeIncreasePercent ?? 0}%
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
          <div className="text-xs text-slate-400">{t('debrief.pauses_taken')}</div>
          <div className="text-lg font-bold font-mono text-cream mt-0.5">
            {session.pausesTaken ?? 0}
          </div>
        </div>
      </div>

      {/* Observed Pressure Signals */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {t('debrief.signals_observed')}
        </div>
        {session.observedSignals && session.observedSignals.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {session.observedSignals.map(sig => (
              <span
                key={sig}
                className="bg-amber-950/60 border border-saffron/40 text-saffron text-xs font-semibold px-2.5 py-1 rounded-lg"
              >
                {t(`signal_names.${sig}`, sig)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 pt-1">
            {t('debrief.none_observed')}
          </p>
        )}
      </div>

      {/* AI or Fallback Summary Card */}
      {summaryText && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-cream">
              {t('debrief.ai_summary_title')}
            </h3>
            <AIBadge isAI={isAISummary} />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {summaryText}
          </p>
        </div>
      )}

      {/* Self-reflection Note (text or voice) */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-3">
        <label className="block text-sm font-bold text-cream">
          {t('debrief.self_reflection_prompt')}
        </label>
        <div className="relative">
          <textarea
            value={selfReflection}
            onChange={e => {
              setSelfReflection(e.target.value);
              setIsSaved(false);
            }}
            placeholder={t('debrief.self_reflection_placeholder')}
            rows={3}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pr-12 text-xs text-cream placeholder-slate-500 focus:outline-none focus:border-saffron"
          />
          <div className="absolute right-2 bottom-3">
            <MicButton
              onTranscript={text => {
                setSelfReflection(prev => (prev ? `${prev} ${text}` : text));
                setIsSaved(false);
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={!selfReflection.trim() || isSaved}
            className="px-4 py-2 bg-saffron text-navy font-bold text-xs rounded-xl disabled:opacity-50"
          >
            {isSaved ? t('debrief.note_saved') : t('debrief.save_note')}
          </button>
        </div>
      </div>

      {/* Closing Disclaimer Banner */}
      <div className="bg-amber-950/40 border border-saffron/40 text-saffron p-3.5 rounded-2xl text-xs font-medium text-center leading-relaxed">
        {t('debrief.closing_disclaimer')}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2">
        <BigButton variant="primary" onClick={() => navigate('/practice')}>
          {t('debrief.practice_again')}
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          {t('debrief.back_home')}
        </BigButton>
      </div>
    </div>
  );
};
