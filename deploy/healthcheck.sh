#!/usr/bin/env bash
# Ruko healthcheck — for systemd ExecStartPost, cron, or uptime monitors
# Returns 0 when web + api are up. Prints one line of JSON-ish status.
set -uo pipefail
BASE="${1:-http://127.0.0.1:4173}"
fail=0
web=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 "$BASE/" || echo "000")
tg=$(curl -s --max-time 4 "$BASE/api/telegram" || echo '{"ok":false}')
echo "web=$web telegram=$tg"
[ "$web" = "200" ] || fail=1
echo "$tg" | grep -q '"ok":true' || {
  # bot endpoint returns ok:false without token — that is healthy (bot optional)
  echo "$tg" | grep -q 'telegram' || fail=1
}
exit $fail
