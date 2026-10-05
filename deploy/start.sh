#!/usr/bin/env bash
# Ruko Pi startup — called at boot via systemd, or manually: ./deploy/start.sh
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-4173}" HOST="${HOST:-127.0.0.1}"
if [ -f .env ]; then set -a; source .env; set +a; fi
if [ ! -d dist ]; then echo "[ruko] dist/ missing, building..."; npm run build; fi
echo "[ruko] starting pi-server on $HOST:$PORT (dist + /api)..."
exec node server/pi-server.mjs
