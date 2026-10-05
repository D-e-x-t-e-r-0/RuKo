#!/usr/bin/env node
/**
 * One-command webhook setup for the Ruko Telegram bot.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=123:abc npm run bot:set-webhook -- https://your-app.vercel.app
 *   # or pass the URL via TELEGRAM_WEBHOOK_URL
 *
 * Reads TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET from the environment
 * (or .env, parsed naively) and points Telegram at <base>/api/telegram.
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

const token = process.env.TELEGRAM_BOT_TOKEN;
const base = process.argv[2] || process.env.TELEGRAM_WEBHOOK_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN (create a bot with @BotFather first).');
  process.exit(1);
}
if (!base) {
  console.error('Missing base URL. Usage: npm run bot:set-webhook -- https://your-app.vercel.app');
  process.exit(1);
}

const url = `${base.replace(/\/+$/, '')}/api/telegram`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  }),
});

const body = await res.json().catch(() => ({}));

if (res.ok && body.ok) {
  console.log(`✅ Webhook set: ${url}`);
  if (secret) console.log('🔐 Secret-token verification enabled (TELEGRAM_WEBHOOK_SECRET).');
  console.log('Open your bot in Telegram and send /start.');
} else {
  console.error(`❌ setWebhook failed (${res.status}):`, body.description || body);
  process.exit(1);
}