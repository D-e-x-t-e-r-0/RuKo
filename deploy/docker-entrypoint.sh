#!/usr/bin/env bash
# Runs nginx + node preview together inside the container
set -euo pipefail
sed -i "s/server 127.0.0.1:4173/server 127.0.0.1:${PORT:-4173}/" /etc/nginx/sites-available/ruko.conf || true
sed -i "s|root /opt/ruko/dist|root /app/dist|" /etc/nginx/sites-available/ruko.conf || true
nginx -t
service nginx start || nginx
echo "[ruko] nginx up, starting node on ${HOST:-0.0.0.0}:${PORT:-4173}..."
exec npm run preview -- --port "${PORT:-4173}" --host "${HOST:-0.0.0.0}"
