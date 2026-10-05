#!/usr/bin/env node
/**
 * Mock Telegram Bot API — fully offline end-to-end testing of the bot bridge.
 *
 * Serves a scripted update feed (a `/start` message from a fake chat by
 * default) on `getUpdates`, succeeds every other method (`sendMessage`,
 * `answerCallbackQuery`, …) and records every call to the console plus a
 * JSONL log, so you can watch exactly what the bot replies.
 *
 * Usage:
 *   npm run bot:mock                       # scripted: /start from chat 42
 *   npm run bot:mock path/to/updates.jsonl # one JSON Update object per line
 *
 * Pair with:
 *   TELEGRAM_API_BASE=http://127.0.0.1:8081 npm run dev
 *   TELEGRAM_API_BASE=http://127.0.0.1:8081 npm run bot:dev
 */
import fs from 'node:fs';
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 8081);
const LOG = process.env.MOCK_LOG || '.bot-log.jsonl';

const scripted = process.argv[2]
  ? fs
      .readFileSync(process.argv[2], 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
  : [
      {
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 7, is_bot: false, first_name: 'Tester', language_code: 'en' },
          chat: { id: 42, type: 'private', first_name: 'Tester' },
          date: Math.floor(Date.now() / 1000),
          text: '/start',
        },
      },
    ];

let cursor = 0;

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const match = /\/bot[^/]+\/([A-Za-z0-9_]+)/.exec(req.url || '');
  const method = match ? match[1] : req.url;
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { raw };
  }

  fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), method, body }) + '\n');

  const reply = (obj) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  if (method === 'getMe') {
    return reply({ ok: true, result: { id: 987654321, is_bot: true, first_name: 'Ruko (mock)', username: 'ruko_mock_bot' } });
  }
  if (method === 'getUpdates') {
    const update = cursor < scripted.length ? scripted[cursor++] : null;
    return reply({ ok: true, result: update ? [update] : [] });
  }

  if (method === 'sendMessage') {
    const preview = String(body.text ?? '').replace(/\n/g, ' | ').slice(0, 300);
    console.log(`📨 sendMessage → chat ${body.chat_id}: ${preview}${body.reply_markup ? '  (keyboard)' : ''}`);
  } else {
    console.log(`📞 ${method}`);
  }
  return reply({ ok: true, result: true });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🧪 Mock Bot API on http://127.0.0.1:${PORT} — ${scripted.length} scripted update(s), log: ${LOG}`);
});
