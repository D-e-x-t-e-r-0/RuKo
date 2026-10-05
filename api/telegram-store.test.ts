import { describe, it, expect } from 'vitest';
import { getSession, saveSession, sweep } from './telegram-store';

describe('telegram-store TTL', () => {
  it('returns stable session per chat, sweeps after 24h', () => {
    const a = getSession(111, 'hi');
    a.stats.pauses = 2;
    saveSession(111);
    expect(getSession(111).stats.pauses).toBe(2);
    expect(sweep(Date.now() + 25 * 3600_000)).toBeGreaterThanOrEqual(1);
  });
});
