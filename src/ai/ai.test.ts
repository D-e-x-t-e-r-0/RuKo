import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateTriggers,
  validateQuestion,
  validateSummary,
  hasBannedWords,
} from '../../api/validate';
import { getFallbackTriggers, getFallbackQuestion, getFallbackSummary } from './fallback';
import { askAI, setAIEnabled } from './ai';
import handler from '../../api/ai';

describe('Phase 3: Server Validator Tests (api/validate.ts)', () => {
  it('detects banned words in English and Hindi', () => {
    expect(hasBannedWords('You should buy this')).toBe(true);
    expect(hasBannedWords('Strong sell signal')).toBe(true);
    expect(hasBannedWords('Target price is 500')).toBe(true);
    expect(hasBannedWords('Nifty will go up')).toBe(true);
    expect(hasBannedWords('शेयर खरीद लो')).toBe(true);
    expect(hasBannedWords('इसे बेचो मत')).toBe(true);
    expect(hasBannedWords('Just feeling impatient')).toBe(false);
    expect(hasBannedWords('पिछला घाटा निकालना है')).toBe(false);
  });

  it('drops triggers where evidence is not a substring of the why text', () => {
    const whyText = 'Everyone in my office is talking about this trade.';
    const raw = {
      triggers: [
        { type: 'fomo', evidence: 'Everyone in my office' }, // valid substring
        { type: 'revenge', evidence: 'win back my money' }, // NOT in why text
      ],
    };

    const res = validateTriggers(raw, whyText);
    expect(res).not.toBeNull();
    expect(res?.triggers.length).toBe(1);
    expect(res?.triggers[0].type).toBe('fomo');
    expect(res?.triggers[0].evidence).toBe('Everyone in my office');
  });

  it('drops triggers where evidence is longer than 8 words', () => {
    const whyText = 'one two three four five six seven eight nine ten eleven';
    const raw = {
      triggers: [
        {
          type: 'fomo',
          evidence: 'one two three four five six seven eight nine', // 9 words
        },
      ],
    };

    const res = validateTriggers(raw, whyText);
    expect(res?.triggers.length).toBe(0);
  });

  it('rejects questions exceeding 160 characters or containing banned words', () => {
    const validQ = validateQuestion({ question: 'What would you tell a friend right now?' });
    expect(validQ?.question).toBe('What would you tell a friend right now?');

    const longText = 'A'.repeat(161);
    const longQ = validateQuestion({ question: longText });
    expect(longQ).toBeNull();

    const bannedQ = validateQuestion({ question: 'Should you buy this now?' });
    expect(bannedQ).toBeNull();
  });

  it('rejects summaries exceeding 400 characters or containing banned words', () => {
    const validS = validateSummary({ summary: 'This week you paused 4 times.' });
    expect(validS?.summary).toBe('This week you paused 4 times.');

    const longS = validateSummary({ summary: 'B'.repeat(401) });
    expect(longS).toBeNull();

    const bannedS = validateSummary({ summary: 'Best stock performance observed.' });
    expect(bannedS).toBeNull();
  });
});

describe('Phase 3: Fallback Keyword Tests (English and Hindi)', () => {
  it('identifies FOMO triggers in English and Hindi', () => {
    const en = getFallbackTriggers('I feel like everyone is making money and I will miss out');
    expect(en.some(t => t.type === 'fomo')).toBe(true);

    const hi = getFallbackTriggers('सब लोग इसी में पैसा बना रहे हैं, मौका है');
    expect(hi.some(t => t.type === 'fomo')).toBe(true);
  });

  it('identifies revenge triggers in English and Hindi', () => {
    const en = getFallbackTriggers('I need to win back what I lost earlier');
    expect(en.some(t => t.type === 'revenge')).toBe(true);

    const hi = getFallbackTriggers('पिछला घाटा निकालना है किसी भी तरह');
    expect(hi.some(t => t.type === 'revenge')).toBe(true);
  });

  it('identifies tip_following triggers in English and Hindi', () => {
    const en = getFallbackTriggers('A guy in my telegram group told me about it');
    expect(en.some(t => t.type === 'tip_following')).toBe(true);

    const hi = getFallbackTriggers('व्हाट्सऐप ग्रुप में किसी ने बताया था');
    expect(hi.some(t => t.type === 'tip_following')).toBe(true);
  });

  it('identifies greed, fear, and overconfidence triggers', () => {
    const greed = getFallbackTriggers('This will double in two days');
    expect(greed.some(t => t.type === 'greed')).toBe(true);

    const fear = getFallbackTriggers('I am panic trading right now');
    expect(fear.some(t => t.type === 'fear')).toBe(true);

    const overconf = getFallbackTriggers('I am sure this is guaranteed');
    expect(overconf.some(t => t.type === 'overconfidence')).toBe(true);
  });

  it('returns appropriate fallback questions and summaries', () => {
    const qLate = getFallbackQuestion(['late_night'], 'en');
    expect(qLate).toContain('2 pm tomorrow');

    const sWeek = getFallbackSummary({ pauses: 3, abandoned: 1, delayed: 1 }, 'hi');
    expect(sWeek).toContain('3 बार रुके');
  });
});

