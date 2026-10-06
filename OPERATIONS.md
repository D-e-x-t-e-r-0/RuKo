# OPERATIONS — Pi + reverse proxy + startup

## Boot order
1. `ruko-web.service` → `node server/pi-server.mjs` on 127.0.0.1:4173 (dist + /api/health).
2. `nginx` → serves dist/ static, proxies /api/* with 4-5s timeouts.
3. `ruko-bot.service` oneshot → curls /api/telegram, safe with no token.

## Commands
```
sudo systemctl status ruko-web nginx
journalctl -u ruko-web -f
curl http://127.0.0.1:4173/api/health
curl http://ruko.local/api/telegram
sudo nginx -t && sudo systemctl reload nginx
./deploy/healthcheck.sh http://127.0.0.1:4173
```

## Fresh install
```
sudo ./scripts/pi/install.sh --app-dir /opt/ruko --domain ruko.local
```

## Update (2 min, no data loss — journal is on device, not server)
```
git -C /opt/ruko pull --ff-only
npm --prefix /opt/ruko ci --no-audit --no-fund
npm --prefix /opt/ruko run build
sudo systemctl restart ruko-web && curl http://127.0.0.1:4173/api/health
```

## Docker path (whole app: node pi-server + nginx, ~230MB)
```
npm run build                              # once — the image ships dist/, no npm inside
cp scripts/pi/env.pi.example .env          # optional — keyless boot works without it
docker compose up -d --build               # Pi: -f docker-compose.pi.yml
curl http://localhost/api/health           # {"ok":true,"service":"ruko-pi",...}
curl http://localhost/api/telegram         # {"ok":true,...}
docker compose logs -f
```
With a bot token in `.env`, add the chat stack (no public URL needed):
```
docker compose --profile bot up -d --build # ruko-dev (full /api) + poll bridge
```

## Telegram wiring (once per deploy)
```
PUBLIC_BASE_URL=https://your-domain.com npm run bot:set-webhook -- https://your-domain.com
curl https://your-domain.com/api/telegram
```
Serverless cold starts may drop sessions (24h TTL, best-effort). On Pi set
`RUKO_SESSION_FILE=/var/lib/ruko/sessions.json` in `.env` for reboot-proof /mirror.

## Backup
Server holds nothing personal. To move a Pi: copy `/var/lib/ruko/sessions.json`
(stats only) if used. User journals export from app Settings → encrypted
`RUKO1.` backup (passphrase never leaves device, see `src/lib/vault.ts`).

## HTTPS
LAN demo: keep HTTP. Public: `sudo certbot --nginx -d your-domain.com`.
