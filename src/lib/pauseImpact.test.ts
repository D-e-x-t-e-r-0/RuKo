import { describe, it, expect } from 'vitest';
import { comparePauseOnOff } from './pauseImpact';

describe('pause impact', () => {
  it('shows fewer reentries with pause ON', () => {
    const r = comparePauseOnOff([
      { pausesTaken: 2, tradesOpened: 2, tradesAfterLoss: 0, maxDrawdownPercent: 5 },
      { pausesTaken: 1, tradesOpened: 2, tradesAfterLoss: 0, maxDrawdownPercent: 7 },
      { pausesTaken: 0, tradesOpened: 5, tradesAfterLoss: 3, maxDrawdownPercent: 18 },
    ]);
    expect(r.on.n).toBe(2);
    expect(r.off.n).toBe(1);
    expect(r.on.reentryShare).toBe(0);
    expect(r.off.reentryShare).toBe(60);
    expect(r.on.avgDrawdown).toBeLessThan(r.off.avgDrawdown);
  });
});
