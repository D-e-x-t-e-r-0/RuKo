import { describe, it, expect } from 'vitest';
import {
  newSession,
  handleCommand,
  handleText,
  handleCallback,
  applyTriggersResult,
  applyQuestionResult,
  evaluatePressure,
  extractAmount,
  istParts,
  type BotAction,
  type BotSession,
} from './telegram-bot';
import { frictionSeconds } from '../src/engine/pressure';

// Deterministic instants (IST = UTC+5:30)
const NOON_IST = Date.UTC(2026, 9, 5, 6, 30); // 12:00 IST
const LATE_NIGHT_IST = Date.UTC(2026, 9, 5, 17, 30); // 23:00 IST
const ONE_AM_IST = Date.UTC(2026, 9, 5, 19, 30); // 01:00 IST next day

function sends(actions: BotAction[]): string[] {
  return actions.filter(a => a.kind === 'send').map(a => (a as any).text);
}

function lastKeyboard(actions: BotAction[]) {
  for (let i = actions.length - 1; i >= 0; i--) {
    const a = actions[i] as any;
    if (a.kind === 'send' && a.keyboard) return a.keyboard;
  }
  return null;
}

/** Drive a session through the whole quick-check with fixed answers. */
function quickCheck(
  s: BotSession,
  now: number,
  opts: { amount: string; fund: string; size: string; last: string; tt: string }
): BotAction[] {
  const out: BotAction[] = [];
  out.push(...handleText(s, opts.amount, now));
  out.push(...handleCallback(s, `fund:${opts.fund}`, now));
  out.push(...handleCallback(s, `size:${opts.size}`, now));
  out.push(...handleCallback(s, `last:${opts.last}`, now));
  out.push(...handleCallback(s, `tt:${opts.tt}`, now));
  return out;
}

describe('Telegram bot: language + onboarding', () => {
  it('greets bilingually on /start and stores language choice', () => {
    const s = newSession();
    const start = handleCommand(s, '/start', NOON_IST);
    expect(s.stage).toBe('lang');
    expect(start[0].kind).toBe('send');
    const text = (start[0] as any).text;
    expect(text).toContain('Ruko (रुको)');

    const intro = handleCallback(s, 'lang:en', NOON_IST);
    expect(s.lang).toBe('en');
    expect(s.stage).toBe('idle');
    expect((intro[0] as any).text).toContain('Namaste');
  });

  it('defaults to Hindi and switches fully', () => {
    const s = newSession();
    handleCommand(s, '/start', NOON_IST);
    handleCallback(s, 'lang:hi', NOON_IST);
    expect(s.lang).toBe('hi');
    const pause = handleCommand(s, '/pause', NOON_IST);
    expect((pause[0] as any).text).toContain('कदम 1/5');
  });

  it('lists commands on /help and unknown commands', () => {
    const s = newSession();
    for (const cmd of ['/help', '/banana']) {
      const actions = handleCommand(s, cmd, NOON_IST);
      expect((actions[0] as any).text).toContain('/pause');
    }
  });
});

describe('Telegram bot: pressure signals (same engine as the app)', () => {
  it('fires no signals for a calm daytime entry', () => {
    const s = newSession();
    s.lang = 'en';
    s.amount = 5000;
    s.funding = 'savings';
    s.sizeBigger = false;
    s.last = 'none';
    s.tradesToday = 0;
    const { signals, level } = evaluatePressure(s, NOON_IST);
    expect(signals.filter(x => x.fired)).toHaveLength(0);
    expect(level).toBe('calm');
  });

  it('fires late_night, quick re-entry, size escalation, risky funding in IST', () => {
    const s = newSession();
    s.lang = 'en';
    s.amount = 5000;
    s.funding = 'loan';
    s.sizeBigger = true;
    s.last = 'loss_recent';
    s.tradesToday = 4;
    const { signals, level } = evaluatePressure(s, LATE_NIGHT_IST);
    const fired = Object.fromEntries(signals.filter(x => x.fired).map(x => [x.id, x.params]));

    expect(fired.late_night).toEqual({ hour: 23 });
    expect(fired.quick_reentry_after_loss).toEqual({ minutes: 12 });
    expect(fired.size_escalation).toBeDefined();
    expect(fired.risky_funding).toEqual({ funding: 'loan' });
    expect(fired.many_trades_today).toEqual({ count: 6 }); // 5 past + this one
    // loss_streak cannot fire: past trades are open (pnl null)
    expect(fired.loss_streak).toBeUndefined();
    expect(level).toBe('high');
  });

  it('evaluates late night in IST even when the server clock is UTC', () => {
    const s = newSession();
    s.amount = 1000;
    s.last = 'none';
    const { signals } = evaluatePressure(s, ONE_AM_IST);
    const late = signals.find(x => x.id === 'late_night');
    expect(late?.fired).toBe(true);
    expect(late?.params.hour).toBe(1);
  });

  it('maps pressure levels to the same friction seconds as the app', () => {
    expect(frictionSeconds.calm).toBe(10);
    expect(frictionSeconds.caution).toBe(30);
    expect(frictionSeconds.high).toBe(60);
  });
});

