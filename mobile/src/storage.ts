import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Decision, Funding, PracticeSession, PracticeTrade, Rule, Trade } from './types';

const K = {
  trades: 'ruko.trades',
  decisions: 'ruko.decisions',
  rules: 'ruko.rules',
  practiceTrades: 'ruko.practiceTrades',
  sessions: 'ruko.sessions',
  prefs: 'ruko.prefs',
} as const;

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (_) {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

let seq = Date.now();
function nid(): number {
  seq += 1;
  return seq;
}

export const store = {
  async trades(): Promise<Trade[]> {
    return read<Trade[]>(K.trades, []);
  },
  async addTrade(t: Omit<Trade, 'id'>): Promise<number> {
    const all = await read<Trade[]>(K.trades, []);
    const id = nid();
    await write(K.trades, [...all, { ...t, id }]);
    return id;
  },
  async decisions(): Promise<Decision[]> {
    return read<Decision[]>(K.decisions, []);
  },
  async addDecision(d: Omit<Decision, 'id'>): Promise<number> {
    const all = await read<Decision[]>(K.decisions, []);
    const id = nid();
    await write(K.decisions, [...all, { ...d, id }]);
    return id;
  },
  async updateDecision(id: number, patch: Partial<Decision>): Promise<void> {
    const all = await read<Decision[]>(K.decisions, []);
    await write(
      K.decisions,
      all.map(d => (d.id === id ? { ...d, ...patch } : d))
    );
  },
  async rules(): Promise<Rule[]> {
    return read<Rule[]>(K.rules, []);
  },
  async addRule(text: string): Promise<void> {
    const all = await read<Rule[]>(K.rules, []);
    await write(K.rules, [...all, { id: nid(), text }]);
  },
  async deleteRule(id?: number): Promise<void> {
    const all = await read<Rule[]>(K.rules, []);
    await write(K.rules, all.filter(r => r.id !== id));
  },
  async practiceTrades(): Promise<PracticeTrade[]> {
    return read<PracticeTrade[]>(K.practiceTrades, []);
  },
  async addPracticeTrade(t: Omit<PracticeTrade, 'id'>): Promise<number> {
    const all = await read<PracticeTrade[]>(K.practiceTrades, []);
    const id = nid();
    await write(K.practiceTrades, [...all, { ...t, id }]);
    return id;
  },
  async sessions(): Promise<PracticeSession[]> {
    return read<PracticeSession[]>(K.sessions, []);
  },
  async addSession(s: Omit<PracticeSession, 'id'>): Promise<number> {
    const all = await read<PracticeSession[]>(K.sessions, []);
    const id = nid();
    await write(K.sessions, [...all, { ...s, id }]);
    return id;
  },
  async updateSession(id: number, patch: Partial<PracticeSession>): Promise<void> {
    const all = await read<PracticeSession[]>(K.sessions, []);
    await write(
      K.sessions,
      all.map(s => (s.id === id ? { ...s, ...patch } : s))
    );
  },
  async clearAll(): Promise<void> {
    await Promise.all(
      [K.trades, K.decisions, K.rules, K.practiceTrades, K.sessions].map(k =>
        AsyncStorage.removeItem(k).catch(() => {})
      )
    );
  },
  async getPref(key: string): Promise<string | null> {
    try {
      const raw = await AsyncStorage.getItem(K.prefs);
      const obj = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      return obj[key] ?? null;
    } catch (_) {
      return null;
    }
  },
  async setPref(key: string, value: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(K.prefs);
      const obj = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      obj[key] = value;
      await AsyncStorage.setItem(K.prefs, JSON.stringify(obj));
    } catch (_) {}
  },
};

/** First-run demo content so every screen has something to mirror. */
export async function seedDemo(): Promise<void> {
  const existing = await store.decisions();
  if (existing.length > 0) return;
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  await store.addRule('I take a 30 minute break after any loss.');
  await store.addTrade({ ts: now - 2 * day, amount: 5000, pnl: -1200, funding: 'savings' as Funding });
  await store.addTrade({ ts: now - 2 * day + 3600 * 1000, amount: 8000, pnl: -2100, funding: 'savings' as Funding });
  await store.addTrade({ ts: now - day, amount: 4000, pnl: 900, funding: 'savings' as Funding });
  await store.addDecision({
    ts: now - day,
    why: 'Charts looked strong and I felt confident.',
    horizon: 'days',
    funding: 'savings',
    maxLoss: 1000,
    amount: 4000,
    level: 'caution',
    firedSignals: ['size_escalation'],
    outcome: 'proceeded',
    reflections: [],
    triggers: [],
    mode: 'real',
  });
  await store.addDecision({
    ts: now - 3 * 3600 * 1000,
    why: 'Everyone in the group was buying.',
    horizon: 'today',
    funding: 'savings',
    maxLoss: 500,
    amount: 10000,
    level: 'high',
    firedSignals: ['late_night', 'quick_reentry_after_loss', 'size_escalation'],
    outcome: 'abandoned',
    reflections: [],
    triggers: [],
    mode: 'real',
  });
}
