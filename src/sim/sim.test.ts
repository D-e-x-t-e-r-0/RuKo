import { describe, it, expect } from 'vitest';
import { generatePrices, SCENARIOS } from './market';
import { calculatePnl, isAutoCloseTriggered } from './account';

describe('Phase 4: Market Engine Simulation Tests', () => {
  it('generatePrices is deterministic for the same seed and scenario', () => {
    const prices1 = generatePrices(42101, 'calm', 'demo_index', 120);
    const prices2 = generatePrices(42101, 'calm', 'demo_index', 120);

    expect(prices1.length).toBe(120);
    expect(prices1).toEqual(prices2);
  });

  it('generatePrices produces different results across different scenarios', () => {
    const calm = generatePrices(12345, 'calm', 'demo_index', 120);
    const volatile = generatePrices(12345, 'volatile', 'demo_index', 120);

    expect(calm).not.toEqual(volatile);
  });

  it('crash scenario contains a drop of at least 10% within 8 ticks', () => {
    const seed = SCENARIOS.crash.fixedSeed;
    const crashPrices = generatePrices(seed, 'crash', 'demo_index', 120);

    // Scan for any window of up to 8 ticks where price drops by at least 10%
    let found10PercentDrop = false;

    for (let i = 0; i < crashPrices.length - 8; i++) {
      const startP = crashPrices[i];
      for (let w = 1; w <= 8; w++) {
        const dropPct = (startP - crashPrices[i + w]) / startP;
        if (dropPct >= 0.1) {
          found10PercentDrop = true;
          break;
        }
      }
      if (found10PercentDrop) break;
    }

    expect(found10PercentDrop).toBe(true);
  });
});

describe('Phase 4: Virtual Account Math and 90% Auto-Close Rule', () => {
  it('calculates P&L correctly with 1x leverage', () => {
    // 10% gain on 10,000 margin = +1,000
    const pnlGain = calculatePnl(100, 110, 10000, 1);
    expect(pnlGain).toBe(1000);

    // 10% loss on 10,000 margin = -1,000
    const pnlLoss = calculatePnl(100, 90, 10000, 1);
    expect(pnlLoss).toBe(-1000);
  });

  it('calculates P&L correctly with 5x leverage', () => {
    // 5% gain with 5x leverage on 10,000 margin = +2,500
    const pnl5xGain = calculatePnl(100, 105, 10000, 5);
    expect(pnl5xGain).toBe(2500);

    // 5% loss with 5x leverage on 10,000 margin = -2,500
    const pnl5xLoss = calculatePnl(100, 95, 10000, 5);
    expect(pnl5xLoss).toBe(-2500);
  });

  it('triggers auto-close when unrealized loss reaches or exceeds 90% of margin', () => {
    const margin = 10000;
    // Loss of 80% (price drops to 20 with 1x leverage): should NOT auto close (pnl = -8000)
    expect(isAutoCloseTriggered(100, 20, margin, 1)).toBe(false);

    // Loss of 90% (price drops to 10 with 1x leverage): SHOULD auto close (pnl = -9000)
    expect(isAutoCloseTriggered(100, 10, margin, 1)).toBe(true);

    // Loss of 95% (price drops to 5): SHOULD auto close (pnl = -9500)
    expect(isAutoCloseTriggered(100, 5, margin, 1)).toBe(true);

    // With 5x leverage: an 18% price drop (price drops to 82) produces 90% margin loss (-18% * 5 = -90%)
    expect(isAutoCloseTriggered(100, 82, margin, 5)).toBe(true);
  });
});
