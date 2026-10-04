import { describe, it, expect } from 'vitest';
import { evaluateSignals } from './signals';
import { levelFor } from './pressure';
import type { Trade, Signal } from '../types';
import { parseCsvContent } from '../workers/csvWorker';
import fs from 'node:fs';
import path from 'node:path';

describe('Pattern Engine - Signal Tests', () => {
  // Helper to generate a fixed timestamp for a specific date & time
  // e.g. 2026-10-04 at 14:00:00
  const createFixedTime = (year: number, month: number, day: number, hour: number, minute: number = 0) => {
    return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
  };

  describe('Signal: late_night', () => {
    it('fires when hour is >= 22 (e.g. 23:15)', () => {
      const fixedTs = createFixedTime(2026, 10, 4, 23, 15);
      const signals = evaluateSignals([], { ts: fixedTs, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'late_night');
      expect(sig?.fired).toBe(true);
      expect(sig?.params.hour).toBe(23);
    });

    it('fires when hour is < 5 (e.g. 02:30)', () => {
      const fixedTs = createFixedTime(2026, 10, 4, 2, 30);
      const signals = evaluateSignals([], { ts: fixedTs, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'late_night');
      expect(sig?.fired).toBe(true);
      expect(sig?.params.hour).toBe(2);
    });

    it('does NOT fire during daytime (e.g. 14:00)', () => {
      const fixedTs = createFixedTime(2026, 10, 4, 14, 0);
      const signals = evaluateSignals([], { ts: fixedTs, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'late_night');
      expect(sig?.fired).toBe(false);
      expect(sig?.params.hour).toBe(14);
    });

    it('verifies exact boundary hours for late_night', () => {
      // 22:00 fires
      const t2200 = createFixedTime(2026, 10, 4, 22, 0);
      expect(evaluateSignals([], { ts: t2200, amount: 1000, funding: 'savings' }).find(s => s.id === 'late_night')?.fired).toBe(true);

      // 21:59 does not fire
      const t2159 = createFixedTime(2026, 10, 4, 21, 59);
      expect(evaluateSignals([], { ts: t2159, amount: 1000, funding: 'savings' }).find(s => s.id === 'late_night')?.fired).toBe(false);

      // 04:59 fires
      const t0459 = createFixedTime(2026, 10, 4, 4, 59);
      expect(evaluateSignals([], { ts: t0459, amount: 1000, funding: 'savings' }).find(s => s.id === 'late_night')?.fired).toBe(true);

      // 05:00 does not fire
      const t0500 = createFixedTime(2026, 10, 4, 5, 0);
      expect(evaluateSignals([], { ts: t0500, amount: 1000, funding: 'savings' }).find(s => s.id === 'late_night')?.fired).toBe(false);
    });
  });

  describe('Signal: many_trades_today', () => {
    it('fires when trades today + 1 pending is >= 4', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const tradesToday: Trade[] = [
        { ts: createFixedTime(2026, 10, 4, 10, 0), amount: 1000, pnl: 100, funding: 'savings' },
        { ts: createFixedTime(2026, 10, 4, 11, 30), amount: 1000, pnl: -50, funding: 'savings' },
        { ts: createFixedTime(2026, 10, 4, 13, 0), amount: 1000, pnl: 20, funding: 'savings' },
      ];
      const signals = evaluateSignals(tradesToday, { ts: now, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'many_trades_today');
      expect(sig?.fired).toBe(true);
      expect(sig?.params.count).toBe(4);
    });

    it('does NOT fire when trades today + 1 pending is < 4', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: createFixedTime(2026, 10, 4, 10, 0), amount: 1000, pnl: 100, funding: 'savings' },
        { ts: createFixedTime(2026, 10, 3, 11, 30), amount: 1000, pnl: -50, funding: 'savings' }, // yesterday
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'many_trades_today');
      expect(sig?.fired).toBe(false);
      expect(sig?.params.count).toBe(2);
    });
  });

  describe('Signal: quick_reentry_after_loss', () => {
    it('fires when most recent trade was a loss and gap is < 30 minutes', () => {
      const now = createFixedTime(2026, 10, 4, 15, 30);
      const pastTrades: Trade[] = [
        { ts: createFixedTime(2026, 10, 4, 15, 10), amount: 2000, pnl: -500, funding: 'savings' }, // 20m ago
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'quick_reentry_after_loss');
      expect(sig?.fired).toBe(true);
      expect(sig?.params.minutes).toBe(20);
    });

    it('does NOT fire if gap is exactly 30 minutes', () => {
      const now = createFixedTime(2026, 10, 4, 15, 30);
      const pastTrades: Trade[] = [
        { ts: createFixedTime(2026, 10, 4, 15, 0), amount: 2000, pnl: -500, funding: 'savings' }, // exactly 30m ago (diffMs = 30*60*1000)
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'quick_reentry_after_loss');
      expect(sig?.fired).toBe(false);
    });

    it('fires if gap is 29 minutes and 59 seconds', () => {
      const now = createFixedTime(2026, 10, 4, 15, 30);
      const pastTrades: Trade[] = [
        { ts: now - (30 * 60 * 1000 - 1000), amount: 2000, pnl: -500, funding: 'savings' }, // 29m59s
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'quick_reentry_after_loss');
      expect(sig?.fired).toBe(true);
      expect(sig?.params.minutes).toBe(29);
    });

    it('does NOT fire if last trade was profitable', () => {
      const now = createFixedTime(2026, 10, 4, 15, 15);
      const pastTrades: Trade[] = [
        { ts: createFixedTime(2026, 10, 4, 15, 5), amount: 2000, pnl: 400, funding: 'savings' }, // 10m ago, profit
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'quick_reentry_after_loss');
      expect(sig?.fired).toBe(false);
    });

    it('fires with lastTradeHint when loss is under 30 minutes ago and no newer trade exists', () => {
      const now = createFixedTime(2026, 10, 4, 15, 15);
      const signals = evaluateSignals([], {
        ts: now,
        amount: 1000,
        funding: 'savings',
        lastTradeHint: { result: 'loss', minutesAgo: 10 }
      });
      const sig = signals.find(s => s.id === 'quick_reentry_after_loss');
      expect(sig?.fired).toBe(true);
      expect(sig?.params.minutes).toBe(10);
    });

    it('does NOT fire with lastTradeHint when minutesAgo >= 30 or result is profit/none', () => {
      const now = createFixedTime(2026, 10, 4, 15, 15);
      const sig30m = evaluateSignals([], {
        ts: now,
        amount: 1000,
        funding: 'savings',
        lastTradeHint: { result: 'loss', minutesAgo: 30 }
      }).find(s => s.id === 'quick_reentry_after_loss');
      expect(sig30m?.fired).toBe(false);

      const sigProfit = evaluateSignals([], {
        ts: now,
        amount: 1000,
        funding: 'savings',
        lastTradeHint: { result: 'profit', minutesAgo: 5 }
      }).find(s => s.id === 'quick_reentry_after_loss');
      expect(sigProfit?.fired).toBe(false);
    });

    it('prefers a newer logged trade over lastTradeHint', () => {
      const now = createFixedTime(2026, 10, 4, 15, 30);
      // Logged trade is profitable 5 minutes ago
      const pastTrades: Trade[] = [
        { ts: now - 5 * 60 * 1000, amount: 2000, pnl: 500, funding: 'savings' }
      ];
      // Hint says loss 20 minutes ago (which is older than the logged trade at 5 min ago)
      const signals = evaluateSignals(pastTrades, {
        ts: now,
        amount: 1000,
        funding: 'savings',
        lastTradeHint: { result: 'loss', minutesAgo: 20 }
      });
      const sig = signals.find(s => s.id === 'quick_reentry_after_loss');
      expect(sig?.fired).toBe(false);
    });
  });

  describe('Signal: size_escalation', () => {
    it('fires when pending amount > 1.5x average of last 3 trades', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: now - 300000, amount: 2000, pnl: 100, funding: 'savings' },
        { ts: now - 600000, amount: 2000, pnl: 100, funding: 'savings' },
        { ts: now - 900000, amount: 2000, pnl: 100, funding: 'savings' },
      ]; // avg = 2000, 1.5x = 3000
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 4000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'size_escalation');
      expect(sig?.fired).toBe(true);
      expect(sig?.params.avg).toBe(2000);
      expect(sig?.params.pending).toBe(4000);
    });

    it('does NOT fire when pending amount is exactly 1.5x average of last 3 trades', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: now - 300000, amount: 2000, pnl: 100, funding: 'savings' },
        { ts: now - 600000, amount: 2000, pnl: 100, funding: 'savings' },
        { ts: now - 900000, amount: 2000, pnl: 100, funding: 'savings' },
      ]; // avg = 2000, 1.5x = 3000
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 3000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'size_escalation');
      expect(sig?.fired).toBe(false);
    });

    it('fires when pending amount is 1.5x average + 1 rupee', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: now - 300000, amount: 2000, pnl: 100, funding: 'savings' },
        { ts: now - 600000, amount: 2000, pnl: 100, funding: 'savings' },
        { ts: now - 900000, amount: 2000, pnl: 100, funding: 'savings' },
      ]; // avg = 2000, 1.5x = 3000
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 3001, funding: 'savings' });
      const sig = signals.find(s => s.id === 'size_escalation');
      expect(sig?.fired).toBe(true);
    });

    it('does NOT fire when pending amount <= 1.5x average of last 3 trades', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: now - 300000, amount: 2000, pnl: 100, funding: 'savings' },
        { ts: now - 600000, amount: 2000, pnl: 100, funding: 'savings' },
        { ts: now - 900000, amount: 2000, pnl: 100, funding: 'savings' },
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 2500, funding: 'savings' });
      const sig = signals.find(s => s.id === 'size_escalation');
      expect(sig?.fired).toBe(false);
    });

    it('does NOT fire when fewer than 3 trades exist', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: now - 300000, amount: 1000, pnl: 100, funding: 'savings' },
        { ts: now - 600000, amount: 1000, pnl: 100, funding: 'savings' },
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 50000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'size_escalation');
      expect(sig?.fired).toBe(false);
    });
  });

  describe('Signal: loss_streak', () => {
    it('fires when last 3 closed trades are all losses', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: now - 10000, amount: 1000, pnl: null, funding: 'savings' }, // open trade ignored
        { ts: now - 20000, amount: 1000, pnl: -100, funding: 'savings' },
        { ts: now - 30000, amount: 1000, pnl: -200, funding: 'savings' },
        { ts: now - 40000, amount: 1000, pnl: -300, funding: 'savings' },
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'loss_streak');
      expect(sig?.fired).toBe(true);
      expect(sig?.params.n).toBe(3);
    });

    it('does NOT fire when any of the last 3 closed trades was profit', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: now - 20000, amount: 1000, pnl: -100, funding: 'savings' },
        { ts: now - 30000, amount: 1000, pnl: 200, funding: 'savings' }, // profit
        { ts: now - 40000, amount: 1000, pnl: -300, funding: 'savings' },
      ];
      const signals = evaluateSignals(pastTrades, { ts: now, amount: 1000, funding: 'savings' });
      const sig = signals.find(s => s.id === 'loss_streak');
      expect(sig?.fired).toBe(false);
    });

    it('counts toward loss_streak when hint is loss and real trades agree with 2 prior losses', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const pastTrades: Trade[] = [
        { ts: now - 60 * 60 * 1000, amount: 1000, pnl: -100, funding: 'savings' },
        { ts: now - 120 * 60 * 1000, amount: 1000, pnl: -200, funding: 'savings' },
      ];
      // Hint is a loss 10m ago (more recent than past trades at 60m and 120m)
      const signals = evaluateSignals(pastTrades, {
        ts: now,
        amount: 1000,
        funding: 'savings',
        lastTradeHint: { result: 'loss', minutesAgo: 10 }
      });
      const sig = signals.find(s => s.id === 'loss_streak');
      expect(sig?.fired).toBe(true);
    });

    it('does NOT fabricate loss_streak from hint if real trades do not agree', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      // Only 1 prior loss trade
      const pastTrades1: Trade[] = [
        { ts: now - 60 * 60 * 1000, amount: 1000, pnl: -100, funding: 'savings' },
      ];
      const sig1 = evaluateSignals(pastTrades1, {
        ts: now,
        amount: 1000,
        funding: 'savings',
        lastTradeHint: { result: 'loss', minutesAgo: 10 }
      }).find(s => s.id === 'loss_streak');
      expect(sig1?.fired).toBe(false);

      // Prior trade was profit
      const pastTrades2: Trade[] = [
        { ts: now - 60 * 60 * 1000, amount: 1000, pnl: 300, funding: 'savings' },
        { ts: now - 120 * 60 * 1000, amount: 1000, pnl: -200, funding: 'savings' },
      ];
      const sig2 = evaluateSignals(pastTrades2, {
        ts: now,
        amount: 1000,
        funding: 'savings',
        lastTradeHint: { result: 'loss', minutesAgo: 10 }
      }).find(s => s.id === 'loss_streak');
      expect(sig2?.fired).toBe(false);
    });
  });

  describe('Signal: risky_funding', () => {
    it('fires when funding is emergency or loan', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const sigLoan = evaluateSignals([], { ts: now, amount: 1000, funding: 'loan' }).find(
        s => s.id === 'risky_funding'
      );
      const sigEmergency = evaluateSignals([], { ts: now, amount: 1000, funding: 'emergency' }).find(
        s => s.id === 'risky_funding'
      );
      expect(sigLoan?.fired).toBe(true);
      expect(sigEmergency?.fired).toBe(true);
    });

    it('does NOT fire when funding is savings', () => {
      const now = createFixedTime(2026, 10, 4, 15, 0);
      const sigSavings = evaluateSignals([], { ts: now, amount: 1000, funding: 'savings' }).find(
        s => s.id === 'risky_funding'
      );
      expect(sigSavings?.fired).toBe(false);
    });
  });

  describe('levelFor calculation', () => {
    it('returns calm for 0 fired signals', () => {
      const signals: Signal[] = [
        { id: 'late_night', fired: false, params: {} },
        { id: 'risky_funding', fired: false, params: {} },
      ];
      expect(levelFor(signals)).toBe('calm');
    });

    it('returns caution for 1 or 2 fired signals', () => {
      const signals1: Signal[] = [
        { id: 'late_night', fired: true, params: {} },
        { id: 'risky_funding', fired: false, params: {} },
      ];
      const signals2: Signal[] = [
        { id: 'late_night', fired: true, params: {} },
        { id: 'risky_funding', fired: true, params: {} },
      ];
      expect(levelFor(signals1)).toBe('caution');
      expect(levelFor(signals2)).toBe('caution');
    });

    it('returns high for 3 or more fired signals', () => {
      const signals3: Signal[] = [
        { id: 'late_night', fired: true, params: {} },
        { id: 'risky_funding', fired: true, params: {} },
        { id: 'many_trades_today', fired: true, params: {} },
      ];
      expect(levelFor(signals3)).toBe('high');
    });
  });
});

