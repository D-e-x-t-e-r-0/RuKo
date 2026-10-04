export type Funding = 'savings' | 'emergency' | 'loan';
export type Horizon = 'today' | 'days' | 'weeks';
export type Outcome = 'proceeded' | 'abandoned' | 'delayed';
export type Level = 'calm' | 'caution' | 'high';

export interface Trade {
  id?: number;
  ts: number;            // epoch ms
  amount: number;        // rupees put in
  pnl: number | null;    // rupees, negative = loss, null = not closed yet
  funding: Funding;
}

export interface ReflectionAnswer {
  qid: string;
  answer: string;
}

export interface TriggerItem {
  type: string;
  evidence: string;
}

export interface Decision {
  id?: number;
  ts: number;
  why: string;
  horizon: Horizon;
  funding: Funding;
  maxLoss: number;       // rupees
  amount: number;        // planned amount in rupees
  level: Level;
  firedSignals: string[]; // signal ids
  outcome: Outcome;
  reflection?: string;   // morning-after text
  feeling?: 'calm' | 'regret' | 'unsure';
  reflections?: ReflectionAnswer[];
  triggers?: TriggerItem[];
  mode?: 'real' | 'practice';
}

export interface Rule {
  id?: number;
  text: string;
}

export interface Signal {
  id: string;
  fired: boolean;
  params: Record<string, number | string>;
}

export interface PracticeTrade {
  id?: number;
  sessionId?: number;
  ts: number;
  amount: number;
  pnl: number | null;
  funding: Funding;
  instrument?: string;
  entryPrice?: number;
  closePrice?: number;
  leverage?: number;
}

export interface PracticeSession {
  id?: number;
  startedAt: number;
  scenario: string;
  pauseEnabled: boolean;
  endedAt?: number;
  tradesOpened?: number;
  tradesAfterLoss?: number;
  sizeIncreasePercent?: number;
  maxDrawdownPercent?: number;
  finalPnl?: number;
  pausesTaken?: number;
  abandonedOrDelayed?: number;
  observedSignals?: string[];
  selfReflection?: string;
}
