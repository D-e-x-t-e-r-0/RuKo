import { describe, it, expect } from 'vitest';
import { buildEvidencePack, evidencePackText } from './evidence';

describe('evidence pack', () => {
  it('counts choices, aggregates signals, strips amounts + why by default', () => {
    const pack = buildEvidencePack([
      { choice: 'abandon', signals: ['late_night'], amount: 99999, why: 'secret' } as any,
      { choice: 'wait', signals: ['late_night', 'risky_funding'], amount: 1 } as any,
      { choice: 'proceed', signals: [] } as any,
    ]);
    expect(pack.pauses).toBe(3);
    expect(pack.abandoned).toBe(1);
    expect(pack.signalsSeen.late_night).toBe(2);
    expect(JSON.stringify(pack)).not.toContain('99999');
    expect(JSON.stringify(pack)).not.toContain('secret');
    expect(evidencePackText(pack)).toContain('Pauses: 3');
  });
});
