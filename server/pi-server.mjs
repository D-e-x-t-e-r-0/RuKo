// Ruko Pi server — static dist/ + minimal /api for nginx.
// Why not `vite preview` alone? Preview serves static only; /api/* are Vercel/Netlify
// serverless in cloud. On the Pi the app is offline-first by design: with no keys
// the client uses deterministic rules, so the Pi only needs health + telegram status.
// When keys ARE set, use `npm run dev` or deploy to Vercel for full AI/Sarvam.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/api/health') return send(res, 200, JSON.stringify({ ok: true, service: 'ruko-pi', time: new Date().toISOString() }));
  if (url === '/api/telegram' && req.method === 'GET') {
    return send(res, 200, JSON.stringify({ ok: true, service: 'ruko-telegram', configured: Boolean(process.env.TELEGRAM_BOT_TOKEN), host: 'pi' }));
  }
  if (url.startsWith('/api/')) {
    // Pi has no serverless runtime — client falls back to on-device rules (by design).
    return send(res, 503, JSON.stringify({ ok: false, error: 'Pi keyless mode — deterministic fallback in client' }));
  }
  let file = path.join(DIST, url === '/' ? 'index.html' : url.slice(1));
  if (!file.startsWith(DIST)) return send(res, 403, 'forbidden', 'text/plain');
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) file = path.join(DIST, 'index.html'); // SPA fallback (HashRouter)
    fs.readFile(file, (e2, data) => {
      if (e2) return send(res, 404, 'not found', 'text/plain');
      send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
    });
  });
});

server.listen(PORT, HOST, () => console.log(`[ruko-pi] http://${HOST}:${PORT} serving ${DIST}`));
