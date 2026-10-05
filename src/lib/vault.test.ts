import { describe, it, expect } from 'vitest';
import { redactForExport, redactWhy, encryptBackup, decryptBackup } from './vault';

describe('vault — redaction + encrypted backup', () => {
  it('drops amounts/funding/tickers from exports', () => {
    const out = redactForExport({ why: 'uneasy', amount: 50000, funding: 'loan', ticker: 'RELIANCE', signals: ['late_night'] });
    expect(out).toEqual({ why: 'uneasy', signals: ['late_night'] });
  });

  it('redacts numbers pasted into why', () => {
    expect(redactWhy('I put 50000 on RELIANCE')).not.toContain('50000');
    expect(redactWhy('I put 50000 on RELIANCE')).not.toContain('RELIANCE');
  });

  it('round-trips encrypted backup, wrong passphrase fails', async () => {
    const ct = await encryptBackup(JSON.stringify({ pauses: 3 }), 'correct-horse');
    expect(ct.startsWith('RUKO1.')).toBe(true);
    expect(await decryptBackup(ct, 'correct-horse')).toContain('pauses');
    await expect(decryptBackup(ct, 'wrong')).rejects.toThrow();
  });
});
