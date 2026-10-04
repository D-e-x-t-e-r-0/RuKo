import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { format } from 'date-fns';
import { db } from '../db';
import type { Outcome, PracticeTrade } from '../types';
import {
  SCENARIOS,
  INSTRUMENTS,
  type ScenarioId,
  type InstrumentId,
  generatePrices,
  getSimTime,
} from '../sim/market';
import {
  calculatePnl,
  isAutoCloseTriggered,
  INITIAL_WALLET_BALANCE,
  type VirtualPosition,
} from '../sim/account';
import { evaluateSignals, type LastTradeHint } from '../engine/signals';
import { Pause } from './Pause';
import { BigButton } from '../components/BigButton';

export const Practice: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Setup state
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('calm');
  const [pauseEnabled, setPauseEnabled] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem('ruko.practicePause') !== 'off';
  });

  // Active session state
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [tick, setTick] = useState<number>(0);
  const [wallet, setWallet] = useState<number>(INITIAL_WALLET_BALANCE);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentId>('demo_index');
  const [marginChip, setMarginChip] = useState<'10k' | '25k' | '50k' | 'custom'>('10k');
  const [customMargin, setCustomMargin] = useState<string>('10000');
  const [leverage, setLeverage] = useState<1 | 5>(1);
  const [activePosition, setActivePosition] = useState<VirtualPosition | null>(null);

  // Price series for all instruments in active scenario: { [inst]: number[] }
  const [priceSeries, setPriceSeries] = useState<Record<InstrumentId, number[]> | null>(null);

  // Pause ritual state during active session
  const [isPausedForRitual, setIsPausedForRitual] = useState<boolean>(false);
  const [pendingMargin, setPendingMargin] = useState<number>(10000);

  // Tracking metrics during session
  const [pausesTaken, setPausesTaken] = useState<number>(0);
  const [abandonedOrDelayed, setAbandonedOrDelayed] = useState<number>(0);
  const [tradesOpened, setTradesOpened] = useState<number>(0);
  const [tradesAfterLoss, setTradesAfterLoss] = useState<number>(0);
  const [marginsUsed, setMarginsUsed] = useState<number[]>([]);
  const peakEquityRef = useRef<number>(INITIAL_WALLET_BALANCE);
  const [maxDrawdown, setMaxDrawdown] = useState<number>(0);
  const [sessionTrades, setSessionTrades] = useState<PracticeTrade[]>([]);
  const [observedSignals, setObservedSignals] = useState<Set<string>>(new Set());
  const [autoCloseNotice, setAutoCloseNotice] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionEndedRef = useRef<boolean>(false);

  // Update pause toggle in localStorage
  const handleTogglePause = (enabled: boolean) => {
    setPauseEnabled(enabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ruko.practicePause', enabled ? 'on' : 'off');
    }
  };

  const scenarioInfo = SCENARIOS[selectedScenario];
  const instrumentInfo = INSTRUMENTS[selectedInstrument];

  // Current margin computation
  const currentMargin = useMemo(() => {
    switch (marginChip) {
      case '10k': return 10000;
      case '25k': return 25000;
      case '50k': return 50000;
      case 'custom': {
        const val = parseInt(customMargin, 10);
        return isNaN(val) || val <= 0 ? 10000 : val;
      }
    }
  }, [marginChip, customMargin]);

  // Adjust leverage if instrument changes and does not support 5x
  useEffect(() => {
    if (instrumentInfo.maxLeverage === 1 && leverage === 5) {
      setLeverage(1);
    }
  }, [selectedInstrument, instrumentInfo.maxLeverage, leverage]);

  // Start Session
  const handleStartSession = async () => {
    sessionEndedRef.current = false;
    const seed = scenarioInfo.fixedSeed;
    const series: Record<InstrumentId, number[]> = {
      demo_index: generatePrices(seed, selectedScenario, 'demo_index', 120),
      demo_co_a: generatePrices(seed + 11, selectedScenario, 'demo_co_a', 120),
      demo_co_b: generatePrices(seed + 23, selectedScenario, 'demo_co_b', 120),
      demo_futures: generatePrices(seed + 37, selectedScenario, 'demo_futures', 120),
    };

    setPriceSeries(series);
    setTick(0);
    setWallet(INITIAL_WALLET_BALANCE);
    setActivePosition(null);
    setPausesTaken(0);
    setAbandonedOrDelayed(0);
    setTradesOpened(0);
    setTradesAfterLoss(0);
    setMarginsUsed([]);
    peakEquityRef.current = INITIAL_WALLET_BALANCE;
    setMaxDrawdown(0);
    setSessionTrades([]);
    setObservedSignals(new Set());
    setAutoCloseNotice(null);

    const startSimTs = getSimTime(scenarioInfo.startHour, scenarioInfo.startMinute, 0);

    const newSessionId = await db.sessions.add({
      startedAt: Date.now(),
      scenario: selectedScenario,
      pauseEnabled,
      tradesOpened: 0,
      tradesAfterLoss: 0,
      sizeIncreasePercent: 0,
      maxDrawdownPercent: 0,
      finalPnl: 0,
      pausesTaken: 0,
      abandonedOrDelayed: 0,
      observedSignals: [],
    }) as number;

    // If late_night scenario: pre-fill a practice loss trade 5 sim-minutes earlier
    if (selectedScenario === 'late_night') {
      const priorLossTrade: PracticeTrade = {
        sessionId: newSessionId,
        ts: startSimTs - 5 * 60 * 1000,
        amount: 10000,
        pnl: -2500,
        funding: 'savings',
        instrument: 'Demo Index',
        entryPrice: 102.5,
        closePrice: 100.0,
        leverage: 1,
      };
      await db.practiceTrades.add(priorLossTrade);
      setSessionTrades([priorLossTrade]);
    }

    setSessionId(newSessionId);
  };

  // Current price of selected instrument
  const currentPrice = priceSeries && priceSeries[selectedInstrument]
    ? priceSeries[selectedInstrument][tick] ?? 100
    : 100;

  // Current Sim Time timestamp
  const currentSimTs = useMemo(() => {
    return getSimTime(scenarioInfo.startHour, scenarioInfo.startMinute, tick);
  }, [scenarioInfo, tick]);

  // Evaluate Signals
  useEffect(() => {
    if (sessionId === null || !priceSeries) return;

    const lastTrade = sessionTrades[sessionTrades.length - 1];
    let lastTradeHint: LastTradeHint | undefined;
    if (lastTrade) {
      const minutesAgo = Math.max(0, Math.round((currentSimTs - lastTrade.ts) / (60 * 1000)));
      lastTradeHint = {
        result: lastTrade.pnl !== null && lastTrade.pnl < 0 ? 'loss' : 'profit',
        minutesAgo,
      };
    }

    const tradeInputs = sessionTrades.map(t => ({
      id: t.id,
      ts: t.ts,
      amount: t.amount,
      pnl: t.pnl,
      funding: t.funding,
    }));

    const signals = evaluateSignals(tradeInputs, {
      ts: currentSimTs,
      amount: currentMargin,
      funding: 'savings',
      lastTradeHint,
    });

    const newlyFired = signals.filter(s => s.fired).map(s => s.id);
    if (newlyFired.length > 0) {
      setObservedSignals(prev => {
        const next = new Set(prev);
        newlyFired.forEach(id => next.add(id));
        return next;
      });
    }
  }, [sessionId, tick, currentSimTs, currentMargin, sessionTrades, priceSeries]);

  // Main sim clock timer (1 tick / 1 second real-time)
  useEffect(() => {
    if (sessionId === null || !priceSeries || isPausedForRitual) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTick(prevTick => {
        const nextTick = prevTick + 1;
        if (nextTick >= 120) {
          return 119;
        }
        return nextTick;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, priceSeries, isPausedForRitual]);

  // Check auto-close and track drawdown at each tick
  useEffect(() => {
    if (sessionId === null || !priceSeries || isPausedForRitual) return;

    if (activePosition) {
      const posPrice = priceSeries[activePosition.instrument][tick] ?? activePosition.entryPrice;
      const unrealizedPnl = calculatePnl(
        activePosition.entryPrice,
        posPrice,
        activePosition.margin,
        activePosition.leverage
      );

      // Check auto-close: unrealized loss >= 90% of margin
      if (isAutoCloseTriggered(activePosition.entryPrice, posPrice, activePosition.margin, activePosition.leverage)) {
        const simTs = getSimTime(scenarioInfo.startHour, scenarioInfo.startMinute, tick);
        const closedTrade: PracticeTrade = {
          sessionId,
          ts: simTs,
          amount: activePosition.margin,
          pnl: unrealizedPnl,
          funding: 'savings',
          instrument: INSTRUMENTS[activePosition.instrument].name,
          entryPrice: activePosition.entryPrice,
          closePrice: posPrice,
          leverage: activePosition.leverage,
        };

        try {
          void db.practiceTrades.add(closedTrade).catch(() => {});
        } catch (_) {}
        setSessionTrades(prev => [...prev, closedTrade]);
        setWallet(w => w + activePosition.margin + unrealizedPnl);
        setActivePosition(null);
        setAutoCloseNotice(t('practice.auto_close_notice'));
      }

      // Equity tracking
      const curEquity = wallet + activePosition.margin + unrealizedPnl;
      if (curEquity > peakEquityRef.current) {
        peakEquityRef.current = curEquity;
      }
      const curDrawdown = peakEquityRef.current > 0
        ? ((peakEquityRef.current - curEquity) / peakEquityRef.current) * 100
        : 0;
      setMaxDrawdown(d => Math.max(d, curDrawdown));
    } else {
      if (wallet > peakEquityRef.current) {
        peakEquityRef.current = wallet;
      }
      const curDrawdown = peakEquityRef.current > 0
        ? ((peakEquityRef.current - wallet) / peakEquityRef.current) * 100
        : 0;
      setMaxDrawdown(d => Math.max(d, curDrawdown));
    }

    // Auto-end session when 120 ticks reached
    if (tick >= 119) {
      handleEndSession();
    }
  }, [tick, sessionId, priceSeries, isPausedForRitual]);

  // Open position handler
  const handleOpenPositionClick = () => {
    if (activePosition) return;
    if (currentMargin > wallet) return;

    if (pauseEnabled) {
      setPendingMargin(currentMargin);
      setIsPausedForRitual(true);
    } else {
      openVirtualPosition(currentMargin);
    }
  };

  const openVirtualPosition = (margin: number) => {
    const uid =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    const newPos: VirtualPosition = {
      id: uid,
      instrument: selectedInstrument,
      margin,
      leverage,
      entryPrice: currentPrice,
      openedAtSimTs: currentSimTs,
      openedAtTick: tick,
    };

    setWallet(w => w - margin);
    setActivePosition(newPos);
    setTradesOpened(n => n + 1);
    setMarginsUsed(prev => [...prev, margin]);

    // Check if this trade opened within 5 sim-minutes of a previous loss trade
    const lastLossTrade = [...sessionTrades].reverse().find(t => t.pnl !== null && t.pnl < 0);
    if (lastLossTrade && currentSimTs - lastLossTrade.ts <= 5 * 60 * 1000) {
      setTradesAfterLoss(n => n + 1);
    }
  };

  const handlePauseComplete = (outcome: Outcome) => {
    setIsPausedForRitual(false);
    setPausesTaken(p => p + 1);

    if (outcome === 'proceeded') {
      openVirtualPosition(pendingMargin);
    } else {
      setAbandonedOrDelayed(a => a + 1);
    }
  };

  // Close position handler
  const handleClosePosition = () => {
    if (!activePosition || !priceSeries) return;

    const posPrice = priceSeries[activePosition.instrument][tick] ?? activePosition.entryPrice;
    const finalPnl = calculatePnl(
      activePosition.entryPrice,
      posPrice,
      activePosition.margin,
      activePosition.leverage
    );

    const closedTrade: PracticeTrade = {
      sessionId: sessionId ?? 0,
      ts: currentSimTs,
      amount: activePosition.margin,
      pnl: finalPnl,
      funding: 'savings',
      instrument: INSTRUMENTS[activePosition.instrument].name,
      entryPrice: activePosition.entryPrice,
      closePrice: posPrice,
      leverage: activePosition.leverage,
    };

    if (sessionId) {
      db.practiceTrades.add(closedTrade);
    }
    setSessionTrades(prev => [...prev, closedTrade]);
    setWallet(w => w + activePosition.margin + finalPnl);
    setActivePosition(null);
  };

  // End Session handler
  const handleEndSession = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (sessionId === null || !priceSeries) return;

    let finalWallet = wallet;
    const updatedTrades = [...sessionTrades];

    // If position still open, close it now
    if (activePosition) {
      const posPrice = priceSeries[activePosition.instrument][tick] ?? activePosition.entryPrice;
      const finalPnl = calculatePnl(
        activePosition.entryPrice,
        posPrice,
        activePosition.margin,
        activePosition.leverage
      );
      const closeTrade: PracticeTrade = {
        sessionId,
        ts: currentSimTs,
        amount: activePosition.margin,
        pnl: finalPnl,
        funding: 'savings',
        instrument: INSTRUMENTS[activePosition.instrument].name,
        entryPrice: activePosition.entryPrice,
        closePrice: posPrice,
        leverage: activePosition.leverage,
      };
      await db.practiceTrades.add(closeTrade);
      updatedTrades.push(closeTrade);
      finalWallet += activePosition.margin + finalPnl;
    }

    // Calculate metrics
    const totalPnl = finalWallet - INITIAL_WALLET_BALANCE;
    const firstMargin = marginsUsed.length > 0 ? marginsUsed[0] : 0;
    const maxMargin = marginsUsed.length > 0 ? Math.max(...marginsUsed) : 0;
    const sizeIncreasePercent = firstMargin > 0
      ? Math.max(0, Math.round(((maxMargin - firstMargin) / firstMargin) * 100))
      : 0;

    await db.sessions.update(sessionId, {
      endedAt: Date.now(),
      tradesOpened,
      tradesAfterLoss,
      sizeIncreasePercent,
      maxDrawdownPercent: Math.round(maxDrawdown * 10) / 10,
      finalPnl: totalPnl,
      pausesTaken,
      abandonedOrDelayed,
      observedSignals: Array.from(observedSignals),
    });

    navigate(`/debrief?id=${sessionId}`);
  };

  // Chart data: prices up to current tick
  const chartData = useMemo(() => {
    if (!priceSeries || !priceSeries[selectedInstrument]) return [];
    return priceSeries[selectedInstrument]
      .slice(0, tick + 1)
      .map((p, idx) => ({
        tick: idx,
        price: p,
      }));
  }, [priceSeries, selectedInstrument, tick]);

  // Unrealized P&L of active position
  const unrealizedPnl = useMemo(() => {
    if (!activePosition || !priceSeries) return 0;
    const posPrice = priceSeries[activePosition.instrument][tick] ?? activePosition.entryPrice;
    return calculatePnl(
      activePosition.entryPrice,
      posPrice,
      activePosition.margin,
      activePosition.leverage
    );
  }, [activePosition, priceSeries, tick]);

  // If paused for ritual modal
  if (isPausedForRitual) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0F172A] overflow-y-auto">
        <Pause
          mode="practice"
          initialAmount={pendingMargin}
          initialFunding="savings"
          onComplete={handlePauseComplete}
        />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 pb-20 space-y-4">
      {/* Permanent Warning Banner */}
      <div className="bg-amber-950/60 border border-saffron/60 text-saffron p-3 rounded-2xl text-xs font-semibold text-center leading-relaxed">
        {t('practice.banner')}
      </div>

      {/* Scenario Picker Screen (when not running) */}
      {sessionId === null ? (
        <div className="space-y-5">
          <header>
            <h1 className="text-2xl font-bold text-cream">
              {t('practice.title')}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {t('practice.select_scenario')}
            </p>
          </header>

          <div className="space-y-3">
            {(Object.keys(SCENARIOS) as ScenarioId[]).map(scId => {
              const sc = SCENARIOS[scId];
              const isSelected = selectedScenario === scId;
              const titleKey = `practice.scenarios.${scId}_title`;
              const descKey = `practice.scenarios.${scId}_desc`;

              return (
                <button
                  key={scId}
                  type="button"
                  onClick={() => setSelectedScenario(scId)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-saffron ring-1 ring-saffron'
                      : 'bg-slate-800/60 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cream text-base">
                      {t(titleKey, scId)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {sc.startHour.toString().padStart(2, '0')}:{sc.startMinute.toString().padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {t(descKey, i18n.language.startsWith('hi') ? sc.hiDescription : sc.enDescription)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Pause Ritual Toggle */}
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-cream">
                {t('practice.pause_toggle')}
              </div>
              <div className="text-xs text-slate-400">
                {t('practice.pause_toggle_desc')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleTogglePause(!pauseEnabled)}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                pauseEnabled ? 'bg-saffron' : 'bg-slate-600'
              }`}
            >
              <div
                className={`bg-navy w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  pauseEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <BigButton variant="primary" onClick={handleStartSession}>
            {t('practice.start_btn')}
          </BigButton>
        </div>
      ) : (
        /* Live Running Session Screen */
        <div className="space-y-4">
          {/* Top Status Bar */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
              <span className="font-semibold text-cream">
                {t(`practice.scenarios.${selectedScenario}_title`, selectedScenario)}
              </span>
              <span className="text-slate-400 font-mono">
                {format(new Date(currentSimTs), 'hh:mm a')}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-slate-400">
                {t('practice.ticks_left', { m: 120 - tick })}
              </span>
              <button
                type="button"
                onClick={handleEndSession}
                className="text-xs font-bold text-red-300 hover:text-red-200 border border-red-500/40 rounded-lg px-2 py-1"
              >
                {t('practice.end_session')}
              </button>
            </div>
          </div>

          {/* Auto Close Alert */}
          {autoCloseNotice && (
            <div className="bg-red-950/80 border border-red-500/60 text-red-200 p-3 rounded-2xl text-xs font-semibold text-center animate-fade-in">
              {autoCloseNotice}
            </div>
          )}

          {/* Account Balance & Instrument Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
              <div className="text-xs text-slate-400">{t('practice.wallet')}</div>
              <div className="text-lg font-bold font-mono text-cream">
                ₹{wallet.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
              <div className="text-xs text-slate-400">{t('practice.current_price')}</div>
              <div className="text-lg font-bold font-mono text-cream">
                ₹{currentPrice.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="tick" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderColor: '#475569',
                      borderRadius: '0.75rem',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                    formatter={(val: number) => [`₹${val.toFixed(2)}`, 'Price']}
                    labelFormatter={(label: number) => `Tick ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#E5A93C"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Instrument Selector */}
          <div className="space-y-1">
            <label className="text-xs text-slate-400">{t('practice.instrument')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(INSTRUMENTS) as InstrumentId[]).map(instId => {
                const info = INSTRUMENTS[instId];
                const isSelected = selectedInstrument === instId;
                return (
                  <button
                    key={instId}
                    type="button"
                    disabled={activePosition !== null}
                    onClick={() => setSelectedInstrument(instId)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold text-left border transition-all ${
                      isSelected
                        ? 'bg-slate-700 border-saffron text-cream'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    } ${activePosition !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {info.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Position Info OR Open Position Controls */}
          {activePosition ? (
            <div className="bg-slate-800 border border-slate-600 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-cream">
                  {INSTRUMENTS[activePosition.instrument].name}
                </span>
                <span className="font-mono">
                  {activePosition.leverage}x · ₹{activePosition.margin.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Entry: ₹{activePosition.entryPrice.toFixed(2)}
                </span>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">{t('practice.unrealized_pnl')}</span>
                  <span className="font-mono font-bold text-sm text-slate-200">
                    {unrealizedPnl >= 0 ? `+₹${unrealizedPnl}` : `-₹${Math.abs(unrealizedPnl)}`}
                  </span>
                </div>
              </div>
              <BigButton variant="primary" onClick={handleClosePosition}>
                {t('practice.close_position')}
              </BigButton>
            </div>
          ) : (
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-4">
              {/* Margin Selector Chips */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">{t('practice.margin')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['10k', '25k', '50k', 'custom'] as const).map(chip => {
                    const isSelected = marginChip === chip;
                    const labels = {
                      '10k': '₹10k',
                      '25k': '₹25k',
                      '50k': '₹50k',
                      'custom': 'Custom',
                    };
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setMarginChip(chip)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                          isSelected
                            ? 'bg-saffron text-navy border-saffron'
                            : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {labels[chip]}
                      </button>
                    );
                  })}
                </div>
                {marginChip === 'custom' && (
                  <input
                    type="number"
                    value={customMargin}
                    onChange={e => setCustomMargin(e.target.value)}
                    placeholder="Enter margin"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-cream font-mono mt-2"
                  />
                )}
              </div>

              {/* Leverage Selector */}
              {instrumentInfo.maxLeverage === 5 && (
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400">{t('practice.leverage')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([1, 5] as const).map(lev => (
                      <button
                        key={lev}
                        type="button"
                        onClick={() => setLeverage(lev)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                          leverage === lev
                            ? 'bg-slate-700 border-saffron text-cream'
                            : 'bg-slate-800 border-slate-600 text-slate-400'
                        }`}
                      >
                        {lev}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <BigButton
                variant="primary"
                onClick={handleOpenPositionClick}
                disabled={currentMargin > wallet}
              >
                {t('practice.open_position')}
              </BigButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
