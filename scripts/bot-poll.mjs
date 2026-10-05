#!/usr/bin/env node
/**
 * Local long-polling bridge — runs the Ruko Telegram bot without a public URL.
 *
 * Webhooks require a public HTTPS endpoint (tunnel/deploy), but the Bot API's
 * `getUpdates` long-polling mode works from any machine. This script polls
 * Telegram for updates and forwards every one to the local `/api/telegram`
 * endpoint (served in-process by `npm run dev`), which replies through the
 * Bot API — the exact same code path as production webhooks.
 *
 * Usage:
 *   npm run dev        # terminal 1 — serves /api/telegram
 *   npm run bot:dev    # terminal 2 — this bridge
 *
 * Env (loaded from .env):
 *   TELEGRAM_BOT_TOKEN      required — full token, "<bot_id>:<secret>"
 *   TELEGRAM_WEBHOOK_SECRET echoed to the local endpoint so its secret
 *                           check passes (mirrors the webhook contract)
 *   TELEGRAM_API_BASE       override for offline testing (mock Bot API)
 *   RUKO_API_URL            local endpoint, default http://localhost:5173/api/telegram
 */
import fs from 'node:fs';

function loadDotEnv() {
  try {
    const raw = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env — rely on the environment
  }
}
loadDotEnv();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch() uses getaddrinfo, which on some networks hands back blocked
// Telegram IPs (ETIMEDOUT). Resolve via resolve4, prefer the last good IP,
// retry once — same strategy as src/lib/tg-net.ts.
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';

let goodIp = null;
let useNodeClient = false;

function lookup4(hostname, options, cb) {
  dns.promises
    .resolve4(hostname)
    .then((list) => {
      let addrs = [...new Set(list)];
      if (goodIp && addrs.includes(goodIp)) addrs = [goodIp, ...addrs.filter((a) => a !== goodIp)];
      if (addrs.length === 0) throw new Error('empty resolve4');
      if (options?.all) cb(null, addrs.map((address) => ({ address, family: 4 })));
      else cb(null, addrs[0], 4);
    })
    .catch(() => dns.lookup(hostname, options, cb));
}

// Try plain fetch first (healthy networks / stubs); on a network-level
// failure switch permanently to the resolve4 node client.
async function tgFetch(url, init) {
  if (!useNodeClient) {
    try {
      const res = await fetch(url, { method: init.method, headers: init.headers, body: init.body });
      return { ok: res.ok, status: res.status, json: () => res.json() };
    } catch {
      useNodeClient = true;
    }
  }
  return nodeClientFetch(url, init);
}

function nodeClientFetch(url, init, attempt = 1) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.request(
      url,
      { method: init.method, headers: init.headers, lookup: lookup4, timeout: 20_000 },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => {
              try {
                return JSON.parse(raw);
              } catch {
                return {};
              }
            },
          });
        });
      }
    );
    req.on('socket', (s) => s.on('connect', () => (goodIp = s.remoteAddress ?? goodIp)));
    req.on('timeout', () => req.destroy(new Error('ETIMEDOUT')));
    req.on('error', (err) => {
      if (attempt < 3 && /^(ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|ENETUNREACH)$/.test(err.code ?? '')) {
        resolve(nodeClientFetch(url, init, attempt + 1));
      } else {
        reject(err);
      }
    });
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');
const endpoint = (process.env.RUKO_API_URL || 'http://localhost:5173/api/telegram').replace(/\/+$/, '');

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN (create a bot with @BotFather first).');
  process.exit(1);
}
if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
  console.error(
    'TELEGRAM_BOT_TOKEN looks malformed. It must be "<bot_id>:<secret>", e.g. 123456789:AAGz…. ' +
      'Copy the FULL token from @BotFather (/mybots → your bot → API Token).'
  );
  process.exit(1);
}

const api = async (method, body) => {
  try {
    const res = await tgFetch(`${base}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, description: String(err) };
  }
};

const me = await api('getMe', {});
if (!me.ok) {
  console.error(`❌ getMe failed against ${base}: ${me.description}`);
  console.error('   Is TELEGRAM_BOT_TOKEN the complete token ("<bot_id>:<secret>")?');
  process.exit(1);
}
console.log(`🤖 Polling as @${me.result.username} → ${endpoint}`);

// getUpdates and webhooks are mutually exclusive; make sure none is set.
await api('deleteWebhook', { drop_pending_updates: true });

console.log('🫁 Bridge running. Open the bot in Telegram and send /start. (Ctrl+C to stop.)');

let offset = 0;
for (;;) {
  const res = await api('getUpdates', {
    offset,
    timeout: 25,
    allowed_updates: ['message', 'callback_query'],
  });
  if (!res.ok) {
    console.error('getUpdates failed:', res.description);
    await sleep(3000);
    continue;
  }
  for (const update of res.result) {
    offset = update.update_id + 1;
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {}),
        },
        body: JSON.stringify(update),
      });
      if (!r.ok) console.error(`⚠️ endpoint returned ${r.status} for update ${update.update_id}`);
    } catch (err) {
      console.error(`⚠️ forward failed for update ${update.update_id} — is \`npm run dev\` running?`, err);
      await sleep(2000);
    }
  }
  if (res.result.length === 0) await sleep(500); // mock APIs answer instantly — avoid busy-looping
}
