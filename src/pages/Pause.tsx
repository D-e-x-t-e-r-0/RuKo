import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../db';
import type { Funding, Horizon, Outcome, Level, Signal, ReflectionAnswer, TriggerItem, Trade } from '../types';
import { evaluateSignals, type LastTradeHint } from '../engine/signals';
import { levelFor } from '../engine/pressure';
import { speak } from '../voice/voice';
import { getSpeechCode } from '../i18n';
import { MicButton } from '../components/MicButton';
import { BigButton } from '../components/BigButton';
import { BreathingCircle } from '../components/BreathingCircle';
import { SignalCard } from '../components/SignalCard';
import { AIBadge } from '../components/AIBadge';
import { askAI } from '../ai/ai';
import { getFallbackTriggers, getFallbackQuestion } from '../ai/fallback';
import { format } from 'date-fns';

export interface PauseProps {
  mode?: 'real' | 'practice';
  initialAmount?: number;
  initialFunding?: Funding;
  sessionId?: number;
  onComplete?: (outcome: Outcome) => void;
}

interface ReflectionCardDef {
  id: string;
  type: 'breath' | 'why' | 'horizon' | 'max_loss' | 'signal' | 'mirror' | 'rule' | 'general' | 'body' | 'ai_trigger' | 'ai_question';
  title?: string;
  questionText?: string;
  answerType?: 'chips' | 'text' | 'number' | 'info';
  options?: { value: string; label: string }[];
  qid?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraData?: any;
}