describe('Phase 3: Client askAI Guardrails', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    (global as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach(k => delete store[k]);
      },
    };
  });

  it('askAI returns null when ruko.ai is off or unset', async () => {
    setAIEnabled(false);
    const resOff = await askAI('triggers', 'en', { why: 'test' });
    expect(resOff).toBeNull();

    localStorage.removeItem('ruko.ai');
    const resUnset = await askAI('triggers', 'en', { why: 'test' });
    expect(resUnset).toBeNull();
  });
});

describe('Phase 3: Gemini API Serverless Handler (api/ai.ts)', () => {
  const originalEnv = { ...process.env };
  let testIpCounter = 1;

  function createMockReqRes(options: {
    method?: string;
    body?: any;
    ip?: string;
  }) {
    const ip = options.ip || `198.51.100.${testIpCounter++}`;
    const req = {
      method: options.method ?? 'POST',
      headers: {
        'x-forwarded-for': ip,
      },
      body: options.body,
    };

    let statusCode = 200;
    let jsonBody: any = null;

    const res = {
      status(code: number) {
        statusCode = code;
        return {
          json(data: any) {
            jsonBody = data;
            return { statusCode, data };
          },
        };
      },
    };

    return {
      req,
      res,
      getStatus: () => statusCode,
      getJson: () => jsonBody,
    };
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('rejects non-POST requests with 405', async () => {
    const { req, res, getStatus, getJson } = createMockReqRes({ method: 'GET' });
    await handler(req, res);
    expect(getStatus()).toBe(405);
    expect(getJson()).toEqual({ ok: false });
  });

  it('returns 503 when neither GEMINI_API_KEY nor ANTHROPIC_API_KEY is configured', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const { req, res, getStatus, getJson } = createMockReqRes({
      body: { task: 'triggers', lang: 'en', payload: { why: 'FOMO trading' } },
    });
    await handler(req, res);
    expect(getStatus()).toBe(503);
    expect(getJson()).toEqual({ ok: false, error: 'AI key not configured' });
  });

  it('uses GEMINI_API_KEY and defaults model to gemini-1.5-flash', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key-123';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_MODEL;

    let calledUrl = '';
    let calledOptions: any = null;

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, opts: any) => {
      calledUrl = url;
      calledOptions = opts;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      triggers: [{ type: 'fomo', evidence: 'feel like everyone' }],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
    }));

    const whyText = 'I feel like everyone is making money';
    const { req, res, getStatus, getJson } = createMockReqRes({
      body: { task: 'triggers', lang: 'en', payload: { why: whyText } },
    });

    await handler(req, res);

    expect(getStatus()).toBe(200);
    expect(getJson().ok).toBe(true);
    expect(getJson().data.triggers).toHaveLength(1);
    expect(getJson().data.triggers[0].type).toBe('fomo');

    // Verify endpoint, header, and body formatting
    expect(calledUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
    );
    expect(calledOptions.headers['x-goog-api-key']).toBe('test-gemini-key-123');
    expect(calledOptions.headers['content-type']).toBe('application/json');

    const parsedBody = JSON.parse(calledOptions.body);
    expect(parsedBody.systemInstruction.parts[0].text).toContain('reflection assistant inside Ruko');
    expect(parsedBody.contents[0].parts[0].text).toContain(whyText);
    expect(parsedBody.generationConfig.responseMimeType).toBe('application/json');
  });

  it('falls back to ANTHROPIC_API_KEY when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'fallback-key-abc';

    let calledOptions: any = null;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, opts: any) => {
      calledOptions = opts;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ triggers: [] }) }],
              },
            },
          ],
        }),
      });
    }));

    const { req, res, getStatus } = createMockReqRes({
      body: { task: 'triggers', lang: 'en', payload: { why: 'no triggers here' } },
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    expect(calledOptions.headers['x-goog-api-key']).toBe('fallback-key-abc');
  });

  it('respects custom AI_MODEL and ignores legacy claude models', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    // 1. Custom Gemini model
    process.env.AI_MODEL = 'gemini-2.0-flash';
    let calledUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      calledUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ triggers: [] }) }],
              },
            },
          ],
        }),
      });
    }));

    const mock1 = createMockReqRes({
      body: { task: 'triggers', lang: 'en', payload: { why: 'test' } },
    });
    await handler(mock1.req, mock1.res);
    expect(calledUrl).toContain('models/gemini-2.0-flash:generateContent');

    // 2. Legacy claude model -> falls back to gemini-1.5-flash
    process.env.AI_MODEL = 'claude-haiku-4-5-20251001';
    const mock2 = createMockReqRes({
      body: { task: 'triggers', lang: 'en', payload: { why: 'test' } },
    });
    await handler(mock2.req, mock2.res);
    expect(calledUrl).toContain('models/gemini-1.5-flash:generateContent');
  });

  it('handles question task and markdown code fences in Gemini output', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n{"question": "What would happen if you paused for 10 minutes?"}\n```',
                },
              ],
            },
          },
        ],
      }),
    }));

    const { req, res, getStatus, getJson } = createMockReqRes({
      body: { task: 'question', lang: 'en', payload: { why: 'test' } },
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().data.question).toBe('What would happen if you paused for 10 minutes?');
  });

  it('rejects Gemini responses that violate guardrails with 422', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    // Model attempts to give financial advice
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ question: 'You should buy this stock now.' }),
                },
              ],
            },
          },
        ],
      }),
    }));

    const { req, res, getStatus, getJson } = createMockReqRes({
      body: { task: 'question', lang: 'en', payload: { why: 'test' } },
    });

    await handler(req, res);
    expect(getStatus()).toBe(422);
    expect(getJson()).toEqual({ ok: false });
  });

  it('returns 502 when Gemini API returns non-ok status or empty content', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    // Non-ok response from Gemini
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    }));

    const mock1 = createMockReqRes({
      body: { task: 'triggers', lang: 'en', payload: { why: 'test' } },
    });
    await handler(mock1.req, mock1.res);
    expect(mock1.getStatus()).toBe(502);
    expect(mock1.getJson()).toEqual({ ok: false });

    // Empty content (e.g. filtered by safety)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: 'SAFETY' }],
      }),
    }));

    const mock2 = createMockReqRes({
      body: { task: 'triggers', lang: 'en', payload: { why: 'test' } },
    });
    await handler(mock2.req, mock2.res);
    expect(mock2.getStatus()).toBe(502);
    expect(mock2.getJson()).toEqual({ ok: false });
  });

  it('returns 500 without leaking secrets when JSON parsing fails', async () => {
    process.env.GEMINI_API_KEY = 'super-secret-key-12345';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'This is not valid JSON at all' }],
            },
          },
        ],
      }),
    }));

    const { req, res, getStatus, getJson } = createMockReqRes({
      body: { task: 'triggers', lang: 'en', payload: { why: 'test' } },
    });

    await handler(req, res);
    expect(getStatus()).toBe(500);
    expect(getJson()).toEqual({ ok: false });
    // Verify no secret leak
    expect(JSON.stringify(getJson())).not.toContain('super-secret-key-12345');
  });

  it('supports Web standard Response objects when res is omitted (Netlify Functions v2)', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ summary: 'Calm reflection week.' }) }],
            },
          },
        ],
      }),
    }));

    const req = new Request('https://example.com/api/ai', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '12.34.56.78',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ task: 'summary', lang: 'en', payload: { pauses: 2 } }),
    });

    // Invoke without second argument (Netlify / Fetch standard)
    const res = await handler(req);
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.summary).toBe('Calm reflection week.');
  });

  it('normalizes models/ prefix in AI_MODEL environment variable', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'models/gemini-2.0-flash';

    let calledUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      calledUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ triggers: [] }) }],
              },
            },
          ],
        }),
      });
    }));

    const req = new Request('https://example.com/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'triggers', lang: 'en', payload: { why: 'test' } }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(calledUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
    );
  });

  it('handles uppercase markdown code fences and conversational preambles', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    // Model returns preamble + uppercase ```JSON fence
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Here is your reflection:\n```JSON\n{"question": "How are you feeling right now?"}\n```',
                },
              ],
            },
          },
        ],
      }),
    }));

    const req = new Request('https://example.com/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'question', lang: 'en', payload: { why: 'test' } }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.question).toBe('How are you feeling right now?');
  });

  it('returns appropriate Response objects on errors without res parameter', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    // 1. GET request without res
    const getReq = new Request('https://example.com/api/ai', { method: 'GET' });
    const getRes = await handler(getReq);
    expect(getRes.status).toBe(405);
    expect(await getRes.json()).toEqual({ ok: false });

    // 2. 503 missing key without res
    const postReq = new Request('https://example.com/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'triggers', lang: 'en', payload: { why: 'test' } }),
    });
    const keyRes = await handler(postReq);
    expect(keyRes.status).toBe(503);
    expect(await keyRes.json()).toEqual({ ok: false, error: 'AI key not configured' });
  });
});
