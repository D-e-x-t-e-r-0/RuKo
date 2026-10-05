import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { db } from '../db';
import { AIBadge } from '../components/AIBadge';
import { askAI } from '../ai/ai';
import { getFallbackSummary } from '../ai/fallback';

interface DayData {
  day: string;
  planned: number;
  impulsive: number;
}

interface PracticeStats {
  pauseOnCount: number;
  pauseOnAvgTrades: string;
  pauseOnLossShare: string;
  pauseOffCount: number;
  pauseOffAvgTrades: string;
  pauseOffLossShare: string;
}

export const Mirror: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [chartData, setChartData] = useState<DayData[]>([]);
  const [totalPauses, setTotalPauses] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [impulsivePercent, setImpulsivePercent] = useState(0);
  const [showSupportCard, setShowSupportCard] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<string>('');
  const [isAISummary, setIsAISummary] = useState<boolean>(false);
  const [practiceStats, setPracticeStats] = useState<PracticeStats | null>(null);

  useEffect(() => {
    async function loadMirrorData() {
      try {
        // The Mirror stays real-only
        const rawDecisions = await db.decisions.toArray();
      const allDecisions = rawDecisions.filter(d => d.mode !== 'practice');
      const now = new Date();

      // Practice comparison table data
      const allSessions = await db.sessions.toArray();
      const finishedSessions = allSessions.filter(s => s.endedAt || (s.tradesOpened ?? 0) > 0);
      if (finishedSessions.length > 0) {
        const onSessions = finishedSessions.filter(s => s.pauseEnabled);
        const offSessions = finishedSessions.filter(s => !s.pauseEnabled);

        const onTrades = onSessions.reduce((acc, s) => acc + (s.tradesOpened ?? 0), 0);
        const onLossTrades = onSessions.reduce((acc, s) => acc + (s.tradesAfterLoss ?? 0), 0);
        const offTrades = offSessions.reduce((acc, s) => acc + (s.tradesOpened ?? 0), 0);
        const offLossTrades = offSessions.reduce((acc, s) => acc + (s.tradesAfterLoss ?? 0), 0);

        setPracticeStats({
          pauseOnCount: onSessions.length,
          pauseOnAvgTrades: onSessions.length > 0 ? (onTrades / onSessions.length).toFixed(1) : '0',
          pauseOnLossShare: onTrades > 0 ? `${Math.round((onLossTrades / onTrades) * 100)}%` : '0%',
          pauseOffCount: offSessions.length,
          pauseOffAvgTrades: offSessions.length > 0 ? (offTrades / offSessions.length).toFixed(1) : '0',
          pauseOffLossShare: offTrades > 0 ? `${Math.round((offLossTrades / offTrades) * 100)}%` : '0%',
        });
      }

      // Last 7 days, from 6 days ago up to today
      const days: DayData[] = [];
      let pausesCount = 0;
      let savedCount = 0;
      let impulsiveCount = 0;
      let loanCount = 0;

      const sevenDaysAgoStart = startOfDay(subDays(now, 6));

      for (let i = 6; i >= 0; i--) {
        const targetDate = subDays(now, i);
        const dayInterval = {
          start: startOfDay(targetDate),
          end: endOfDay(targetDate),
        };

        const dayDecisions = allDecisions.filter(d =>
          isWithinInterval(new Date(d.ts), dayInterval)
        );

        let dayPlanned = 0;
        let dayImpulsive = 0;

        for (const d of dayDecisions) {
          // Planned: calm or caution AND horizon is not today
          const isPlanned =
            (d.level === 'calm' || d.level === 'caution') && d.horizon !== 'today';

          if (isPlanned) {
            dayPlanned++;
          } else {
            dayImpulsive++;
          }
        }

        days.push({
          day: format(targetDate, 'EEE'),
          planned: dayPlanned,
          impulsive: dayImpulsive,
        });
      }

      // Filter all decisions from the last 7 days window
      const weekDecisions = allDecisions.filter(d => d.ts >= sevenDaysAgoStart.getTime());

      for (const d of weekDecisions) {
        pausesCount++;
        if (d.outcome === 'abandoned' || d.outcome === 'delayed') {
          savedCount++;
        }
        const isPlanned =
          (d.level === 'calm' || d.level === 'caution') && d.horizon !== 'today';
        if (!isPlanned) {
          impulsiveCount++;
        }
        if (d.funding === 'loan') {
          loanCount++;
        }
      }

      setChartData(days);
      setTotalPauses(pausesCount);
      setTotalSaved(savedCount);
      const calculatedImpulsivePercent = pausesCount > 0 ? Math.round((impulsiveCount / pausesCount) * 100) : 0;
      setImpulsivePercent(calculatedImpulsivePercent);
      setShowSupportCard(loanCount >= 3);

      if (pausesCount > 0) {
        const lang = i18n.language.startsWith('hi') ? 'hi' : 'en';
        const payload = {
          pauses: pausesCount,
          abandoned: savedCount,
          delayed: 0,
          proceeded: pausesCount - savedCount,
          impulsivePercent: calculatedImpulsivePercent,
          regretCount: 0,
          calmCount: 0,
          context: 'week',
        };

        askAI<{ summary: string }>('summary', lang, payload).then(aiRes => {
          if (aiRes && aiRes.summary) {
            setWeeklySummary(aiRes.summary);
            setIsAISummary(true);
          } else {
            setWeeklySummary(getFallbackSummary(payload, lang));
            setIsAISummary(false);
          }
        }).catch(() => {
          setWeeklySummary(getFallbackSummary(payload, lang));
          setIsAISummary(false);
        });
      }
      } catch (_) {
        setChartData([]);
        setTotalPauses(0);
        setTotalSaved(0);
        setImpulsivePercent(0);
        setShowSupportCard(false);
      }
    }

    loadMirrorData();
  }, [i18n.language]);

  return (
    <div className="max-w-md mx-auto p-4 pb-20 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy">
          {t('mirror.title')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {t('mirror.subtitle')}
        </p>
      </header>

      {totalPauses === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 shadow-md">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-700/60 flex items-center justify-center text-clay text-2xl">
            🪞
          </div>
          <h3 className="text-base font-bold text-navy">
            {t('mirror.empty_title')}
          </h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            {t('mirror.empty_desc')}
          </p>
        </div>
      ) : (
        <>
          {/* Weekly Summary Card */}
          {weeklySummary && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold text-clay tracking-wider">
                  {t('mirror.weekly_summary_title')}
                </span>
                <AIBadge isAI={isAISummary} />
              </div>
              <p className="text-sm font-medium text-navy leading-relaxed">
                {weeklySummary}
              </p>
            </div>
          )}

          {/* Recharts Stacked Bar Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md">
            <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: '0.75rem',
                  color: '#14213D',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              />
              <Bar
                dataKey="planned"
                stackId="decisions"
                fill="#2BB3A3"
                name={t('mirror.planned')}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="impulsive"
                stackId="decisions"
                fill="#E4572E"
                name={t('mirror.impulsive')}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3 Plain Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-2xl font-bold text-navy">{totalPauses}</div>
          <div className="text-[11px] text-slate-500 mt-1 leading-tight font-medium">
            {t('mirror.stat_pauses')}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-2xl font-bold text-teal-700">{totalSaved}</div>
          <div className="text-[11px] text-slate-500 mt-1 leading-tight font-medium">
            {t('mirror.stat_saved')}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="text-2xl font-bold text-rukoRed">{impulsivePercent}%</div>
          <div className="text-[11px] text-slate-500 mt-1 leading-tight font-medium">
            {t('mirror.stat_impulsive')}
          </div>
        </div>
      </div>

      {/* Neutral Support Card (if loan >= 3 in last 7 days) */}
      {showSupportCard && (
        <div className="bg-amber-50 border-2 border-saffron/70 rounded-2xl p-4 text-navy space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-clay text-lg font-bold">ℹ</span>
            <span className="text-xs uppercase font-bold text-clay tracking-wider">{t('mirror.notice')}</span>
          </div>
          <p className="text-sm leading-relaxed text-navy font-medium">
            {t('mirror.support_card')}
          </p>
        </div>
      )}

      {/* Practice Comparison Table (Pause ON vs OFF) */}
      {practiceStats && (practiceStats.pauseOnCount > 0 || practiceStats.pauseOffCount > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-md">
          <h3 className="text-xs uppercase font-bold text-clay tracking-wider">
            {t('mirror.practice_comparison_title')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <caption className="sr-only">{t('mirror.practice_comparison_title')}</caption>
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th scope="col" className="py-2 font-semibold">{t('mirror.mode_col')}</th>
                  <th scope="col" className="py-2 text-right font-semibold">{t('mirror.avg_trades')}</th>
                  <th scope="col" className="py-2 text-right font-semibold">{t('mirror.loss_chasing_share')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-navy">
                <tr>
                  <td className="py-2 font-medium text-teal-700">{t('mirror.comparison_pause_on')} ({practiceStats.pauseOnCount})</td>
                  <td className="py-2 text-right font-mono">{practiceStats.pauseOnAvgTrades}</td>
                  <td className="py-2 text-right font-mono">{practiceStats.pauseOnLossShare}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-rukoRed">{t('mirror.comparison_pause_off')} ({practiceStats.pauseOffCount})</td>
                  <td className="py-2 text-right font-mono">{practiceStats.pauseOffAvgTrades}</td>
                  <td className="py-2 text-right font-mono">{practiceStats.pauseOffLossShare}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )}
</div>
);
};