export const Pause: React.FC<PauseProps> = ({
  mode = 'real',
  initialAmount,
  initialFunding,
  sessionId,
  onComplete,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Screens: 1 (Quick check), 2 (Pressure check), 3 (Reflection wait), 4 (Decide), 5 (Confirmation)
  const [screen, setScreen] = useState<number>(mode === 'practice' ? 2 : 1);

  // Screen 1: Quick check state
  const [amountType, setAmountType] = useState<'500' | '1000' | '5000' | 'other'>(
    initialAmount ? 'other' : '1000'
  );
  const [customAmount, setCustomAmount] = useState<string>(initialAmount ? String(initialAmount) : '');
  const [funding, setFunding] = useState<Funding>(initialFunding || 'savings');
  const [lastTradeResult, setLastTradeResult] = useState<'loss' | 'profit' | 'none'>('none');
  const [lastTradeTime, setLastTradeTime] = useState<'just_now' | '30m' | 'hours'>('just_now');

  // Screen 2 & 3: Pressure & Wait state
  const [signals, setSignals] = useState<Signal[]>([]);
  const [level, setLevel] = useState<Level>('calm');

  // Reflection wait cards state
  const [cards, setCards] = useState<ReflectionCardDef[]>([]);
  const [cardIndex, setCardIndex] = useState<number>(0);

  // Core answers
  const [why, setWhy] = useState<string>('');
  const [horizon, setHorizon] = useState<Horizon>('today');
  const [maxLossStr, setMaxLossStr] = useState<string>('');
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [triggers, setTriggers] = useState<TriggerItem[]>([]);
  const whyAnalyzedRef = useRef<boolean>(false);

  const analyzeWhyIfSubmitted = async (whyContent: string) => {
    if (whyAnalyzedRef.current || whyContent.trim().length < 3) return;
    whyAnalyzedRef.current = true;

    const currentLang = i18n.language.startsWith('hi') ? 'hi' : 'en';

    // 1. Call triggers
    let isAI = false;
    let items: TriggerItem[] = [];
    const aiTrig = await askAI<{ triggers: TriggerItem[] }>('triggers', currentLang, { why: whyContent });
    if (aiTrig && Array.isArray(aiTrig.triggers) && aiTrig.triggers.length > 0) {
      items = aiTrig.triggers;
      isAI = true;
    } else {
      items = getFallbackTriggers(whyContent);
      isAI = false;
    }

    setTriggers(items);

    const extraCards: ReflectionCardDef[] = [];
    if (items.length > 0) {
      const first = items[0];
      const typeLabel = t(`pause.trigger_labels.${first.type}`, first.type);
      extraCards.push({
        id: `ai_trig_${Date.now()}`,
        type: 'ai_trigger',
        title: t('pause.noticed_pattern', { type: typeLabel, evidence: first.evidence }),
        extraData: { isAI },
      });
    }

    // 2. Call question
    const firedSignalIds = signals.filter(s => s.fired).map(s => s.id);
    const qRes = await askAI<{ question: string }>('question', currentLang, {
      why: whyContent,
      triggers: items.map(t => t.type),
      signals: firedSignalIds,
    });

    let qText = '';
    let isAIQ = false;
    if (qRes && qRes.question) {
      qText = qRes.question;
      isAIQ = true;
    } else {
      qText = getFallbackQuestion(firedSignalIds, currentLang);
      isAIQ = false;
    }

    if (qText) {
      extraCards.push({
        id: `ai_q_${Date.now()}`,
        type: 'ai_question',
        qid: 'personalized_q',
        questionText: qText,
        answerType: 'text',
        extraData: { isAI: isAIQ },
      });
    }

    if (extraCards.length > 0) {
      setCards(prev => {
        const copy = [...prev];
        // Insert right after the Why card or current card
        const insertAt = Math.min(copy.length, cardIndex + 1);
        copy.splice(insertAt, 0, ...extraCards);
        return copy;
      });
    }
  };

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [finalOutcome, setFinalOutcome] = useState<Outcome>('abandoned');
  const [saveError, setSaveError] = useState<string | null>(null);

  const getEffectiveAmount = (): number => {
    if (amountType === 'other') {
      return Number(customAmount) || 0;
    }
    return Number(amountType) || 0;
  };

  // Helper for voice readout
  const handleSpeak = (text: string) => {
    speak(text, getSpeechCode());
  };

  // Safe guarded vibration
  const triggerVibrate = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(200);
      } catch (_) {}
    }
  };

  // Initialize Screen 2 evaluation
  const runEvaluation = async () => {
    const now = Date.now();
    const amount = getEffectiveAmount();

    let hint: LastTradeHint | undefined;
    if (lastTradeResult !== 'none') {
      const minutesAgo = lastTradeTime === 'just_now' ? 2 : lastTradeTime === '30m' ? 30 : 120;
      hint = { result: lastTradeResult, minutesAgo };
    }

    let pastTrades: Trade[] = [];
    if (mode === 'practice') {
      const all = await db.practiceTrades.toArray();
      pastTrades = (sessionId ? all.filter(t => t.sessionId === sessionId) : all).map(t => ({
        ts: t.ts,
        amount: t.amount,
        pnl: t.pnl,
        funding: t.funding,
      }));
    } else {
      pastTrades = await db.trades.toArray();
    }

    const evaluatedSignals = evaluateSignals(pastTrades, {
      ts: now,
      amount,
      funding,
      lastTradeHint: hint,
    });

    const calculatedLevel = levelFor(evaluatedSignals);
    setSignals(evaluatedSignals);
    setLevel(calculatedLevel);
  };

  // Run evaluation when entering Screen 2
  useEffect(() => {
    if (screen === 2) {
      runEvaluation();
    }
  }, [screen]);

  // Build card sequence for Screen 3
  const prepareScreen3 = async () => {
    const cardList: ReflectionCardDef[] = [];

    // 1. BreathCard always first
    cardList.push({
      id: 'breath',
      type: 'breath',
      title: t('pause.breathe_in'),
    });

    // Core required cards
    const coreCards: ReflectionCardDef[] = [
      {
        id: 'why',
        type: 'why',
        qid: 'why',
        title: t('pause.why_card_title'),
        answerType: 'text',
      },
      {
        id: 'horizon',
        type: 'horizon',
        qid: 'horizon',
        title: t('pause.q_horizon'),
        answerType: 'chips',
        options: [
          { value: 'today', label: t('pause.horizon_today') },
          { value: 'days', label: t('pause.horizon_days') },
          { value: 'weeks', label: t('pause.horizon_weeks') },
        ],
      },
      {
        id: 'max_loss',
        type: 'max_loss',
        qid: 'max_loss',
        title: t('pause.max_loss_title'),
        answerType: 'number',
      },
    ];

    // Signal-linked reflection cards
    const signalReflectionCards: ReflectionCardDef[] = [];
    const firedIds = signals.filter(s => s.fired).map(s => s.id);

    if (firedIds.includes('late_night')) {
      signalReflectionCards.push({
        id: 'q_morning',
        type: 'signal',
        qid: 'q_morning',
        questionText: t('pause.q_morning'),
        answerType: 'chips',
        options: [
          { value: 'yes', label: t('pause.chip_yes') },
          { value: 'no', label: t('pause.chip_no') },
          { value: 'unsure', label: t('pause.chip_unsure') },
        ],
      });
    }

    if (firedIds.includes('quick_reentry_after_loss') || firedIds.includes('loss_streak')) {
      signalReflectionCards.push({
        id: 'q_revenge',
        type: 'signal',
        qid: 'q_revenge',
        questionText: t('pause.q_revenge'),
        answerType: 'chips',
        options: [
          { value: 'win_back', label: t('pause.chip_win_back') },
          { value: 'fresh_reason', label: t('pause.chip_fresh_reason') },
          { value: 'unsure', label: t('pause.chip_unsure') },
        ],
      });
    }

    if (firedIds.includes('risky_funding')) {
      signalReflectionCards.push({
        id: 'q_money',
        type: 'signal',
        qid: 'q_money',
        questionText: t('pause.q_money'),
        answerType: 'text',
      });
    }

    if (firedIds.includes('many_trades_today')) {
      signalReflectionCards.push({
        id: 'q_count',
        type: 'signal',
        qid: 'q_count',
        questionText: t('pause.q_count'),
        answerType: 'text',
      });
    }

    if (firedIds.includes('size_escalation')) {
      signalReflectionCards.push({
        id: 'q_size',
        type: 'signal',
        qid: 'q_size',
        questionText: t('pause.q_size'),
        answerType: 'text',
      });
    }

    // Mirror card from Journal
    let mirrorCard: ReflectionCardDef | null = null;
    const allDecisions = await db.decisions.toArray();
    const reflected = allDecisions.filter(d => d.reflection || d.feeling);
    if (reflected.length > 0) {
      // Prefer regret, else latest
      const regretDecision = reflected.find(d => d.feeling === 'regret');
      const chosen = regretDecision || reflected[reflected.length - 1];
      const dateStr = format(new Date(chosen.ts), 'dd MMM');
      mirrorCard = {
        id: 'mirror_past',
        type: 'mirror',
        extraData: {
          date: dateStr,
          why: chosen.why,
          feeling: chosen.feeling ? t(`journal.feel_${chosen.feeling}`) : '',
        },
      };
    }

    // Rule card
    let ruleCard: ReflectionCardDef | null = null;
    const allRules = await db.rules.toArray();
    if (allRules.length > 0) {
      const randomRule = allRules[Math.floor(Math.random() * allRules.length)];
      ruleCard = {
        id: 'user_rule',
        type: 'rule',
        extraData: { ruleText: randomRule.text },
      };
    }

    // General cards
    const generalCards: ReflectionCardDef[] = [
      {
        id: 'q_plan_or_reaction',
        type: 'general',
        qid: 'q_plan_or_reaction',
        questionText: t('pause.q_plan_or_reaction'),
        answerType: 'chips',
        options: [
          { value: 'plan', label: t('pause.chip_plan') },
          { value: 'reaction', label: t('pause.chip_reaction') },
          { value: 'unsure', label: t('pause.chip_unsure') },
        ],
      },
      {
        id: 'q_friend',
        type: 'general',
        qid: 'q_friend',
        questionText: t('pause.q_friend'),
        answerType: 'text',
      },
      {
        id: 'q_week',
        type: 'general',
        qid: 'q_week',
        questionText: t('pause.q_week'),
        answerType: 'chips',
        options: [
          { value: 'yes', label: t('pause.chip_yes') },
          { value: 'no', label: t('pause.chip_no') },
          { value: 'unsure', label: t('pause.chip_unsure') },
        ],
      },
      {
        id: 'q_source',
        type: 'general',
        qid: 'q_source',
        questionText: t('pause.q_source'),
        answerType: 'chips',
        options: [
          { value: 'study', label: t('pause.chip_study') },
          { value: 'friend', label: t('pause.chip_friend_source') },
          { value: 'social', label: t('pause.chip_social_source') },
          { value: 'unsure', label: t('pause.chip_unsure') },
        ],
      },
    ];

    // Body card
    const bodyCard: ReflectionCardDef = {
      id: 'body_card',
      type: 'body',
      questionText: t('pause.body_card_text'),
    };

    // Combine in the exact required order:
    // BreathCard is already added first
    if (level === 'calm') {
      cardList.push(...coreCards);
      cardList.push(bodyCard);
    } else {
      // In caution and high:
      // Order: SignalCards, MirrorCard, RuleCard, CoreCards (Why, Horizon, MaxLoss), GeneralCards, BodyCard
      const reflectionSequence: ReflectionCardDef[] = [
        ...signalReflectionCards,
        ...(mirrorCard ? [mirrorCard] : []),
        ...(ruleCard ? [ruleCard] : []),
        ...coreCards,
        ...generalCards,
        bodyCard,
      ];
      cardList.push(...reflectionSequence);
    }

    setCards(cardList);
    setCardIndex(0);
    setScreen(3);
  };

  const handleSetReflectionAnswer = (qid: string, val: string) => {
    setReflections(prev => ({ ...prev, [qid]: val }));
    if (qid === 'why') setWhy(val);
    if (qid === 'horizon') setHorizon(val as Horizon);
    if (qid === 'max_loss') setMaxLossStr(val);
  };

  const handleDecision = async (outcome: Outcome) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSaveError(null);
    setFinalOutcome(outcome);

    try {
      const now = Date.now();
      const amount = getEffectiveAmount();
      const maxLoss = Number(maxLossStr) || 0;
      const firedSignalIds = signals.filter(s => s.fired).map(s => s.id);

      const reflectionList: ReflectionAnswer[] = Object.entries(reflections).map(
        ([qid, answer]) => ({ qid, answer })
      );

      const decisionRecord = {
        ts: now,
        why,
        horizon,
        funding,
        amount,
        maxLoss,
        level,
        firedSignals: firedSignalIds,
        outcome,
        reflections: reflectionList,
        triggers,
        mode,
      };

      await db.decisions.add(decisionRecord);

      if (outcome === 'proceeded' && amount > 0) {
        if (mode === 'practice') {
          await db.practiceTrades.add({
            sessionId,
            ts: now,
            amount,
            pnl: null,
            funding,
          });
        } else {
          await db.trades.add({
            ts: now,
            amount,
            pnl: null,
            funding,
          });
        }
      }

      triggerVibrate();
      setScreen(5); // Confirmation
    } catch (err) {
      setSaveError(t('practice.save_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const firedSignals = signals.filter(s => s.fired);
  const currentCard = cards[cardIndex];

  return (
    <div className="min-h-[calc(100vh-140px)] max-w-md mx-auto p-4 pb-20 flex flex-col justify-between">
      {/* Practice Mode Banner */}
      {mode === 'practice' && (
        <div className="bg-amber-950/60 border border-saffron/60 text-saffron p-3 rounded-2xl text-xs font-semibold mb-3 text-center">
          {t('pause.practice_banner')}
        </div>
      )}

      {/* SCREEN 1: Quick Check (2 taps, one screen) */}
      {screen === 1 && (
        <div className="my-auto space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-cream">
              {t('pause.quick_check_title')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {t('pause.amount_label')}
            </p>
          </div>

          {/* Amount Chips */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {(['500', '1000', '5000', 'other'] as const).map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountType(amt)}
                  className={`min-h-[48px] py-2 px-1 rounded-xl text-sm font-bold transition-all ${
                    amountType === amt
                      ? 'bg-saffron text-navy shadow-md'
                      : 'bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {amt === 'other' ? t('pause.amount_other') : `₹${Number(amt).toLocaleString('en-IN')}`}
                </button>
              ))}
            </div>

            {amountType === 'other' && (
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                placeholder={t('pause.amount_other_placeholder')}
                className="w-full text-lg min-h-[48px] p-3 rounded-xl bg-slate-900 border-2 border-slate-700 text-cream focus:border-saffron focus:outline-none"
              />
            )}
          </div>

          {/* Money Source Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">
              {t('pause.q_funding')}
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setFunding('savings')}
                className={`min-h-[50px] p-3 rounded-xl text-sm font-bold text-left px-4 transition-all flex items-center justify-between ${
                  funding === 'savings'
                    ? 'bg-saffron text-navy shadow-md'
                    : 'bg-slate-800 text-cream border border-slate-700 hover:border-slate-500'
                }`}
              >
                <span>{t('pause.funding_savings')}</span>
                {funding === 'savings' && <span>✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setFunding('emergency')}
                className={`min-h-[50px] p-3 rounded-xl text-sm font-bold text-left px-4 transition-all flex items-center justify-between ${
                  funding === 'emergency'
                    ? 'bg-saffron text-navy shadow-md'
                    : 'bg-slate-800 text-cream border border-slate-700 hover:border-slate-500'
                }`}
              >
                <span>{t('pause.funding_emergency')}</span>
                {funding === 'emergency' && <span>✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setFunding('loan')}
                className={`min-h-[50px] p-3 rounded-xl text-sm font-bold text-left px-4 transition-all flex items-center justify-between ${
                  funding === 'loan'
                    ? 'bg-saffron text-navy shadow-md'
                    : 'bg-slate-800 text-cream border border-slate-700 hover:border-slate-500'
                }`}
              >
                <span>{t('pause.funding_loan')}</span>
                {funding === 'loan' && <span>✓</span>}
              </button>
            </div>
          </div>

          {/* Optional: Last Trade? */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3.5 space-y-2.5">
            <span className="text-xs font-semibold text-slate-400">
              {t('pause.last_trade_prompt')}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLastTradeResult('loss')}
                className={`min-h-[48px] py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  lastTradeResult === 'loss'
                    ? 'bg-rukoRed text-cream shadow-sm'
                    : 'bg-slate-900 text-slate-300 border border-slate-700'
                }`}
              >
                {t('pause.last_trade_loss')}
              </button>
              <button
                type="button"
                onClick={() => setLastTradeResult('profit')}
                className={`min-h-[48px] py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  lastTradeResult === 'profit'
                    ? 'bg-rukoGreen text-navy shadow-sm'
                    : 'bg-slate-900 text-slate-300 border border-slate-700'
                }`}
              >
                {t('pause.last_trade_profit')}
              </button>
              <button
                type="button"
                onClick={() => setLastTradeResult('none')}
                className={`min-h-[48px] py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  lastTradeResult === 'none'
                    ? 'bg-slate-700 text-cream shadow-sm'
                    : 'bg-slate-900 text-slate-300 border border-slate-700'
                }`}
              >
                {t('pause.last_trade_none')}
              </button>
            </div>

            {lastTradeResult !== 'none' && (
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setLastTradeTime('just_now')}
                  className={`min-h-[48px] py-1 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                    lastTradeTime === 'just_now'
                      ? 'bg-saffron/30 text-saffron border border-saffron'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800'
                  }`}
                >
                  {t('pause.timing_just_now')}
                </button>
                <button
                  type="button"
                  onClick={() => setLastTradeTime('30m')}
                  className={`min-h-[40px] py-1 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                    lastTradeTime === '30m'
                      ? 'bg-saffron/30 text-saffron border border-saffron'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800'
                  }`}
                >
                  {t('pause.timing_30m')}
                </button>
                <button
                  type="button"
                  onClick={() => setLastTradeTime('hours')}
                  className={`min-h-[40px] py-1 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                    lastTradeTime === 'hours'
                      ? 'bg-saffron/30 text-saffron border border-saffron'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800'
                  }`}
                >
                  {t('pause.timing_hours')}
                </button>
              </div>
            )}
          </div>

          <BigButton
            onClick={() => setScreen(2)}
            disabled={getEffectiveAmount() <= 0}
          >
            {t('pause.next')}
          </BigButton>
        </div>
      )}

      {/* SCREEN 2: Pressure Check */}
      {screen === 2 && (
        <div className="my-auto space-y-5 py-2">
          {/* Level Chip */}
          <div className="flex items-center justify-center">
            <span
              className={`px-5 py-2 rounded-full text-sm font-bold tracking-wide uppercase shadow-sm ${
                level === 'high'
                  ? 'bg-rukoRed/20 text-rukoRed border-2 border-rukoRed'
                  : level === 'caution'
                  ? 'bg-saffron/20 text-saffron border-2 border-saffron'
                  : 'bg-rukoGreen/20 text-rukoGreen border-2 border-rukoGreen'
              }`}
            >
              {t(`levels.${level}`)}
            </span>
          </div>

          {/* Fired Signals Cards */}
          <div className="space-y-2">
            {firedSignals.length > 0 ? (
              firedSignals.map(sig => (
                <SignalCard key={sig.id} signal={sig} />
              ))
            ) : (
              <div className="bg-slate-800/80 border-l-4 border-rukoGreen rounded-r-xl p-4 text-cream font-medium">
                {t('signals.none')}
              </div>
            )}
          </div>

          {/* Mirror Disclaimer */}
          <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 text-center">
            <p className="text-sm font-medium text-slate-300">
              {t('pause.mirror_disclaimer')}
            </p>
          </div>

          <BigButton onClick={prepareScreen3}>
            {t('pause.next')}
          </BigButton>
        </div>
      )}

      {/* SCREEN 3: Reflection Wait (The heart of v2) */}
      {screen === 3 && (
        <div className="flex-1 flex flex-col justify-between py-2 space-y-4">
          {/* Header Progress Bar & Step info */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>
                {cardIndex + 1} / {cards.length}
              </span>
              <span className="text-slate-400 text-xs font-medium">
                {currentCard?.type === 'breath'
                  ? t('pause.breathe_in')
                  : t('pause.mindful_reflection')}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-saffron transition-all duration-300 ease-out"
                style={{
                  width: `${cards.length > 0 ? ((cardIndex + 1) / cards.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Reflection Card Display */}
          <div className="my-auto">
            {currentCard && (
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4 min-h-[260px] flex flex-col justify-between">
                {/* Card Top: Speaker */}
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleSpeak(
                          currentCard.questionText ||
                            currentCard.title ||
                            (currentCard.extraData ? currentCard.extraData.ruleText : '')
                        )
                      }
                      className="min-h-[40px] min-w-[40px] p-2 rounded-full text-saffron hover:bg-slate-700 text-base"
                      aria-label="Speak card"
                    >
                      🔊
                    </button>
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                      {currentCard.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {cardIndex + 1} / {cards.length}
                  </span>
                </div>

                {/* Card Content based on type */}
                <div className="my-auto py-2">
                  {currentCard.type === 'breath' && (
                    <div className="text-center space-y-2">
                      <BreathingCircle />
                    </div>
                  )}

                  {currentCard.type === 'why' && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold text-cream">
                        {t('pause.why_card_title')}
                      </h3>
                      <div className="relative">
                        <textarea
                          rows={3}
                          value={why}
                          onChange={e => handleSetReflectionAnswer('why', e.target.value)}
                          placeholder={t('pause.why_placeholder')}
                          className="w-full text-base p-3 rounded-xl bg-slate-900 border border-slate-700 text-cream focus:border-saffron focus:outline-none"
                        />
                        <div className="absolute right-2 bottom-2">
                          <MicButton
                            onTranscript={text =>
                              handleSetReflectionAnswer('why', why ? `${why} ${text}` : text)
                            }
                          />
                        </div>
                      </div>
                      {why.trim().length >= 3 && (
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              analyzeWhyIfSubmitted(why);
                              setCardIndex(prev => Math.min(cards.length - 1, prev + 1));
                            }}
                            className="px-4 py-2 bg-saffron text-navy rounded-xl font-bold text-xs shadow-md hover:bg-[#e09430] active:scale-95 transition-all"
                          >
                            {t('pause.save_why_and_next')} →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {currentCard.type === 'horizon' && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold text-cream">
                        {t('pause.q_horizon')}
                      </h3>
                      <div className="space-y-2">
                        {currentCard.options?.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSetReflectionAnswer('horizon', opt.value)}
                            className={`w-full min-h-[46px] p-2.5 rounded-xl text-sm font-bold text-left px-4 transition-all ${
                              horizon === opt.value
                                ? 'bg-saffron text-navy shadow-md'
                                : 'bg-slate-900 text-cream border border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentCard.type === 'max_loss' && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold text-cream">
                        {t('pause.max_loss_title')}
                      </h3>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={maxLossStr}
                        onChange={e => handleSetReflectionAnswer('max_loss', e.target.value)}
                        placeholder={t('pause.loss_placeholder')}
                        className="w-full text-xl min-h-[48px] p-3 rounded-xl bg-slate-900 border-2 border-slate-700 text-cream focus:border-saffron focus:outline-none"
                      />
                    </div>
                  )}

                  {(currentCard.type === 'signal' || currentCard.type === 'general') && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold text-cream">
                        {currentCard.questionText}
                      </h3>

                      {currentCard.answerType === 'chips' && currentCard.options && (
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {currentCard.options.map(opt => {
                            const isSelected =
                              currentCard.qid && reflections[currentCard.qid] === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                  currentCard.qid &&
                                  handleSetReflectionAnswer(currentCard.qid, opt.value)
                                }
                                className={`min-h-[46px] p-2.5 rounded-xl text-sm font-bold text-left px-4 transition-all ${
                                  isSelected
                                    ? 'bg-saffron text-navy shadow-md'
                                    : 'bg-slate-900 text-cream border border-slate-700 hover:border-slate-500'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {currentCard.answerType === 'text' && (
                        <div className="relative pt-1">
                          <textarea
                            rows={3}
                            value={currentCard.qid ? reflections[currentCard.qid] || '' : ''}
                            onChange={e =>
                              currentCard.qid &&
                              handleSetReflectionAnswer(currentCard.qid, e.target.value)
                            }
                            placeholder={t('pause.why_placeholder')}
                            className="w-full text-base p-3 rounded-xl bg-slate-900 border border-slate-700 text-cream focus:border-saffron focus:outline-none"
                          />
                          <div className="absolute right-2 bottom-2">
                            <MicButton
                              onTranscript={text => {
                                if (currentCard.qid) {
                                  const prev = reflections[currentCard.qid] || '';
                                  handleSetReflectionAnswer(
                                    currentCard.qid,
                                    prev ? `${prev} ${text}` : text
                                  );
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {currentCard.type === 'mirror' && currentCard.extraData && (
                    <div className="space-y-3">
                      <span className="text-xs uppercase font-bold text-saffron tracking-wider">
                        {t('mirror.title')}
                      </span>
                      <p className="text-base text-cream leading-relaxed italic">
                        {t('pause.mirror_card_text', {
                          date: currentCard.extraData.date,
                          why: currentCard.extraData.why,
                          feeling: currentCard.extraData.feeling,
                        })}
                      </p>
                    </div>
                  )}

                  {currentCard.type === 'rule' && currentCard.extraData && (
                    <div className="space-y-2">
                      <span className="text-xs uppercase font-bold text-saffron tracking-wider">
                        {t('pause.your_rule')}
                      </span>
                      <p className="text-lg font-bold text-cream">
                        "{currentCard.extraData.ruleText}"
                      </p>
                    </div>
                  )}

                  {currentCard.type === 'body' && (
                    <div className="text-center space-y-3 py-4">
                      <div className="text-3xl">🧘‍♂️</div>
                      <p className="text-lg font-bold text-cream">
                        {currentCard.questionText}
                      </p>
                    </div>
                  )}

                  {currentCard.type === 'ai_trigger' && (
                    <div className="space-y-3 py-2">
                      <AIBadge isAI={Boolean(currentCard.extraData?.isAI)} />
                      <p className="text-base font-semibold text-cream leading-relaxed">
                        {currentCard.title}
                      </p>
                    </div>
                  )}

                  {currentCard.type === 'ai_question' && (
                    <div className="space-y-3">
                      <AIBadge isAI={Boolean(currentCard.extraData?.isAI)} />
                      <h3 className="text-lg font-bold text-cream">
                        {currentCard.questionText}
                      </h3>
                      <div className="relative pt-1">
                        <textarea
                          rows={3}
                          value={reflections[currentCard.qid || 'personalized_q'] || ''}
                          onChange={e =>
                            handleSetReflectionAnswer(
                              currentCard.qid || 'personalized_q',
                              e.target.value
                            )
                          }
                          placeholder={t('pause.why_placeholder')}
                          className="w-full text-base p-3 rounded-xl bg-slate-900 border border-slate-700 text-cream focus:border-saffron focus:outline-none"
                        />
                        <div className="absolute right-2 bottom-2">
                          <MicButton
                            onTranscript={text => {
                              const qid = currentCard.qid || 'personalized_q';
                              const prev = reflections[qid] || '';
                              handleSetReflectionAnswer(qid, prev ? `${prev} ${text}` : text);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Bottom Nav */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
                  <button
                    type="button"
                    disabled={cardIndex === 0}
                    onClick={() => setCardIndex(prev => Math.max(0, prev - 1))}
                    className="min-h-[40px] px-3 py-1 rounded-xl text-slate-400 hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ← {t('pause.prev_card')}
                  </button>

                  <span className="text-slate-500 font-mono">
                    {cardIndex + 1} of {cards.length}
                  </span>

                  <button
                    type="button"
                    disabled={cardIndex === cards.length - 1}
                    onClick={() => {
                      if (currentCard.type === 'why') {
                        analyzeWhyIfSubmitted(why);
                      }
                      setCardIndex(prev => Math.min(cards.length - 1, prev + 1));
                    }}
                    className="min-h-[40px] px-3 py-1 rounded-xl text-saffron hover:underline font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {t('pause.next_card')} →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-2 space-y-2">
            <BigButton
              variant="primary"
              onClick={() => {
                if (currentCard?.type === 'why') {
                  analyzeWhyIfSubmitted(why);
                }
                if (cardIndex < cards.length - 1) {
                  setCardIndex(prev => prev + 1);
                } else {
                  setScreen(4);
                }
              }}
            >
              {cardIndex < cards.length - 1 ? `${t('pause.next')} →` : t('pause.next')}
            </BigButton>

            {cardIndex < cards.length - 1 && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (currentCard?.type === 'why') {
                      analyzeWhyIfSubmitted(why);
                    }
                    setScreen(4);
                  }}
                  className="text-xs text-slate-400 hover:text-cream underline py-1"
                >
                  {t('pause.skip_to_decide', 'Go to Decide')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCREEN 4: Decide */}
      {screen === 4 && (
        <div className="my-auto space-y-6">
          {/* Compact Recap */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-md space-y-3">
            <h3 className="text-xs uppercase font-bold text-saffron tracking-wider">
              {t('pause.recap_title')}
            </h3>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">{t('pause.q_why')}</span>
                <span className="font-semibold text-cream">
                  {why.trim() ? `"${why}"` : <span className="text-rukoRed italic">Required</span>}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
                <div>
                  <span className="text-xs text-slate-400 block">{t('pause.horizon_label')}</span>
                  <span className="font-medium text-cream capitalize">
                    {t(`pause.horizon_${horizon}`)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">{t('pause.max_loss_label')}</span>
                  <span className="font-mono font-medium text-cream">
                    ₹{Number(maxLossStr || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* In-place why editor if less than 3 chars */}
            {why.trim().length < 3 && (
              <div className="pt-2">
                <p className="text-xs text-rukoRed font-semibold mb-1">
                  {t('pause.why_min_chars_prompt')}
                </p>
                <div className="relative">
                  <input
                    type="text"
                    value={why}
                    onChange={e => handleSetReflectionAnswer('why', e.target.value)}
                    placeholder={t('pause.why_placeholder')}
                    className="w-full text-sm min-h-[44px] p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-cream focus:border-saffron focus:outline-none"
                  />
                  <div className="absolute right-1 bottom-1">
                    <MicButton
                      onTranscript={text =>
                        handleSetReflectionAnswer('why', why ? `${why} ${text}` : text)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons: Abandon, Delay, Proceed */}
          <div className="space-y-3 pt-2">
            <BigButton
              variant="danger"
              disabled={why.trim().length < 3 || isSubmitting}
              onClick={() => handleDecision('abandoned')}
            >
              {t('pause.btn_abandon')}
            </BigButton>

            <BigButton
              variant="secondary"
              disabled={why.trim().length < 3 || isSubmitting}
              onClick={() => handleDecision('delayed')}
            >
              {t('pause.btn_delay')}
            </BigButton>

            <div className="pt-1 text-center">
              <button
                type="button"
                disabled={why.trim().length < 3 || isSubmitting}
                onClick={() => handleDecision('proceeded')}
                className={`min-h-[44px] px-4 py-2 text-sm font-medium transition-all ${
                  why.trim().length < 3 || isSubmitting
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-cream underline'
                }`}
              >
                {t('pause.btn_proceed')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 5: Confirmation */}
      {screen === 5 && (
        <div className="my-auto space-y-6 text-center py-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-rukoGreen/20 border-4 border-rukoGreen flex items-center justify-center text-rukoGreen text-3xl">
            ✓
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-cream">
              {t('pause.recorded_title')}
            </h2>
            {(finalOutcome === 'abandoned' || finalOutcome === 'delayed') && (
              <p className="text-sm font-medium text-saffron max-w-xs mx-auto leading-relaxed">
                {t('pause.courage_quote')}
              </p>
            )}
          </div>

          <BigButton
            variant="primary"
            onClick={() => {
              if (onComplete) {
                onComplete(finalOutcome);
              } else {
                navigate('/');
              }
            }}
          >
            {mode === 'practice'
              ? t('pause.back_practice')
              : t('pause.back_home')}
          </BigButton>
        </div>
      )}
    </div>
  );
};
