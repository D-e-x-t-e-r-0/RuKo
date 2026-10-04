import type { Signal, Level } from '../types';

export function levelFor(signals: Signal[]): Level {
  const n = signals.filter(s => s.fired).length;
  return n >= 3 ? 'high' : n >= 1 ? 'caution' : 'calm';
}

export const frictionSeconds: Record<Level, number> = {
  calm: 10,
  caution: 30,
  high: 60,
};
