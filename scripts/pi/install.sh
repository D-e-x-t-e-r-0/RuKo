#!/usr/bin/env bash
# Ruko Pi installer — Raspberry Pi OS (64-bit) + Ubuntu 22.04/24.04
# Installs Node 22, nginx, clones/updates Ruko, builds, installs systemd units.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/SwarritSrivastava/RuKo/main/scripts/pi/install.sh | bash
#   OR: ./scripts/pi/install.sh [--app-dir /opt/ruko] [--domain ruko.local] [--skip-build]
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ruko}"
REPO="${REPO:-https://github.com/SwarritSrivastava/RuKo.git}"
DOMAIN="${DOMAIN:-ruko.local}"
SKIP_BUILD=0
for a in "$@"; do
  case "$a" in
    --app-dir=*) APP_DIR="${a#*=}" ;;
    --app-dir) shift; APP_DIR="${1:-/opt/ruko}" ;;
    --domain=*) DOMAIN="${a#*=}" ;;
    --skip-build) SKIP_BUILD=1 ;;
  esac
done

say() { printf '\033[1;32m[ruko]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[ruko warn]\033[0m %s\n' "$*" >&2; }

if [ "$(id -u)" -ne 0 ]; then
  warn "Run as root (sudo). Re-exec with sudo..."
  exec sudo -E bash "$0" "$@"
fi

say "Updating apt..."
apt-get update -y
apt-get install -y git curl nginx certbot python3-certbot-nginx sqlite3 htop

if ! command -v node >/dev/null 2>&1; then
  say "Installing Node 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v; npm -v; nginx -v

if [ ! -d "$APP_DIR/.git" ]; then
  say "Cloning into $APP_DIR..."
  git clone "$REPO" "$APP_DIR"
else
  say "Updating $APP_DIR..."
  git -C "$APP_DIR" pull --ff-only || warn "pull failed, keeping local tree"
fi

cp -n "$APP_DIR/.env.example" "$APP_DIR/.env" 2>/dev/null || true
if [ ! -f "$APP_DIR/.env" ]; then cp "$APP_DIR/.env.example" "$APP_DIR/.env"; fi

say "Installing npm deps..."
npm --prefix "$APP_DIR" ci --no-audit --no-fund || npm --prefix "$APP_DIR" install --no-audit --no-fund

if [ "$SKIP_BUILD" -eq 0 ]; then
  say "Running tests + build..."
  npm --prefix "$APP_DIR" test --silent || warn "tests failed — continuing so you can inspect"
  npm --prefix "$APP_DIR" run build
fi

say "Installing systemd units..."
cp "$APP_DIR/deploy/ruko-web.service" /etc/systemd/system/ruko-web.service
cp "$APP_DIR/deploy/ruko-bot.service" /etc/systemd/system/ruko-bot.service || true
sed -i "s|/opt/ruko|$APP_DIR|g" /etc/systemd/system/ruko-web.service /etc/systemd/system/ruko-bot.service || true
systemctl daemon-reload
systemctl enable --now ruko-web.service || warn "ruko-web start failed — check journalctl -u ruko-web"
systemctl enable ruko-bot.service || true

say "Installing nginx site ($DOMAIN)..."
cp "$APP_DIR/nginx/ruko.conf" /etc/nginx/sites-available/ruko.conf
sed -i "s/ruko\.local/$DOMAIN/g" /etc/nginx/sites-available/ruko.conf
sed -i "s|/opt/ruko|$APP_DIR|g" /etc/nginx/sites-available/ruko.conf
ln -sf /etc/nginx/sites-available/ruko.conf /etc/nginx/sites-enabled/ruko.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

say "Done. Web: http://$DOMAIN/  Health: http://$DOMAIN/api/health  Telegram: http://$DOMAIN/api/telegram (GET = status)"
say "Logs: journalctl -u ruko-web -f | sudo systemctl status nginx"