describe('Guardrail String Tests', () => {
  function getAllStrings(obj: any): string[] {
    let strings: string[] = [];
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') {
        strings.push(val);
      } else if (typeof val === 'object' && val !== null) {
        strings = strings.concat(getAllStrings(val));
      }
    }
    return strings;
  }

  it('en.json contains no buy/sell/hold/target price/tip/tips', () => {
    const enFilePath = path.resolve(__dirname, '../i18n/en.json');
    const content = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
    const strings = getAllStrings(content);
    const forbiddenRegex = /\b(buy|sell|hold|target price|tip|tips)\b/i;

    for (const str of strings) {
      const match = str.match(forbiddenRegex);
      expect(
        match,
        `Forbidden word found in en.json: "${str}" matched "${match?.[0]}"`
      ).toBeNull();
    }
  });

  it('hi.json contains no खरीद or बेच', () => {
    const hiFilePath = path.resolve(__dirname, '../i18n/hi.json');
    const content = JSON.parse(fs.readFileSync(hiFilePath, 'utf8'));
    const strings = getAllStrings(content);

    for (const str of strings) {
      expect(
        str.includes('खरीद'),
        `Forbidden word "खरीद" found in hi.json: "${str}"`
      ).toBe(false);
      expect(
        str.includes('बेच'),
        `Forbidden word "बेच" found in hi.json: "${str}"`
      ).toBe(false);
    }
  });
});

