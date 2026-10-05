import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler, { _testResetSessions, _testSessionFor } from './telegram';

/**
 * End-to-end webhook tests for /api/telegram (Node-style req/res, the
 * Vercel / dev-shim shape). fetch is stubbed for both the Telegram API and
 * Groq so no real network happens.
 */

const sendCalls: Array<{ url: string; body: any }> = [];
const groqCalls: Array<{ url: string; body: any }> = [];

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string, opts?: any) => {
      const raw = typeof opts?.body === 'string' ? JSON.parse(opts.body) : opts?.body ?? {};
      if (String(url).includes('api.telegram.org')) {
        if (String(url).endsWith('/sendMessage')) {
          sendCalls.push({ url: String(url), body: raw });
        }
        return { ok: true, json: async () => ({ ok: true }) };
      }
      // Groq reflection call — prompt determines the schema
      groqCalls.push({ url: String(url), body: raw });
      const isTriggers = String(raw.messages?.[1]?.content ?? '').startsWith('Task: Identify');
      const content = isTriggers
        ? JSON.stringify({ triggers: [{ type: 'fomo', evidence: 'everyone' }] })
        : JSON.stringify({ question: 'What would you tell a friend about waiting?' });
      return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
    })
  );
}

function mockRes() {
  let status = 200;
  let json: any = null;
  return {
    status(code: number) {
      return {
        json(data: any) {
          status = code;
          json = data;
        },
      };
    },
    getStatus: () => status,
    getJson: () => json,
  };
}

function updateReq(update: any, extraHeaders: Record<string, string> = {}) {
  return {
    method: 'POST',
    headers: extraHeaders,
    body: update,
  };
}

function sentData(): string[] {
  return sendCalls.flatMap(c =>
    (c.body.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data)
  );
}

const originalEnv = { ...process.env };

