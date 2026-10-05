// Pause impact — proves the ritual changes behaviour in practice mode.
// Compares sessions with pausesTaken>0 (Pause ON) vs 0 (Pause OFF) on:
// avg trades/session, share opened right after a loss, avg drawdown.
export interface SessionLike {
  pausesTaken?: number;
  tradesOpened?: number;
  tradesAfterLoss?: number;
  maxDrawdownPercent?: number;
}

export interface ImpactRow {
  n: number;
  avgTrades: number;
  reentryShare: number;
  avgDrawdown: number;
}

export interface Impact {
  on: ImpactRow;
  off: ImpactRow;
}

function row(list: SessionLike[]): ImpactRow {
  if (!list.length) return { n: 0, avgTrades: 0, reentryShare: 0, avgDrawdown: 0 };
  const trades = list.map((s) => s.tradesOpened ?? 0);
  const re = list.map((s) => s.tradesAfterLoss ?? 0);
  const dd = list.map((s) => s.maxDrawdownPercent ?? 0);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const totalTrades = sum(trades);
  return {
    n: list.length,
    avgTrades: Math.round((sum(trades) / list.length) * 10) / 10,
    reentryShare: totalTrades ? Math.round((sum(re) / totalTrades) * 100) : 0,
    avgDrawdown: Math.round((sum(dd) / list.length) * 10) / 10,
  };
}

export function comparePauseOnOff(sessions: SessionLike[]): Impact {
  return {
    on: row(sessions.filter((s) => (s.pausesTaken ?? 0) > 0)),
    off: row(sessions.filter((s) => (s.pausesTaken ?? 0) === 0)),
  };
}
