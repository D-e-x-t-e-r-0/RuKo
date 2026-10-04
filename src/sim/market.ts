import { mulberry32, createGaussian } from './prng';

export type InstrumentId = 'demo_index' | 'demo_co_a' | 'demo_co_b' | 'demo_futures';

export type ScenarioId = 'calm' | 'volatile' | 'crash' | 'rally_reversal' | 'late_night';

export interface InstrumentInfo {
  id: InstrumentId;
  name: string;
  volatility: number; // per tick
  maxLeverage: 1 | 5;
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentInfo> = {
  demo_index: {
    id: 'demo_index',
    name: 'Demo Index',
    volatility: 0.002, // 0.2%
    maxLeverage: 1,
  },
  demo_co_a: {
    id: 'demo_co_a',
    name: 'Demo Co. A',
    volatility: 0.006, // 0.6%
    maxLeverage: 1,
  },
  demo_co_b: {
    id: 'demo_co_b',
    name: 'Demo Co. B',
    volatility: 0.014, // 1.4%
    maxLeverage: 1,
  },
  demo_futures: {
    id: 'demo_futures',
    name: 'Demo Futures (5x)',
    volatility: 0.008, // 0.8%
    maxLeverage: 5,
  },
};

export interface ScenarioInfo {
  id: ScenarioId;
  fixedSeed: number;
  enDescription: string;
  hiDescription: string;
  startHour: number;
  startMinute: number;
}

export const SCENARIOS: Record<ScenarioId, ScenarioInfo> = {
  calm: {
    id: 'calm',
    fixedSeed: 42101,
    enDescription: 'A quiet day. Small moves.',
    hiDescription: 'शांत दिन। छोटे उतार-चढ़ाव।',
    startHour: 10,
    startMinute: 0,
  },
  volatile: {
    id: 'volatile',
    fixedSeed: 84203,
    enDescription: 'Big swings both ways. Notice how it feels.',
    hiDescription: 'दोनों तरफ़ बड़े झटके। महसूस करें कैसा लगता है।',
    startHour: 11,
    startMinute: 30,
  },
  crash: {
    id: 'crash',
    fixedSeed: 91345,
    enDescription: 'A sudden drop after a calm start.',
    hiDescription: 'शांत शुरुआत के बाद अचानक गिरावट।',
    startHour: 14,
    startMinute: 0,
  },
  rally_reversal: {
    id: 'rally_reversal',
    fixedSeed: 73921,
    enDescription: 'Everything seems to go up. Then it does not.',
    hiDescription: 'सब कुछ ऊपर जाता दिखता है। फिर नहीं।',
    startHour: 12,
    startMinute: 15,
  },
  late_night: {
    id: 'late_night',
    fixedSeed: 65119,
    enDescription: 'Late evening hours. High fatigue.',
    hiDescription: 'देर रात का समय। थकान और जल्दबाज़ी।',
    startHour: 22,
    startMinute: 40,
  },
};

export function generatePrices(
  seed: number,
  scenario: ScenarioId,
  instrument: InstrumentId,
  ticks = 120
): number[] {
  const prng = mulberry32(seed);
  const gaussian = createGaussian(prng);
  const inst = INSTRUMENTS[instrument] || INSTRUMENTS.demo_index;
  const vol = inst.volatility;

  const prices: number[] = [100];
  let currentPrice = 100;

  for (let i = 1; i < ticks; i++) {
    let drift = 0;
    let shockMultiplier = 1;

    switch (scenario) {
      case 'calm':
        drift = 0.0001;
        shockMultiplier = 0.8;
        break;

      case 'volatile':
        drift = 0;
        shockMultiplier = 2.2;
        break;

      case 'crash':
        // Steady climb for 40 ticks (0..39)
        if (i < 40) {
          drift = 0.0025;
          shockMultiplier = 0.5;
        } else if (i >= 40 && i < 46) {
          // Sudden fall of ~12% within 6 ticks (-2.2% per tick)
          drift = -0.024;
          shockMultiplier = 0.2;
        } else {
          // Partial recovery
          drift = 0.0015;
          shockMultiplier = 1.0;
        }
        break;

      case 'rally_reversal':
        // Sharp rise for 50 ticks (a FOMO trap), then a reversal
        if (i < 50) {
          drift = 0.0035;
          shockMultiplier = 0.6;
        } else {
          drift = -0.003;
          shockMultiplier = 1.5;
        }
        break;

      case 'late_night':
        // Calm to volatile
        if (i < 30) {
          drift = 0.0002;
          shockMultiplier = 0.9;
        } else {
          drift = -0.001;
          shockMultiplier = 2.0;
        }
        break;
    }

    const shock = vol * shockMultiplier * gaussian();
    const returnVal = drift + shock;
    currentPrice = Math.max(1, currentPrice * (1 + returnVal));
    prices.push(Math.round(currentPrice * 100) / 100);
  }

  return prices;
}

export function getSimTime(startHour: number, startMinute: number, tickIndex: number): number {
  const d = new Date();
  d.setHours(startHour, startMinute, 0, 0);
  return d.getTime() + tickIndex * 60 * 1000;
}
