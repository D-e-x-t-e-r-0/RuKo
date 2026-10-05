import { newSession, type BotSession } from './telegram-bot';

// Session store with 24h TTL + file fallback for Pi.
// - Serverless (Vercel/Netlify): in-memory Map, best-effort (cold starts may drop).
// - Pi (Node preview / Docker): same Map + JSON file so reboot keeps /mirror counts.
// Never stores amounts/why beyond the live ritual — stats only live long-term.

const TTL_MS = 24 * 3600_000;
const sessions = new Map<number, { s: BotSession; touched: number }>();

let filePath: string | null = null;
try {
  if (typeof process !== 'undefined' && process.env.RUKO_SESSION_FILE) {
    filePath = process.env.RUKO_SESSION_FILE;
  }
} catch { /* keyless */ }

function nowMs(): number { return Date.now(); }

export function getSession(chatId: number, lang: 'hi' | 'en' = 'hi'): BotSession {
  sweep();
  const hit = sessions.get(chatId);
  if (hit) {
    hit.touched = nowMs();
    return hit.s;
  }
  const s = newSession(lang);
  // Try file restore for stats
  if (filePath) {
    try {
      const all = readAll();
      const saved = (all as any)[String(chatId)];
      if (saved?.stats) s.stats = saved.stats;
      if (saved?.lang) s.lang = saved.lang;
    } catch { /* fresh */ }
  }
  sessions.set(chatId, { s, touched: nowMs() });
  return s;
}

export function saveSession(chatId: number): void {
  const hit = sessions.get(chatId);
  if (!hit) return;
  hit.touched = nowMs();
  if (!filePath) return;
  try {
    const all = readAll();
    (all as any)[String(chatId)] = { stats: hit.s.stats, lang: hit.s.lang, touched: hit.touched };
    writeAll(all);
  } catch { /* best-effort */ }
}

export function sweep(now = nowMs()): number {
  let dropped = 0;
  for (const [k, v] of sessions) {
    if (now - v.touched > TTL_MS) {
      sessions.delete(k);
      dropped++;
    }
  }
  return dropped;
}

function readAll(): Record<string, any> {
  if (!filePath) return {};
  const fs = require('node:fs');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, any>): void {
  if (!filePath) return;
  const fs = require('node:fs');
  const path = require('node:path');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(all).slice(0, 200_000));
}
