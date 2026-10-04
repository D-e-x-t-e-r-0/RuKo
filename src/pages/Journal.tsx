import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { db } from '../db';
import type { Decision, PracticeSession } from '../types';

export const Journal: React.FC = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'real' | 'practice'>('real');
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [selectedFeeling, setSelectedFeeling] = useState<Record<number, 'calm' | 'regret' | 'unsure'>>({});
  const [reflectionTexts, setReflectionTexts] = useState<Record<number, string>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  const loadDecisions = async () => {
    try {
      const all = await db.decisions.toArray();
      all.sort((a, b) => b.ts - a.ts);
      setDecisions(all);

      const allSessions = await db.sessions.toArray();
      allSessions.sort((a, b) => b.startedAt - a.startedAt);
      setSessions(allSessions);
    } catch (_) {
      setDecisions([]);
      setSessions([]);
    }
  };

  useEffect(() => {
    loadDecisions();
  }, []);

  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const realDecisions = decisions.filter(d => d.mode !== 'practice');
  const weekDecisions = realDecisions.filter(d => d.ts >= oneWeekAgo);
  const nPauses = weekDecisions.length;
  const kAbandonedDelayed = weekDecisions.filter(
    d => d.outcome === 'abandoned' || d.outcome === 'delayed'
  ).length;

  const displayedDecisions = decisions.filter(d =>
    filter === 'practice' ? d.mode === 'practice' : d.mode !== 'practice'
  );

  const handleSaveReflection = async (id: number) => {
    const feeling = selectedFeeling[id];
    const text = reflectionTexts[id] || '';
    if (!feeling && !text.trim()) return;

    await db.decisions.update(id, {
      feeling: feeling || 'unsure',
      reflection: text.trim() || undefined,
    });

    await loadDecisions();
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-20 space-y-5">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-cream">
          {t('journal.title')}
        </h1>
        {/* Segmented Filter */}
        <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700">
          <button
            type="button"
            onClick={() => setFilter('real')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              filter === 'real'
                ? 'bg-saffron text-navy shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('journal.filter_real')}
          </button>
          <button
            type="button"
            onClick={() => setFilter('practice')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              filter === 'practice'
                ? 'bg-saffron text-navy shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('journal.filter_practice')}
          </button>
        </div>

        {/* Weekly Summary (Real mode only) */}
        {filter === 'real' && (
          <p className="text-sm font-medium text-saffron bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            {t('journal.summary', { n: nPauses, k: kAbandonedDelayed })}
          </p>
        )}
      </header>

      {/* Practice Sessions (in practice mode) */}
      {filter === 'practice' && sessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-cream">
            {t('journal.practice_sessions_title')}
          </h2>
          <div className="space-y-2.5">
            {sessions.map(s => {
              const pnl = s.finalPnl ?? 0;
              const pnlSign = pnl >= 0 ? '+' : '-';
              return (
                <div
                  key={s.id}
                  className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 space-y-2 shadow-md"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cream uppercase tracking-wider">
                      {t(`practice.scenarios.${s.scenario}_title`, s.scenario)}
                    </span>
                    <span className="text-slate-400">
                      {format(new Date(s.startedAt), 'dd MMM yyyy, hh:mm a')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-400 block text-[10px]">P&L</span>
                      <span className="font-mono font-bold text-cream">
                        {pnlSign}₹{Math.abs(pnl).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Drawdown</span>
                      <span className="font-mono font-bold text-cream">
                        {s.maxDrawdownPercent ?? 0}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">{t('journal.pauses_label')}</span>
                      <span className="font-mono font-bold text-cream">
                        {s.pausesTaken ?? 0}
                      </span>
                    </div>
                  </div>
                  {s.selfReflection && (
                    <p className="text-xs italic text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                      "{s.selfReflection}"
                    </p>
                  )}
                  <div className="pt-1">
                    <Link
                      to={`/debrief?id=${s.id}`}
                      className="inline-flex items-center min-h-[48px] px-2 -ml-2 text-xs font-bold text-saffron hover:underline"
                    >
                      {t('journal.view_debrief')}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Decisions List */}
      <div className="space-y-4">
        {displayedDecisions.length === 0 && (filter === 'real' || sessions.length === 0) ? (
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 text-center space-y-3 shadow-md">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-700/60 flex items-center justify-center text-saffron text-2xl">
              📖
            </div>
            <h3 className="text-base font-bold text-cream">
              {t('journal.empty_title')}
            </h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              {t('journal.empty_desc')}
            </p>
          </div>
        ) : (
          displayedDecisions.map(d => {
            const isOlderThan6h = now - d.ts >= 6 * 60 * 60 * 1000;
            const needsReflection = !d.reflection && !d.feeling && isOlderThan6h;
            const currentFeeling = selectedFeeling[d.id!];

            return (
              <div
                key={d.id}
                className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 space-y-3 shadow-md"
              >
                {/* Header: Date and Level */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">
                    {format(new Date(d.ts), 'dd MMM yyyy, HH:mm')}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[11px] ${
                      d.level === 'high'
                        ? 'bg-rukoRed/20 text-rukoRed border border-rukoRed'
                        : d.level === 'caution'
                        ? 'bg-saffron/20 text-saffron border border-saffron'
                        : 'bg-rukoGreen/20 text-rukoGreen border border-rukoGreen'
                    }`}
                  >
                    {t(`levels.${d.level}`)}
                  </span>
                </div>

                {/* Why text */}
                <div>
                  <div className="text-sm text-slate-400 mb-1">
                    {t('pause.q_why')}
                  </div>
                  <div className="text-base font-semibold text-cream">
                    "{d.why}"
                  </div>
                </div>

                {/* Outcome & Details */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/60 text-xs">
                  <div className="text-slate-300">
                    <span className="text-slate-400 mr-1.5">{t('journal.outcome_label')}:</span>
                    <span
                      className={`font-bold ${
                        d.outcome === 'abandoned'
                          ? 'text-rukoRed'
                          : d.outcome === 'delayed'
                          ? 'text-saffron'
                          : 'text-rukoGreen'
                      }`}
                    >
                      {t(`journal.outcome_${d.outcome}`)}
                    </span>
                  </div>
                  <div className="text-slate-300 font-mono">
                    ₹{d.amount.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Expandable Details Toggle */}
                <div className="pt-2 border-t border-slate-700/40 flex justify-between items-center text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDetails(prev => ({ ...prev, [d.id!]: !prev[d.id!] }))
                    }
                    className="text-saffron hover:underline font-semibold flex items-center space-x-1"
                  >
                    <span>{t('journal.details')}</span>
                    <span>{expandedDetails[d.id!] ? '▲' : '▼'}</span>
                  </button>
                  <span className="text-[11px] text-slate-400 capitalize">
                    {d.horizon} • {d.funding}
                  </span>
                </div>

                {/* Expanded Details Body */}
                {expandedDetails[d.id!] && (
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 text-xs space-y-2 mt-2">
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div>
                        <span className="text-slate-400 block text-[11px]">{t('journal.max_loss_label')}</span>
                        <span className="font-mono">₹{d.maxLoss.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">{t('journal.signals_label')}</span>
                        <span>
                          {d.firedSignals.length > 0
                            ? d.firedSignals.map(sig => t(`signal_names.${sig}`, sig)).join(', ')
                            : t('journal.none')}
                        </span>
                      </div>
                    </div>

                    {/* Triggers (Phase 3) */}
                    {d.triggers && d.triggers.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[11px] block">{t('journal.noticed_patterns_label')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {d.triggers.map((trig, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-saffron/40 text-saffron text-[11px] font-medium"
                            >
                              {t(`pause.trigger_labels.${trig.type}`, trig.type)}: "{trig.evidence}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reflections */}
                    {d.reflections && d.reflections.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[11px] block">{t('journal.reflections_title')}:</span>
                        <div className="space-y-1">
                          {d.reflections.map((ref, idx) => (
                            <div key={idx} className="text-slate-300 bg-slate-800/60 p-1.5 rounded-lg">
                              <span className="font-semibold text-slate-400 mr-1">{ref.qid.replace('q_', '')}:</span>
                              <span>{ref.answer}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Existing Reflection */}
                {(d.reflection || d.feeling) && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-900/60 border border-slate-700/80 text-xs space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">{t('journal.reflection_label')}</span>
                      {d.feeling && (
                        <span className="font-bold text-saffron uppercase">
                          {t(`journal.feel_${d.feeling}`)}
                        </span>
                      )}
                    </div>
                    {d.reflection && (
                      <p className="text-slate-200 italic mt-1 font-sans">
                        "{d.reflection}"
                      </p>
                    )}
                  </div>
                )}

                {/* Morning-after Prompt Card */}
                {needsReflection && d.id && (
                  <div className="mt-3 p-3.5 rounded-xl bg-amber-950/40 border border-saffron/50 space-y-3">
                    <p className="text-sm font-bold text-saffron">
                      {t('journal.morning_prompt')}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFeeling(prev => ({ ...prev, [d.id!]: 'calm' }))
                        }
                        className={`min-h-[48px] py-2 px-2 rounded-xl font-bold text-xs transition-all ${
                          currentFeeling === 'calm'
                            ? 'bg-rukoGreen text-navy'
                            : 'bg-slate-800 text-slate-200 border border-slate-600'
                        }`}
                      >
                        {t('journal.feel_calm')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFeeling(prev => ({ ...prev, [d.id!]: 'regret' }))
                        }
                        className={`min-h-[48px] py-2 px-2 rounded-xl font-bold text-xs transition-all ${
                          currentFeeling === 'regret'
                            ? 'bg-rukoRed text-cream'
                            : 'bg-slate-800 text-slate-200 border border-slate-600'
                        }`}
                      >
                        {t('journal.feel_regret')}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFeeling(prev => ({ ...prev, [d.id!]: 'unsure' }))
                        }
                        className={`min-h-[48px] py-2 px-2 rounded-xl font-bold text-xs transition-all ${
                          currentFeeling === 'unsure'
                            ? 'bg-saffron text-navy'
                            : 'bg-slate-800 text-slate-200 border border-slate-600'
                        }`}
                      >
                        {t('journal.feel_unsure')}
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder={t('journal.reflection_placeholder')}
                      value={reflectionTexts[d.id] || ''}
                      onChange={e =>
                        setReflectionTexts(prev => ({ ...prev, [d.id!]: e.target.value }))
                      }
                      className="w-full text-sm min-h-[48px] p-3 rounded-xl bg-slate-900 border border-slate-700 text-cream focus:border-saffron focus:outline-none"
                    />

                    <button
                      type="button"
                      disabled={!currentFeeling && !reflectionTexts[d.id]?.trim()}
                      onClick={() => handleSaveReflection(d.id!)}
                      className="w-full min-h-[48px] py-2.5 px-3 rounded-xl bg-saffron text-navy font-bold text-sm hover:bg-[#e09430] disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {t('journal.save_reflection')}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