describe('Telegram bot: full ritual flow', () => {
  it('walks the 5 steps and enforces the reflection wait', () => {
    const s = newSession();
    s.lang = 'en';
    handleCommand(s, '/start', NOON_IST);
    handleCallback(s, 'lang:en', NOON_IST);

    const ritual = handleCommand(s, '/pause', NOON_IST);
    expect((ritual[0] as any).text).toContain('Step 1/5');

    const pressure = quickCheck(s, NOON_IST, {
      amount: '5,000',
      fund: 'savings',
      size: 'no',
      last: 'none',
      tt: '0',
    });
    const pressureTexts = sends(pressure).join('\n');
    expect(pressureTexts).toContain('Step 2/5');
    expect(pressureTexts).toContain('No pressure signals');
    expect(s.stage).toBe('pressure');
    expect(s.level).toBe('calm');

    // Too early → still locked, with remaining seconds
    const early = handleCallback(s, 'dec:unlock', NOON_IST + 3000);
    expect(s.stage).toBe('pressure');
    expect((early[0] as any).text).toContain('7s left');

    // After the wait → decision prompt
    const unlock = handleCallback(s, 'dec:unlock', NOON_IST + 11000);
    expect(s.stage).toBe('why');
    expect((unlock[0] as any).text).toContain('Step 4/5');

    // Why text must be at least 3 characters
    const short = handleText(s, 'no', NOON_IST + 12000);
    expect(s.stage).toBe('why');
    expect((short[0] as any).text).toContain('at least 3 characters');

    const why = handleText(s, 'I want to catch this move quickly', NOON_IST + 12000);
    expect(s.stage).toBe('horizon');
    expect((why[0] as any).text).toContain('time horizon');

    const horizon = handleCallback(s, 'horizon:days', NOON_IST + 12000);
    expect(s.stage).toBe('max_loss');
    expect((horizon[0] as any).text).toContain('loss can you accept');

    const skip = handleCallback(s, 'maxloss:skip', NOON_IST + 12000);
    expect(s.stage).toBe('reflecting');
    expect(sends(skip).join(' ')).toContain('mirror');

    // Reflection layer resolves (null → deterministic fallbacks)
    const q = applyQuestionResult(s, null);
    expect(s.stage).toBe('decision');
    const kb = (q[0] as any).keyboard;
    const data = kb.flat().map((b: any) => b.data);
    expect(data).toEqual(['dec:abandon', 'dec:wait', 'dec:proceed']);
    // The mirror message embeds user words → must be sent as plain text
    expect((q[0] as any).plain).toBe(true);

    const proceed = handleCallback(s, 'dec:proceed', NOON_IST + 12000);
    expect(s.stage).toBe('done');
    expect((proceed[0] as any).text).toContain('courage');
    expect(s.stats).toEqual({ pauses: 1, abandoned: 0, delayed: 0, proceeded: 1 });

    const mirror = handleCommand(s, '/mirror', NOON_IST + 12000);
    expect((mirror[0] as any).text).toContain('Pauses: 1');
    expect((mirror[0] as any).text).toContain('Went ahead anyway: 1');
  });

  it('abandon and wait choices update the mirror', () => {
    const s = newSession();
    s.lang = 'en';
    handleCommand(s, '/pause', NOON_IST);
    quickCheck(s, NOON_IST, { amount: '500', fund: 'loan', size: 'yes', last: 'loss_recent', tt: '4' });
    handleCallback(s, 'dec:unlock', NOON_IST + 61000);
    handleText(s, 'recovering my loss from today', NOON_IST + 61000);
    handleCallback(s, 'horizon:today', NOON_IST + 61000);
    handleCallback(s, 'maxloss:skip', NOON_IST + 61000);
    applyTriggersResult(s, null);
    const q = applyQuestionResult(s, null);
    expect(s.triggers?.some(tr => tr.type === 'revenge')).toBe(true);

    handleCallback(s, 'dec:abandon', NOON_IST + 61000);
    expect(s.stats).toEqual({ pauses: 1, abandoned: 1, delayed: 0, proceeded: 0 });
    // First fired signal is many_trades_today (tt:4) → its fallback question
    expect((q[0] as any).text).toContain('earlier trades today teach you');

    handleCommand(s, '/pause', NOON_IST + 61000);
    quickCheck(s, NOON_IST + 61000, { amount: '500', fund: 'savings', size: 'no', last: 'none', tt: '0' });
    handleCallback(s, 'dec:unlock', NOON_IST + 61000 + 11000);
    handleText(s, 'planned entry, thinking it through', NOON_IST + 62000);
    handleCallback(s, 'horizon:weeks', NOON_IST + 62000);
    handleCallback(s, 'maxloss:skip', NOON_IST + 62000);
    applyTriggersResult(s, null);
    applyQuestionResult(s, null);
    const wait = handleCallback(s, 'dec:wait', NOON_IST + 62000);
    expect(s.stats).toEqual({ pauses: 2, abandoned: 1, delayed: 1, proceeded: 0 });
    expect((wait[0] as any).text).toMatch(/Come back at \d{1,2}:\d{2}( \w{2})? IST/);
  });

  it('guards the wait: the decision button cannot skip the friction', () => {
    const s = newSession();
    s.lang = 'en';
    handleCommand(s, '/pause', NOON_IST);
    quickCheck(s, LATE_NIGHT_IST, { amount: '5000', fund: 'loan', size: 'yes', last: 'loss_recent', tt: '4' });
    expect(s.level).toBe('high');
    expect(s.unlockAt! - s.ritualStartedAt!).toBe(60000);

    const early = handleCallback(s, 'dec:unlock', LATE_NIGHT_IST + 5000);
    expect(s.stage).toBe('pressure');
    expect((early[0] as any).text).toContain('55s left');

    // The decision buttons do nothing before the unlock
    expect(handleCallback(s, 'dec:proceed', LATE_NIGHT_IST + 5000)).toEqual([]);
    expect(s.stage).toBe('pressure');
  });

  it('cancelling mid-ritual works and /start does not clobber it', () => {
    const s = newSession();
    s.lang = 'en';
    handleCommand(s, '/pause', NOON_IST);
    handleText(s, '5000', NOON_IST);
    const start = handleCommand(s, '/start', NOON_IST);
    expect((start[0] as any).text).toContain('already in progress');
    expect(s.stage).toBe('funding');

    const cancel = handleCallback(s, 'cancel', NOON_IST);
    expect(s.stage).toBe('idle');
    expect((cancel[0] as any).text).toContain('cancelled');
  });

  it('keeps every callback payload within Telegram 64-byte limit', () => {
    const s = newSession();
    const seen: string[] = [];
    const collect = (actions: BotAction[]) => {
      for (const a of actions) {
        if (a.kind === 'send' && a.keyboard) {
          for (const row of a.keyboard) for (const b of row) seen.push(b.data);
        }
      }
    };
    collect(handleCommand(s, '/start', NOON_IST));
    collect(handleCallback(s, 'lang:en', NOON_IST));
    collect(handleCommand(s, '/pause', NOON_IST));
    collect(handleText(s, '5000', NOON_IST));
    collect(handleCallback(s, 'fund:emergency', NOON_IST));
    collect(handleCallback(s, 'size:yes', NOON_IST));
    collect(handleCallback(s, 'last:loss_recent', NOON_IST));
    collect(handleCallback(s, 'tt:4', NOON_IST));
    collect(handleCallback(s, 'dec:unlock', NOON_IST + 11000));
    collect(handleCallback(s, 'horizon:weeks', NOON_IST));
    collect(handleCallback(s, 'maxloss:skip', NOON_IST));
    collect(applyQuestionResult(s, null));
    for (const data of seen) expect(data.length).toBeLessThanOrEqual(64);
  });
});

