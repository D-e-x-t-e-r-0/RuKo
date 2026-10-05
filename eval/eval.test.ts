import { evaluateSignals } from '../src/engine/signals';
import { levelFor } from '../src/engine/pressure';
import { hasBannedWords } from '../api/validate';
import cases from './cases.json';

function buildTs(baseHour: number, baseMin: number, agoMin?: number): number {
  const now = new Date();
  now.setHours(baseHour, baseMin, 0, 0);
  if (agoMin) return now.getTime() - agoMin * 60_000;
  return now.getTime();
}

describe('eval harness — deterministic engine + guardrails', () => {
  for (const c of cases as any[]) {
    if (!c.pending) continue;
    it(`eval/${c.id}: ${c.desc}`, () => {
      const ts = buildTs(c.pending.hour, c.pending.minute);
      const trades = (c.trades || []).map((t: any, i: number) => ({
        id: `eval-${c.id}-${i}`,
        ts: buildTs(c.pending.hour, c.pending.minute, t.agoMin) - 60_000,
        amount: t.amount ?? 1000,
        funding: 'savings' as const,
        pnl: t.pnl ?? null,
      }));
      let hint: any = undefined;
      if (c.pending.hint && c.pending.hint !== 'none') {
        const [result, mins] = String(c.pending.hint).split(':');
        hint = { result, minutesAgo: Number(mins) };
      }
      const signals = evaluateSignals(trades, {
        ts,
        amount: c.pending.amount,
        funding: c.pending.funding,
        lastTradeHint: hint,
      });
      const fired = signals.filter((s) => s.fired).map((s) => s.id);
      for (const e of c.expect || []) {
        expect(fired).toContain(e);
      }
      if ((c.expect || []).length === 0) {
        expect(fired).toEqual([]);
      }
      if (c.expectLevel) {
        expect(levelFor(signals)).toBe(c.expectLevel);
      }
    });
  }

  for (const c of cases as any[]) {
    if (!c.modelOutput) continue;
    it(`eval-guard/${c.id}`, () => {
      expect(hasBannedWords(c.modelOutput)).toBe(c.expectBanned);
    });
  }
});
