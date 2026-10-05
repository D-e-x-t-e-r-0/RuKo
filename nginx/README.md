# nginx quick reference for judges / Pi operators
# File: nginx/ruko.conf  |  Domain default: ruko.local (change with sed or $DOMAIN)

# 1. Install on Pi:
#   sudo cp nginx/ruko.conf /etc/nginx/sites-available/ruko.conf
#   sudo sed -i 's/ruko\.local/my-pi.tailnet.ts.net/; s|/opt/ruko|/home/pi/RuKo|' /etc/nginx/sites-available/ruko.conf
#   sudo ln -sf /etc/nginx/sites-available/ruko.conf /etc/nginx/sites-enabled/ruko.conf
#   sudo nginx -t && sudo systemctl reload nginx
#
# 2. HTTPS (Pick one):
#   A) Tailscale/LAN only — keep HTTP, share http://<pi-ip>/ (fine for demo).
#   B) Public domain — sudo certbot --nginx -d your-domain.com (auto-edits this file).
#
# 3. Point Telegram at it (once):
#   PUBLIC_BASE_URL=https://your-domain.com npm run bot:set-webhook -- https://your-domain.com
#   curl https://your-domain.com/api/telegram   # expect {"ok":true,"service":"ruko-telegram",...}
#
# 4. Logs:
#   tail -f /var/log/nginx/ruko.access.log
#   journalctl -u ruko-web -f
#
# Design notes for reviewers:
# - Static dist/ served by nginx (7d immutable cache for hashed assets, no-cache for sw.js).
# - /api/* proxied to Node on 127.0.0.1:4173 with 4-5s timeouts so the client 4s AI
#   fallback always wins and the pause ritual never blocks.
# - /api/ai additionally rate-limited at edge (5r/m) plus 20/hour in code.
# - No cookies, no tracking. Security headers set. HashRouter (#/...) works static-only.