describe('Telegram bot: reflection layer integration', () => {
  it('falls back to keyword triggers and the signal-matched question', () => {
    const s = newSession();
    s.lang = 'en';
    s.why = 'A guy in my telegram group told me everyone is making money';
    const follow = applyTriggersResult(s, null);
    expect(s.triggers?.map(x => x.type)).toEqual(
      expect.arrayContaining(['tip_following', 'fomo'])
    );
    expect(follow[0]).toMatchObject({ kind: 'reflect', task: 'question' });

    const q = applyQuestionResult(s, null);
    expect(s.stage).toBe('decision');
    expect(s.question).toContain('What would you tell a friend');
    expect(q[0].kind).toBe('send');
  });

  it('accepts validated AI results and ignores failed ones', () => {
    const s = newSession();
    s.lang = 'en';
    s.why = 'everyone is buying';
    applyTriggersResult(s, { triggers: [{ type: 'fomo', evidence: 'everyone' }] });
    expect(s.triggers).toEqual([{ type: 'fomo', evidence: 'everyone' }]);

    const follow = applyTriggersResult(s, null);
    expect(follow[0]).toMatchObject({ kind: 'reflect', task: 'question' });
    expect((follow[0] as any).payload).toMatchObject({
      why: 'everyone is buying',
      triggers: [{ type: 'fomo', evidence: 'everyone' }],
    });

    applyQuestionResult(s, { question: 'What would happen if you waited?' });
    expect(s.question).toBe('What would happen if you waited?');
  });

  it('never sends amounts, funding or limits to the reflection layer', () => {
    const s = newSession();
    s.lang = 'en';
    handleCommand(s, '/pause', NOON_IST);
    quickCheck(s, LATE_NIGHT_IST, { amount: '987654', fund: 'loan', size: 'yes', last: 'loss_recent', tt: '4' });
    handleCallback(s, 'dec:unlock', LATE_NIGHT_IST + 61000);
    handleText(s, 'I want to double my money tonight', LATE_NIGHT_IST + 61000);
    handleCallback(s, 'horizon:today', LATE_NIGHT_IST + 61000);
    const reflect = handleCallback(s, 'maxloss:skip', LATE_NIGHT_IST + 61000);
    const follow = applyTriggersResult(s, null);

    const payloads = [...reflect, ...follow]
      .filter(a => a.kind === 'reflect')
      .map(a => JSON.stringify((a as any).payload));
    expect(payloads.length).toBe(2);
    // 1st call: triggers — only the typed why sentence
    expect(Object.keys(JSON.parse(payloads[0])).sort()).toEqual(['why']);
    // 2nd call: question — why + validated triggers + fired signal IDs
    expect(Object.keys(JSON.parse(payloads[1])).sort()).toEqual([
      'signals',
      'triggers',
      'why',
    ]);
    for (const p of payloads) {
      expect(p).not.toContain('987654');
      expect(p).not.toContain('loan');
    }
  });
});

