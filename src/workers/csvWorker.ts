import Papa from 'papaparse';
import type { Trade } from '../types';

function parseDateValue(rawTime: string): number {
  const trimmed = rawTime.trim();

  // 1. Numeric epoch timestamp
  const numTs = Number(trimmed);
  if (!isNaN(numTs) && numTs > 100000000) {
    return numTs < 10000000000 ? numTs * 1000 : numTs;
  }

  // 2. Indian date format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY [HH:mm[:ss]]
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const mins = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const secs = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1970) {
      const parsed = new Date(year, month - 1, day, hours, mins, secs).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  // 3. Fallback to standard Date parsing (e.g. ISO 8601 strings)
  const fallbackTs = new Date(trimmed).getTime();
  return fallbackTs;
}

export function parseCsvContent(csvText: string): Trade[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (!parsed.data || parsed.data.length === 0) {
    return [];
  }

  // Find column mapping by checking header keys case-insensitively
  const fields = parsed.meta.fields || Object.keys(parsed.data[0]);

  const timeField =
    fields.find(f => /^(time|date|timestamp|datetime)$/i.test(f.trim())) ||
    fields.find(f => /(time|date|timestamp|datetime)/i.test(f.trim()));

  const amountField =
    fields.find(f => /^(amount|value|turnover)$/i.test(f.trim())) ||
    fields.find(f => /(amount|value|turnover)/i.test(f.trim()));

  const pnlField =
    fields.find(f => /^(pnl|profit|p&l|profit\/loss)$/i.test(f.trim())) ||
    fields.find(f => /(pnl|profit|p&l|profit\/loss)/i.test(f.trim()));

  if (!timeField || !amountField) {
    return [];
  }

  const trades: Trade[] = [];

  for (const row of parsed.data) {
    const rawTime = row[timeField];
    const rawAmount = row[amountField];
    const rawPnl = pnlField ? row[pnlField] : undefined;

    if (!rawTime || !rawAmount) continue;

    // Parse date
    const ts = parseDateValue(String(rawTime));
    if (isNaN(ts) || ts <= 0) continue;

    // Parse amount
    const cleanAmountStr = String(rawAmount).replace(/[^0-9.]/g, '');
    if (!cleanAmountStr) continue;
    const amount = Number(cleanAmountStr);
    if (isNaN(amount) || amount <= 0) continue;

    // Parse pnl
    let pnl: number | null = null;
    if (rawPnl !== undefined && rawPnl !== null) {
      const pnlStr = String(rawPnl).trim();
      const isNegative = pnlStr.includes('(') || pnlStr.startsWith('-') || pnlStr.includes('-');
      const digitsOnly = pnlStr.replace(/[^0-9.]/g, '');
      if (digitsOnly !== '') {
        const val = Number(digitsOnly);
        if (!isNaN(val)) {
          pnl = isNegative ? -val : val;
        }
      }
    }

    // Explicitly construct ONLY valid Trade fields. Drop symbol, instrument, etc.
    const trade: Trade = {
      ts,
      amount,
      pnl,
      funding: 'savings',
    };

    trades.push(trade);
  }

  return trades;
}

// In Web Worker context
if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('message', (e: MessageEvent<{ text: string }>) => {
    try {
      const trades = parseCsvContent(e.data.text);
      self.postMessage({ success: true, trades });
    } catch (err: any) {
      self.postMessage({ success: false, error: err?.message || 'CSV parse failed' });
    }
  });
}