describe('/api/telegram webhook', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    _testResetSessions();
    sendCalls.length = 0;
    groqCalls.length = 0;
    stubFetch();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('health check on GET reports service and token state', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.getStatus()).toBe(200);
    expect(res.getJson()).toMatchObject({ ok: true, service: 'ruko-telegram-webhook' });
  });

  it('returns 503 when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const res = mockRes();
    await handler(updateReq({}), res);
    expect(res.getStatus()).toBe(503);
  });

  it('rejects updates with a wrong secret token', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'shhh';
    const res = mockRes();
    await handler(updateReq({}, { 'x-telegram-bot-api-secret-token': 'wrong' }), res);
    expect(res.getStatus()).toBe(401);
  });

  it('accepts updates with the right secret token', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'shhh';
    const res = mockRes();
    await handler(
      updateReq(
        { message: { chat: { id: 1 }, text: '/start' } },
        { 'x-telegram-bot-api-secret-token': 'shhh' }
      ),
      res
    );
    expect(res.getStatus()).toBe(200);
    expect(res.getJson()).toEqual({ ok: true });
    expect(sendCalls[0].body.text).toContain('Ruko');
  });

  it('sends the bilingual welcome for /start', async () => {
    const res = mockRes();
    await handler(updateReq({ message: { chat: { id: 7 }, text: '/start' } }), res);
    expect(res.getStatus()).toBe(200);
    const call = sendCalls[0];
    expect(call.url).toBe('https://api.telegram.org/bottest-token/sendMessage');
    expect(call.body.chat_id).toBe(7);
    expect(call.body.text).toContain('pause ritual');
    expect(call.body.reply_markup.inline_keyboard[0][0].callback_data).toBe('lang:hi');
  });

  it('drives a full ritual end-to-end with fallback reflection', async () => {
    const res = mockRes();
    const chat = { id: 42 };
    const upd = (text?: string, data?: string) =>
      text ? { message: { chat, text } } : { callback_query: { id: 'cb', data, message: { chat } } };

    await handler(updateReq(upd('/start')), res);
    await handler(updateReq(upd(undefined, 'lang:en')), res);
    await handler(updateReq(upd('/pause')), res);
    await handler(updateReq(upd('5000')), res);
    await handler(updateReq(upd(undefined, 'fund:savings')), res);
    await handler(updateReq(upd(undefined, 'size:no')), res);
    await handler(updateReq(upd(undefined, 'last:none')), res);
    await handler(updateReq(upd(undefined, 'tt:0')), res);

    // Calm level → 10s friction; the unlock button was offered
    expect(sentData()).toContain('dec:unlock');

    // Early tap → still breathing, still locked
    await handler(updateReq(upd(undefined, 'dec:unlock')), res);
    expect(_testSessionFor(42)!.stage).toBe('pressure');
    expect(sendCalls.at(-1)!.body.text).toMatch(/Still breathing/);

    // Force the window open (no real 10s wait in tests) → decision prompt
    _testSessionFor(42)!.unlockAt = Date.now() - 1;
    await handler(updateReq(upd(undefined, 'dec:unlock')), res);
    expect(_testSessionFor(42)!.stage).toBe('why');
    expect(sendCalls.at(-1)!.body.text).toContain('Why are you making this trade');

    await handler(updateReq(upd('everyone is buying because a youtube tip said so')), res);
    await handler(updateReq(upd(undefined, 'horizon:today')), res);

    // No AI key configured → reflection must fall back, not crash
    await handler(updateReq(upd(undefined, 'maxloss:skip')), res);
    expect(groqCalls).toHaveLength(0); // 503 → no Groq traffic
    expect(sendCalls.some(c => c.body.text.includes('FOMO'))).toBe(true);

    const kb = sendCalls.at(-1)!.body.reply_markup.inline_keyboard.flat();
    expect(kb.map((b: any) => b.callback_data)).toEqual(['dec:abandon', 'dec:wait', 'dec:proceed']);

    await handler(updateReq(upd(undefined, 'dec:proceed')), res);
    expect(sendCalls.at(-1)!.body.text).toContain('courage');
    expect(_testSessionFor(42)!.stage).toBe('done');
  });

  it('reuses the shared reflection layer (same Groq prompts as /api/ai)', async () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    const res = mockRes();
    const chat = { id: 9 };
    const upd = (text?: string, data?: string) =>
      text ? { message: { chat, text } } : { callback_query: { id: 'cb', data, message: { chat } } };

    await handler(updateReq(upd('/start')), res);
    await handler(updateReq(upd(undefined, 'lang:en')), res);
    await handler(updateReq(upd('/pause')), res);
    await handler(updateReq(upd('1000')), res);
    await handler(updateReq(upd(undefined, 'fund:loan')), res);
    await handler(updateReq(upd(undefined, 'size:no')), res);
    await handler(updateReq(upd(undefined, 'last:none')), res);
    await handler(updateReq(upd(undefined, 'tt:0')), res);
    _testSessionFor(9)!.unlockAt = Date.now() - 1;
    await handler(updateReq(upd(undefined, 'dec:unlock')), res);
    await handler(updateReq(upd('everyone is buying')), res);
    await handler(updateReq(upd(undefined, 'horizon:today')), res);
    groqCalls.length = 0;
    await handler(updateReq(upd(undefined, 'maxloss:skip')), res);

    expect(groqCalls).toHaveLength(2); // triggers, then question
    const triggersBody = groqCalls[0].body;
    expect(triggersBody.model).toBe('llama-3.3-70b-versatile');
    expect(triggersBody.messages[0].content).toContain('reflection assistant inside Ruko');
    expect(triggersBody.messages[1].content).toContain('everyone is buying');
    // privacy: no amount/funding ever reaches the AI layer
    expect(JSON.stringify(groqCalls[0].body)).not.toContain('1000');
    expect(JSON.stringify(groqCalls[1].body)).not.toContain('loan');
    // validated AI question actually surfaced
    expect(sendCalls.at(-1)!.body.text).toContain('What would you tell a friend about waiting?');
  });

  it('always answers 200 when an unknown update shape arrives', async () => {
    const res = mockRes();
    await handler(updateReq({ photo_message: {} }), res);
    expect(res.getStatus()).toBe(200);
    expect(sendCalls).toHaveLength(0);
  });
});