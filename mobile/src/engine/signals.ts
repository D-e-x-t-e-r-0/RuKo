import type { Trade, Funding, Signal } from '../types';

export interface LastTradeHint {
  result: 'loss' | 'profit' | 'none';
  minutesAgo: number;
}

export interface PendingTrade {
  ts: number;
  amount: number;
  funding: Funding;
  lastTradeHint?: LastTradeHint;
}

function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function evaluateSignals(trades: Trade[], pending: PendingTrade): Signal[] {
  // Sort past trades descending by timestamp, considering trades <= pending.ts
  const pastTrades = trades
    .filter(t => t.ts <= pending.ts)
    .sort((a, b) => b.ts - a.ts);

  // 1. late_night: hour of pending.ts is >= 22 or < 5 (local time)
  const hour = new Date(pending.ts).getHours();
  const lateNightFired = hour >= 22 || hour < 5;
  const lateNightSignal: Signal = {
    id: 'late_night',
    fired: lateNightFired,
    params: { hour }
  };

  // 2. many_trades_today: trades on same calendar day as pending.ts + 1 >= 4
  const sameDayTrades = pastTrades.filter(t => isSameDay(t.ts, pending.ts));
  const todayCount = sameDayTrades.length + 1;
  const manyTradesFired = todayCount >= 4;
  const manyTradesSignal: Signal = {
    id: 'many_trades_today',
    fired: manyTradesFired,
    params: { count: todayCount }
  };

  // Check whether a logged trade is more recent than the hint
  const hint = pending.lastTradeHint;
  const hasHint = hint && hint.result !== 'none' && hint.minutesAgo >= 0;
  const hintTs = hasHint ? pending.ts - hint.minutesAgo * 60 * 1000 : -1;
  const hasMoreRecentLoggedTrade = pastTrades.length > 0 && pastTrades[0].ts > hintTs;

  // 3. quick_reentry_after_loss: most recent trade has pnl < 0 AND gap < 30 mins
  let quickReentryFired = false;
  let reentryMinutes = 0;
  if (hasMoreRecentLoggedTrade) {
    const mostRecent = pastTrades[0];
    const diffMs = pending.ts - mostRecent.ts;
    reentryMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (mostRecent.pnl !== null && mostRecent.pnl < 0 && diffMs >= 0 && diffMs < 30 * 60 * 1000) {
      quickReentryFired = true;
    }
  } else if (hasHint) {
    if (hint.result === 'loss' && hint.minutesAgo < 30) {
      quickReentryFired = true;
      reentryMinutes = hint.minutesAgo;
    }
  }
  const quickReentrySignal: Signal = {
    id: 'quick_reentry_after_loss',
    fired: quickReentryFired,
    params: { minutes: reentryMinutes }
  };

  // 4. size_escalation: pending.amount > 1.5 * avg amount of last 3 past trades (needs >= 3 trades)
  let sizeEscalationFired = false;
  let avg3 = 0;
  if (pastTrades.length >= 3) {
    const last3 = pastTrades.slice(0, 3);
    const sum = last3.reduce((acc, t) => acc + t.amount, 0);
    avg3 = Math.round(sum / 3);
    if (pending.amount > 1.5 * (sum / 3)) {
      sizeEscalationFired = true;
    }
  }
  const sizeEscalationSignal: Signal = {
    id: 'size_escalation',
    fired: sizeEscalationFired,
    params: { avg: avg3, pending: pending.amount }
  };

  // 5. loss_streak: last 3 closed trades are all losses
  const closedTrades = pastTrades.filter(t => t.pnl !== null);
  let lossStreakFired = false;
  if (hasMoreRecentLoggedTrade) {
    if (closedTrades.length >= 3) {
      const last3Closed = closedTrades.slice(0, 3);
      if (last3Closed.every(t => (t.pnl as number) < 0)) {
        lossStreakFired = true;
      }
    }
  } else if (hasHint) {
    if (hint.result === 'loss') {
      // Counts toward loss_streak only if real trades agree (at least 2 prior closed losses)
      if (closedTrades.length >= 2) {
        const last2Closed = closedTrades.slice(0, 2);
        if (last2Closed.every(t => (t.pnl as number) < 0)) {
          lossStreakFired = true;
        }
      }
    }
    // If hint is profit, streak is broken, lossStreakFired remains false
  } else {
    // No hint, evaluate existing closed trades
    if (closedTrades.length >= 3) {
      const last3Closed = closedTrades.slice(0, 3);
      if (last3Closed.every(t => (t.pnl as number) < 0)) {
        lossStreakFired = true;
      }
    }
  }
  const lossStreakSignal: Signal = {
    id: 'loss_streak',
    fired: lossStreakFired,
    params: { n: 3 }
  };

  // 6. risky_funding: pending.funding is emergency or loan
  const riskyFundingFired = pending.funding === 'emergency' || pending.funding === 'loan';
  const riskyFundingSignal: Signal = {
    id: 'risky_funding',
    fired: riskyFundingFired,
    params: { funding: pending.funding }
  };

  return [
    lateNightSignal,
    manyTradesSignal,
    quickReentrySignal,
    sizeEscalationSignal,
    lossStreakSignal,
    riskyFundingSignal
  ];
}
