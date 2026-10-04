import Dexie, { type EntityTable } from 'dexie';
import type { Trade, Decision, Rule, PracticeTrade, PracticeSession } from './types';

export class RukoDatabase extends Dexie {
  trades!: EntityTable<Trade, 'id'>;
  decisions!: EntityTable<Decision, 'id'>;
  rules!: EntityTable<Rule, 'id'>;
  practiceTrades!: EntityTable<PracticeTrade, 'id'>;
  sessions!: EntityTable<PracticeSession, 'id'>;

  constructor() {
    super('ruko');
    this.version(1).stores({
      trades: '++id, ts',
      decisions: '++id, ts',
      rules: '++id',
    });
    this.version(2).stores({
      trades: '++id, ts',
      decisions: '++id, ts, mode',
      rules: '++id',
    });
    this.version(3).stores({
      trades: '++id, ts',
      decisions: '++id, ts, mode',
      rules: '++id',
      practiceTrades: '++id, ts, sessionId',
      sessions: '++id, startedAt',
    });
  }
}

export const db = new RukoDatabase();

export async function clearAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.trades, db.decisions, db.rules, db.practiceTrades, db.sessions],
    async () => {
      await Promise.all([
        db.trades.clear(),
        db.decisions.clear(),
        db.rules.clear(),
        db.practiceTrades.clear(),
        db.sessions.clear(),
      ]);
    }
  );
}
