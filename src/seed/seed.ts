import { db, clearAll } from '../db';
import type { Trade, Decision, Rule, PracticeSession, PracticeTrade } from '../types';

export async function seed(): Promise<void> {
  await clearAll();

  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  // Insert 2 initial personal rules
  const rules: Rule[] = [
    { text: 'मैं हर घाटे के बाद 30 मिनट रुकता हूँ।' },
    { text: 'मैं इमरजेंसी या लोन के पैसे से ट्रेड नहीं करता।' },
  ];
  await db.rules.bulkAdd(rules);

  // Day -1 (yesterday) at 22:00 local time
  const yesterday = new Date(now - ONE_DAY);
  yesterday.setHours(22, 10, 0, 0);
  const yBase = yesterday.getTime();

  // 24 trades total
  // Day -1: 4 trades after 10 pm: a loss, a loss, a bigger loss with loan, and a larger-size trade
  const eveningTrades: Trade[] = [
    {
      ts: yBase, // 22:10
      amount: 5000,
      pnl: -1200,
      funding: 'savings',
    },
    {
      ts: yBase + 15 * 60 * 1000, // 22:25
      amount: 8000,
      pnl: -2400,
      funding: 'savings',
    },
    {
      ts: yBase + 35 * 60 * 1000, // 22:45
      amount: 15000,
      pnl: -6000,
      funding: 'loan',
    },
    {
      ts: yBase + 55 * 60 * 1000, // 23:05
      amount: 30000,
      pnl: null,
      funding: 'loan',
    },
  ];

  // 20 earlier trades spread over days -2 through -6
  const pastTrades: Trade[] = [
    // Day -2
    { ts: now - 2 * ONE_DAY - 3 * ONE_HOUR, amount: 6000, pnl: 1200, funding: 'savings' },
    { ts: now - 2 * ONE_DAY - 1 * ONE_HOUR, amount: 7000, pnl: -800, funding: 'savings' },
    { ts: now - 2 * ONE_DAY + 2 * ONE_HOUR, amount: 9000, pnl: 1500, funding: 'savings' },
    { ts: now - 2 * ONE_DAY + 4 * ONE_HOUR, amount: 10000, pnl: -2000, funding: 'loan' },

    // Day -3
    { ts: now - 3 * ONE_DAY - 5 * ONE_HOUR, amount: 5000, pnl: 900, funding: 'savings' },
    { ts: now - 3 * ONE_DAY - 2 * ONE_HOUR, amount: 4500, pnl: -600, funding: 'savings' },
    { ts: now - 3 * ONE_DAY + 1 * ONE_HOUR, amount: 8000, pnl: 1100, funding: 'emergency' },
    { ts: now - 3 * ONE_DAY + 3 * ONE_HOUR, amount: 6500, pnl: -1400, funding: 'savings' },

    // Day -4
    { ts: now - 4 * ONE_DAY - 4 * ONE_HOUR, amount: 4000, pnl: 800, funding: 'savings' },
    { ts: now - 4 * ONE_DAY - 1 * ONE_HOUR, amount: 5500, pnl: -1100, funding: 'savings' },
    { ts: now - 4 * ONE_DAY + 2 * ONE_HOUR, amount: 12000, pnl: -3000, funding: 'loan' },
    { ts: now - 4 * ONE_DAY + 5 * ONE_HOUR, amount: 7000, pnl: 1400, funding: 'savings' },

    // Day -5
    { ts: now - 5 * ONE_DAY - 3 * ONE_HOUR, amount: 3500, pnl: 700, funding: 'savings' },
    { ts: now - 5 * ONE_DAY + 1 * ONE_HOUR, amount: 5000, pnl: -900, funding: 'savings' },
    { ts: now - 5 * ONE_DAY + 4 * ONE_HOUR, amount: 6000, pnl: 1300, funding: 'savings' },
    { ts: now - 5 * ONE_DAY + 6 * ONE_HOUR, amount: 8000, pnl: -1500, funding: 'emergency' },

    // Day -6
    { ts: now - 6 * ONE_DAY - 4 * ONE_HOUR, amount: 5000, pnl: 1000, funding: 'savings' },
    { ts: now - 6 * ONE_DAY - 2 * ONE_HOUR, amount: 4000, pnl: -500, funding: 'savings' },
    { ts: now - 6 * ONE_DAY + 1 * ONE_HOUR, amount: 7500, pnl: 1600, funding: 'savings' },
    { ts: now - 6 * ONE_DAY + 3 * ONE_HOUR, amount: 9000, pnl: null, funding: 'savings' },
  ];

  const allTrades = [...pastTrades, ...eveningTrades];
  await db.trades.bulkAdd(allTrades);

  // Real decisions across the week
  const decisions: Decision[] = [
    // Yesterday night 1 (High, loan, proceeded, NO reflection)
    {
      ts: yBase + 40 * 60 * 1000,
      why: 'पिछला घाटा निकालना है',
      horizon: 'today',
      funding: 'loan',
      maxLoss: 5000,
      amount: 15000,
      level: 'high',
      firedSignals: ['late_night', 'quick_reentry_after_loss', 'risky_funding'],
      outcome: 'proceeded',
      mode: 'real',
      triggers: [{ type: 'revenge', evidence: 'पिछला घाटा निकालना है' }],
      reflections: [
        { qid: 'q_revenge', answer: 'हाँ' },
      ],
    },
    // Yesterday night 2 (High, loan, abandoned, NO reflection)
    {
      ts: yBase + 50 * 60 * 1000,
      why: 'सब लोग इसी में पैसा बना रहे हैं',
      horizon: 'today',
      funding: 'loan',
      maxLoss: 10000,
      amount: 30000,
      level: 'high',
      firedSignals: ['late_night', 'size_escalation', 'risky_funding', 'many_trades_today'],
      outcome: 'abandoned',
      mode: 'real',
      triggers: [{ type: 'fomo', evidence: 'सब लोग इसी में पैसा बना रहे हैं' }],
      reflections: [
        { qid: 'q_morning', answer: 'नहीं' },
        { qid: 'q_friend', answer: 'रुकने की सलाह देता' },
      ],
    },
    // Day -2: Calm planned trade
    {
      ts: now - 2 * ONE_DAY - 2 * ONE_HOUR,
      why: 'लंबे समय के लिए रखना है',
      horizon: 'weeks',
      funding: 'savings',
      maxLoss: 1000,
      amount: 7000,
      level: 'calm',
      firedSignals: [],
      outcome: 'proceeded',
      reflection: 'अच्छा फैसला था, धैर्य रखा।',
      feeling: 'calm',
      mode: 'real',
    },
    // Day -3: Caution trade with loan
    {
      ts: now - 3 * ONE_DAY,
      why: 'घाटा कवर करना था',
      horizon: 'today',
      funding: 'loan',
      maxLoss: 3000,
      amount: 10000,
      level: 'caution',
      firedSignals: ['risky_funding'],
      outcome: 'delayed',
      reflection: 'रुकने का फायदा हुआ, नुकसान से बचे।',
      feeling: 'calm',
      mode: 'real',
      triggers: [{ type: 'revenge', evidence: 'घाटा कवर करना था' }],
    },
    // Day -4: Calm planned trade
    {
      ts: now - 4 * ONE_DAY,
      why: 'शांति से सोच समझकर बनाया प्लान',
      horizon: 'weeks',
      funding: 'savings',
      maxLoss: 800,
      amount: 4000,
      level: 'calm',
      firedSignals: [],
      outcome: 'proceeded',
      reflection: 'प्लान के अनुसार चला।',
      feeling: 'calm',
      mode: 'real',
    },
    // Day -5: Impulsive trade abandoned
    {
      ts: now - 5 * ONE_DAY,
      why: 'दोस्तों ने कहा बहुत बढ़िया मौका है',
      horizon: 'today',
      funding: 'emergency',
      maxLoss: 2500,
      amount: 8000,
      level: 'caution',
      firedSignals: ['risky_funding'],
      outcome: 'abandoned',
      reflection: 'FOMO में था, नहीं लिया तो बेहतर रहा।',
      feeling: 'calm',
      mode: 'real',
      triggers: [{ type: 'fomo', evidence: 'दोस्तों ने कहा बहुत बढ़िया मौका है' }],
    },
    // Day -6: High pressure trade delayed
    {
      ts: now - 6 * ONE_DAY,
      why: 'मार्केट ऊपर जा रहा है',
      horizon: 'days',
      funding: 'savings',
      maxLoss: 2000,
      amount: 7500,
      level: 'caution',
      firedSignals: ['quick_reentry_after_loss'],
      outcome: 'delayed',
      reflection: 'थोड़ी देर बाद दिमाग ठंडा हुआ।',
      feeling: 'calm',
      mode: 'real',
    },
    // Day -6 evening: High pressure trade proceeded with regret
    {
      ts: now - 6 * ONE_DAY + 2 * ONE_HOUR,
      why: 'जल्दबाज़ी में लगा कि छूटेगा',
      horizon: 'today',
      funding: 'savings',
      maxLoss: 4000,
      amount: 9000,
      level: 'high',
      firedSignals: ['many_trades_today', 'loss_streak', 'size_escalation'],
      outcome: 'proceeded',
      reflection: 'जल्दबाज़ी में ट्रेड नहीं करना चाहिए था।',
      feeling: 'regret',
      mode: 'real',
      triggers: [{ type: 'fomo', evidence: 'जल्दबाज़ी में लगा कि छूटेगा' }],
    },
  ];

  await db.decisions.bulkAdd(decisions);

  // 3 Practice Sessions: 1 pause ON, 2 pause OFF
  const s1Start = now - 2 * ONE_DAY + 10 * ONE_HOUR;
  const s1Id = await db.sessions.add({
    startedAt: s1Start,
    endedAt: s1Start + 22 * 60 * 1000,
    scenario: 'volatile',
    pauseEnabled: true,
    tradesOpened: 3,
    tradesAfterLoss: 0,
    sizeIncreasePercent: 25,
    maxDrawdownPercent: 6.4,
    finalPnl: -1200,
    pausesTaken: 4,
    abandonedOrDelayed: 1,
    observedSignals: ['size_escalation'],
    selfReflection: 'Pause helped me step back from one oversized entry. Felt calmer overall.',
  } as PracticeSession) as number;

  const s2Start = now - 3 * ONE_DAY + 14 * ONE_HOUR;
  const s2Id = await db.sessions.add({
    startedAt: s2Start,
    endedAt: s2Start + 16 * 60 * 1000,
    scenario: 'crash',
    pauseEnabled: false,
    tradesOpened: 5,
    tradesAfterLoss: 3,
    sizeIncreasePercent: 150,
    maxDrawdownPercent: 18.2,
    finalPnl: -8500,
    pausesTaken: 0,
    abandonedOrDelayed: 0,
    observedSignals: ['quick_reentry_after_loss', 'size_escalation'],
    selfReflection: 'Without pause, I entered repeatedly after every drop trying to catch the bottom. Ended up with a large loss.',
  } as PracticeSession) as number;

  const s3Start = now - 4 * ONE_DAY + 22 * ONE_HOUR;
  const s3Id = await db.sessions.add({
    startedAt: s3Start,
    endedAt: s3Start + 26 * 60 * 1000,
    scenario: 'late_night',
    pauseEnabled: false,
    tradesOpened: 6,
    tradesAfterLoss: 2,
    sizeIncreasePercent: 100,
    maxDrawdownPercent: 14.5,
    finalPnl: -6400,
    pausesTaken: 0,
    abandonedOrDelayed: 0,
    observedSignals: ['late_night', 'quick_reentry_after_loss', 'loss_streak'],
    selfReflection: 'Late night fatigue made me impulsive. Fired 6 positions in 20 minutes.',
  } as PracticeSession) as number;

  // Add Practice Trades linked to these sessions
  const practiceTrades: PracticeTrade[] = [
    // Session 1 trades
    {
      sessionId: s1Id,
      ts: s1Start + 2 * 60 * 1000,
      amount: 10000,
      pnl: 600,
      funding: 'savings',
      instrument: 'Demo Index',
      entryPrice: 100,
      closePrice: 106,
      leverage: 1,
    },
    {
      sessionId: s1Id,
      ts: s1Start + 8 * 60 * 1000,
      amount: 10000,
      pnl: -1800,
      funding: 'savings',
      instrument: 'Demo Co. A',
      entryPrice: 105,
      closePrice: 87,
      leverage: 1,
    },
    // Session 2 trades
    {
      sessionId: s2Id,
      ts: s2Start + 3 * 60 * 1000,
      amount: 10000,
      pnl: -2000,
      funding: 'savings',
      instrument: 'Demo Index',
      entryPrice: 108,
      closePrice: 88,
      leverage: 1,
    },
    {
      sessionId: s2Id,
      ts: s2Start + 5 * 60 * 1000,
      amount: 25000,
      pnl: -6500,
      funding: 'savings',
      instrument: 'Demo Futures (5x)',
      entryPrice: 95,
      closePrice: 80,
      leverage: 5,
    },
    // Session 3 trades
    {
      sessionId: s3Id,
      ts: s3Start + 4 * 60 * 1000,
      amount: 10000,
      pnl: -2400,
      funding: 'savings',
      instrument: 'Demo Co. B',
      entryPrice: 102,
      closePrice: 86,
      leverage: 1,
    },
    {
      sessionId: s3Id,
      ts: s3Start + 7 * 60 * 1000,
      amount: 20000,
      pnl: -4000,
      funding: 'savings',
      instrument: 'Demo Futures (5x)',
      entryPrice: 90,
      closePrice: 72,
      leverage: 5,
    },
  ];

  await db.practiceTrades.bulkAdd(practiceTrades);

  // Add a few Practice Mode Decisions
  const practiceDecisions: Decision[] = [
    {
      ts: s1Start + 12 * 60 * 1000,
      why: 'आवेग में आकर बड़ा ट्रेड लेने का मन था',
      horizon: 'today',
      funding: 'savings',
      amount: 25000,
      maxLoss: 5000,
      level: 'high',
      firedSignals: ['size_escalation'],
      outcome: 'abandoned',
      mode: 'practice',
      triggers: [{ type: 'overconfidence', evidence: 'बड़ा ट्रेड लेने का मन था' }],
      reflections: [
        { qid: 'q_size', answer: 'आवेग में था, रुकने पर अहसास हुआ' },
      ],
    },
    {
      ts: s1Start + 18 * 60 * 1000,
      why: 'तेज़ी देखकर मौका हाथ से जाने का डर लगा',
      horizon: 'today',
      funding: 'savings',
      amount: 10000,
      maxLoss: 2000,
      level: 'caution',
      firedSignals: ['quick_reentry_after_loss'],
      outcome: 'delayed',
      mode: 'practice',
      triggers: [{ type: 'fomo', evidence: 'मौका हाथ से जाने का डर लगा' }],
      reflections: [
        { qid: 'q_revenge', answer: 'नया कारण' },
      ],
    },
    {
      ts: s1Start + 21 * 60 * 1000,
      why: 'प्लान के मुताबिक छोटी पोज़िशन ली',
      horizon: 'days',
      funding: 'savings',
      amount: 10000,
      maxLoss: 1500,
      level: 'calm',
      firedSignals: [],
      outcome: 'proceeded',
      mode: 'practice',
      reflections: [
        { qid: 'q_plan_or_reaction', answer: 'योजना' },
      ],
    },
  ];

  await db.decisions.bulkAdd(practiceDecisions);
}