describe('Telegram bot: input parsing', () => {
  it('extracts plain rupee amounts', () => {
    expect(extractAmount('5000')).toBe(5000);
    expect(extractAmount('₹ 5,000')).toBe(5000);
    expect(extractAmount(' 5000 ')).toBe(5000);
    expect(extractAmount('five thousand')).toBeNull();
    expect(extractAmount('-500')).toBeNull();
    expect(extractAmount('')).toBeNull();
  });

  it('re-prompts on a bad amount without advancing the stage', () => {
    const s = newSession();
    s.lang = 'en';
    handleCommand(s, '/pause', NOON_IST);
    const retry = handleText(s, 'five thousand', NOON_IST);
    expect(s.stage).toBe('amount');
    expect((retry[0] as any).text).toContain('plain number');
  });

  it('nudges instead of crashing on stray text or callbacks', () => {
    const s = newSession();
    s.lang = 'en';
    expect(sends(handleText(s, 'hello', NOON_IST))[0]).toContain('/pause');

    handleCommand(s, '/pause', NOON_IST);
    handleText(s, '5000', NOON_IST);
    // wrong-stage callback is a no-op
    expect(handleCallback(s, 'size:yes', NOON_IST)).toEqual([]);
    // stray text mid-ritual nudges back to the buttons
    expect(sends(handleText(s, 'hmm idk', NOON_IST))[0]).toContain('already in progress');

    // malformed callback is a no-op
    expect(handleCallback(s, 'junk', NOON_IST)).toEqual([]);
  });

  it('splits IST hour and IST calendar-day start correctly', () => {
    const { hour, dayStart } = istParts(LATE_NIGHT_IST);
    expect(hour).toBe(23);
    // 23:00 IST on Oct 5 → day starts 00:00 IST Oct 5 = 18:30 UTC Oct 4
    expect(dayStart).toBe(Date.UTC(2026, 9, 4, 18, 30));
  });
});
