import { describe, it, expect } from 'vitest';
import enJson from '../i18n/en.json';
import hiJson from '../i18n/hi.json';
import { SCENARIOS, INSTRUMENTS } from '../sim/market';

describe('Phase 5: Locale Guardrail and Market Spec Tests', () => {
  it('en.json contains zero banned words', () => {
    const bannedRegex = /\b(buy|sell|hold|target price|tip|tips)\b/i;
    const jsonStr = JSON.stringify(enJson);
    const match = jsonStr.match(bannedRegex);
    expect(match).toBeNull();
  });

  it('hi.json contains zero banned Hindi words', () => {
    const bannedRegex = /खरीद|बेच/;
    const jsonStr = JSON.stringify(hiJson);
    const match = jsonStr.match(bannedRegex);
    expect(match).toBeNull();
  });

  it('verifies all 5 scenarios exist with valid descriptions and seeds', () => {
    const scenarioKeys = ['calm', 'volatile', 'crash', 'rally_reversal', 'late_night'] as const;
    scenarioKeys.forEach(key => {
      const sc = SCENARIOS[key];
      expect(sc).toBeDefined();
      expect(sc.fixedSeed).toBeGreaterThan(0);
      expect(sc.enDescription.length).toBeGreaterThan(5);
      expect(sc.hiDescription.length).toBeGreaterThan(5);
    });
  });

  it('verifies fictional instruments have no real ticker symbols', () => {
    const instruments = Object.values(INSTRUMENTS);
    expect(instruments.length).toBe(4);
    instruments.forEach(inst => {
      expect(inst.name).toMatch(/Demo/);
    });
  });
});
