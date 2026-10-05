import {
  handleCallback,
  handleText,
  newSession,
  applyTriggersResult,
  applyQuestionResult,
  type BotAction,
  type BotSession,
} from './telegram-bot';
import { runReflectionTask } from './ai-core';

/**
 * `/api/telegram` — the Telegram webhook endpoint.
 *
 * Any Telegram bot token can be "plugged into" the deployed app with a
 * single `setWebhook` call (see `scripts/set-webhook.mjs` or the README).
 * The endpoint then delivers the full 5-screen Ruko pause ritual as a
 * Telegram-native chat and reuses the exact same reflection layer as
 * `/api/ai` (same prompts, same zero-advisory validator, same fallbacks).
 *
 * Supported on every host that serves `api/*`:
 * - Vercel (serverless function, auto-detected)
 * - Netlify (wrapper in `netlify/functions/telegram.ts`)
 * - local `vite dev` (dev shim in `vite-plugin-dev-api.ts`)
 *
 * Session state is kept in memory per chat with a 24h TTL. This is
 * best-effort on serverless platforms (cold starts drop it); wire a
 * KV store if you need durable state.
 */

const sessions = new Map<number, { s: BotSession; at: number }>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function loadSession(chatId: number): BotSession {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of sessions) if (v.at < cutoff) sessions.delete(k);
  const hit = sessions.get(chatId);
  if (hit) {
    hit.at = Date.now();
    return hit.s;
  }
  const s = newSession();
  sessions.set(chatId, { s, at: Date.now() });
  return s;
}

// Test hooks — not part of the webhook contract.
export function _testResetSessions(): void {
  sessions.clear();
}
export function _testSessionFor(chatId: number): BotSession | undefined {
  return sessions.get(chatId)?.s;
}

function header(req: any, name: string): string | null {
  if (typeof req.headers?.get === 'function') return req.headers.get(name);
  return req.headers?.[name] ?? null;
}

async function tgCall(token: string, method: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Never let Telegram API hiccups bubble into the webhook response.
  }
}

function replyMarkup(action: Extract<BotAction, { kind: 'send' }>) {
  if (!action.keyboard) return undefined;
  return {
    inline_keyboard: action.keyboard.map(row =>
      row.map(b => ({ text: b.text, callback_data: b.data }))
    ),
  };
}

async function processUpdate(token: string, update: any): Promise<void> {
  const chatId =
    update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;
  if (typeof chatId !== 'number') return;

  const session = loadSession(chatId);
  const now = Date.now();
  const queue: BotAction[] = [];

  if (update.callback_query) {
    // Acknowledge the tap immediately so the spinner stops.
    void tgCall(token, 'answerCallbackQuery', { callback_query_id: update.callback_query.id });
    queue.push(...handleCallback(session, String(update.callback_query.data || ''), now));
  } else if (update.message && typeof update.message.text === 'string') {
    queue.push(...handleText(session, update.message.text, now));
  }

  // Drain the queue; reflection tasks may enqueue follow-up actions.
  while (queue.length > 0) {
    const action = queue.shift() as BotAction;
    if (action.kind === 'send') {
      await tgCall(token, 'sendMessage', {
        chat_id: chatId,
        text: action.text,
        parse_mode: action.plain ? undefined : 'Markdown',
        reply_markup: replyMarkup(action),
      });
    } else {
      const result = await runReflectionTask({
        task: action.task,
        lang: session.lang,
        payload: action.payload,
      });
      const follow =
        action.task === 'triggers'
          ? applyTriggersResult(session, result.ok ? result.data : null)
          : applyQuestionResult(session, result.ok ? result.data : null);
      queue.push(...follow);
    }
  }
}

function respond(body: unknown, status: number, res?: any) {
  if (res?.status) return res.status(status).json(body);
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req: any, res?: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const method = req.method || 'GET';

  // Health check for browsers / uptime monitors.
  if (method === 'GET') {
    return respond({ ok: true, service: 'ruko-telegram-webhook', configured: Boolean(token) }, 200, res);
  }

  if (method !== 'POST') {
    return respond({ ok: false }, 405, res);
  }
  if (!token) {
    return respond({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, 503, res);
  }

  // Optional shared-secret check: setWebhook(secret_token=…) makes Telegram
  // echo the secret in this header on every update.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = header(req, 'x-telegram-bot-api-secret-token');
    if (got !== secret) {
      return respond({ ok: false }, 401, res);
    }
  }

  let update: any = null;
  try {
    if (typeof req.body === 'string' && req.body) {
      update = JSON.parse(req.body);
    } else if (req.body && typeof req.body === 'object') {
      update = req.body;
    } else if (typeof req.json === 'function') {
      update = await req.json();
    }
  } catch {
    return respond({ ok: false }, 400, res);
  }

  try {
    await processUpdate(token, update);
  } catch (err) {
    // Log but always 200 — Telegram retries non-2xx webhooks aggressively.
    console.error('[telegram] update failed:', err);
  }

  return respond({ ok: true }, 200, res);
}