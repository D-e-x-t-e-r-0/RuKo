import React, { useMemo } from 'react';
import type { Candle } from '../sim/market';

interface Props {
  candles: Candle[];
  /** ticks elapsed — candles starting at/after this are dimmed as future */
  tick?: number;
}

const UP = '#2BB3A3';
const DOWN = '#E4572E';
const W = 320;
const H = 176;
const PAD = 8;

/** Lightweight candlestick chart — pure SVG, no chart lib, offline-safe.
 *  Green body = close >= open, red = close < open. Dashed saffron = last close. */
export const CandleChart: React.FC<Props> = ({ candles, tick = Infinity }) => {
  const geom = useMemo(() => {
    if (candles.length === 0) return null;
    const all = candles.flatMap((c) => [c.high, c.low]);
    let hi = Math.max(...all);
    let lo = Math.min(...all);
    if (hi - lo < 0.01) {
      hi += 0.5;
      lo -= 0.5;
    }
    const y = (p: number) => PAD + (1 - (p - lo) / (hi - lo)) * (H - PAD * 2);
    const slot = W / Math.max(candles.length, 1);
    const bodyW = Math.max(3, Math.min(14, slot * 0.55));
    return { hi, lo, y, slot, bodyW };
  }, [candles]);

  if (!geom || candles.length === 0) {
    return <div className="h-44 w-full flex items-center justify-center text-xs text-slate-500">Waiting for price ticks…</div>;
  }
  const { hi, lo, y, slot, bodyW } = geom;
  const lastClose = candles[candles.length - 1].close;

  return (
    <div role="img" aria-label={`Candlestick chart, ${candles.length} candles, last close ${lastClose.toFixed(2)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
        {/* last-price guide */}
        <line x1="0" x2={W} y1={y(lastClose)} y2={y(lastClose)} stroke="#92400E" strokeWidth="1" strokeDasharray="4 3" opacity="0.8" />
        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? UP : DOWN;
          const cx = slot * i + slot / 2;
          const yO = y(c.open);
          const yC = y(c.close);
          const top = Math.min(yO, yC);
          const hgt = Math.max(2, Math.abs(yC - yO));
          const future = c.tick >= tick;
          return (
            <g key={c.tick} opacity={future ? 0.25 : 1}>
              <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.5" />
              {up ? (
                <rect x={cx - bodyW / 2} y={top} width={bodyW} height={hgt} rx="1" fill={color} fillOpacity={0.9} />
              ) : (
                /* Down candles are hollow — readable without color vision (WCAG 1.4.1) */
                <rect x={cx - bodyW / 2} y={top} width={bodyW} height={hgt} rx="1" fill="none" stroke={color} strokeWidth="2" />
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1" aria-hidden="true">
        <span>₹{lo.toFixed(2)}</span>
        <span className="text-clay font-bold">last ₹{lastClose.toFixed(2)}</span>
        <span>₹{hi.toFixed(2)}</span>
      </div>
    </div>
  );
};
