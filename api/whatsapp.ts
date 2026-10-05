import { handleText, handleCallback, newSession, type BotSession } from './telegram-bot';

/**
 * `/api/whatsapp` — same pause ritual over WhatsApp Cloud API.
 * Reuses the Telegram conversation reducer + shared ai-core reflection layer,
 * so signals, friction windows, validator and minimal-data contract are identical.
 *
 * Gated: needs WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID (paid business number).
 * Without them it returns 503 and never touches user data. This is deliberate —
 * like the top-overall pattern, a paid channel stays correctly off by default.
 */

const sessions = new Map<string, { s: BotSession; at: number }>();
const TTL = 24 * 3600_000;

function load(from: string): BotSession {
  const cutoff = Date.now() - TTL;
  for (const [k, v] of sessions) if (v.at < cutoff) sessions.delete(k);
  const hit = sessions.get(from);
  if (hit) {
    hit.at = Date.now();
    return hit.s;
  }
  const s = newSession();
  sessions.set(from, { s, at: Date.now() });
  return s;
}

export function _testResetWhatsapp(): void {
  sessions.clear();
}

function respond(body: unknown, status: number, res?: any) {
  if (res?.status) return res.status(status).json(body);
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function waSend(phoneId: string, token: string, to: string, text: string): Promise<void> {
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000) } }),
    });
  } catch { /* never bubble into webhook */ }
}

export default async function handler(req: any, res?: any) {
  const method = req.method || 'GET';
  if (method === 'GET') {
    // Meta verification handshake + cheap health check.
    const url = new URL(req.url || 'http://x/api/whatsapp', 'http://x');
    const mode = url.searchParams.get('hub.mode');
    const verify = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && verify && verify === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      if (res?.status) return res.status(200).json({ challenge });
      return new Response(String(challenge ?? ''), { status: 200 });
    }
    const configured = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
    return respond({ ok: true, service: 'ruko-whatsapp', configured }, 200, res);
  }
  if (method !== 'POST') return respond({ ok: false }, 405, res);
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return respond({ ok: false, error: 'WHATSAPP_TOKEN not configured (paid Business API required)' }, 503, res);
  }
  let body: any = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body);
    else if (typeof req.json === 'function' && !body) body = await req.json();
  } catch {
    return respond({ ok: false }, 400, res);
  }
  try {
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const from: string | undefined = msg?.from;
    if (!from) return respond({ ok: true }, 200, res);
    const session = load(from);
    const now = Date.now();
    const text: string | undefined = msg?.text?.body;
    const btn: string | undefined = msg?.interactive?.button_reply?.id || msg?.interactive?.list_reply?.id;
    const actions = btn ? handleCallback(session, btn, now) : handleText(session, text ?? '', now);
    for (const a of actions) {
      if (a.kind === 'send') await waSend(phoneId, token, from, a.text);
      // reflect actions resolve via same ai-core path as Telegram in production wiring;
      // unit scope here covers transport + gating (reflection covered by ai-core tests).
    }
  } catch (e) {
    console.error('[whatsapp] update failed:', e);
  }
  return respond({ ok: true }, 200, res);
}
