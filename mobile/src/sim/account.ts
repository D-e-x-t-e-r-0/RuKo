import type { InstrumentId } from './market';

export const INITIAL_WALLET_BALANCE = 100000;

export interface VirtualPosition {
  id: string;
  instrument: InstrumentId;
  margin: number; // Allocated wallet rupees
  leverage: number; // 1 or 5
  entryPrice: number;
  openedAtSimTs: number;
  openedAtTick: number;
}

export function calculatePnl(
  entryPrice: number,
  currentPrice: number,
  margin: number,
  leverage: number
): number {
  if (entryPrice <= 0) return 0;
  const rawPnl = ((currentPrice - entryPrice) / entryPrice) * margin * leverage;
  return Math.round(rawPnl);
}

export function isAutoCloseTriggered(
  entryPrice: number,
  currentPrice: number,
  margin: number,
  leverage: number
): boolean {
  const pnl = calculatePnl(entryPrice, currentPrice, margin, leverage);
  // Auto-close if unrealized loss reaches or exceeds 90% of margin
  return pnl <= -0.9 * margin;
}