describe('CSV Parser Guardrail Test', () => {
  it('drops symbol, instrument and unlisted columns from CSV import', () => {
    const sampleCsv = `date,amount,pnl,symbol,instrument,broker,notes
2026-10-04T12:00:00Z,10000,-1500,NIFTY50,OPTIDX,ZERODHA,Impulse trade
2026-10-04T13:30:00Z,25000,3200,RELIANCE,EQ,GROWW,Good setup`;

    const parsedTrades = parseCsvContent(sampleCsv);
    expect(parsedTrades.length).toBe(2);

    for (const trade of parsedTrades) {
      expect(trade.amount).toBeGreaterThan(0);
      expect(trade.ts).toBeGreaterThan(0);
      expect(trade.funding).toBe('savings');

      // Symbol and extra columns must NOT be present on the Trade object
      expect('symbol' in trade).toBe(false);
      expect('instrument' in trade).toBe(false);
      expect('broker' in trade).toBe(false);
      expect('notes' in trade).toBe(false);
      expect(Object.keys(trade).sort()).toEqual(['amount', 'funding', 'pnl', 'ts'].sort());
    }
  });

  it('correctly parses Indian date formats (DD/MM/YYYY, DD-MM-YYYY) and handles day > 12', () => {
    const indianCsv = `trade_date,turnover,profit_loss
25/10/2026 14:30:00,50000,-2500
15-08-2026 10:15:00,30000,1200`;

    const trades = parseCsvContent(indianCsv);
    expect(trades.length).toBe(2);

    const d1 = new Date(trades[0].ts);
    expect(d1.getFullYear()).toBe(2026);
    expect(d1.getMonth()).toBe(9); // October (0-indexed)
    expect(d1.getDate()).toBe(25);
    expect(trades[0].amount).toBe(50000);
    expect(trades[0].pnl).toBe(-2500);

    const d2 = new Date(trades[1].ts);
    expect(d2.getFullYear()).toBe(2026);
    expect(d2.getMonth()).toBe(7); // August (0-indexed)
    expect(d2.getDate()).toBe(15);
    expect(trades[1].amount).toBe(30000);
    expect(trades[1].pnl).toBe(1200);
  });

  it('handles parenthetical negative numbers and leaves open/NA PnL as null', () => {
    const accountingCsv = `Date,Amount,PnL
2026-10-04,15000,"(2,500.00)"
2026-10-05,20000,N/A
2026-10-06,10000,-`;

    const trades = parseCsvContent(accountingCsv);
    expect(trades.length).toBe(3);

    // Parentheses (2,500.00) should be parsed as negative -2500
    expect(trades[0].pnl).toBe(-2500);

    // N/A and - should be null, not 0
    expect(trades[1].pnl).toBeNull();
    expect(trades[2].pnl).toBeNull();
  });
});
