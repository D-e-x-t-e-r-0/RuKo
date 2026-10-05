# Security policy — Ruko

## What Ruko protects
Retail investors pausing before a trade. The journal (amounts, funding, why words)
stays on the device (IndexedDB / AsyncStorage). The server never sees it unless
the user explicitly turns AI on — and then only the typed why sentence, fired
signal IDs and language travel. Amounts, funding, horizon, loss limits, names,
tickers and broker data never leave the device. Enforced by tests:
`api/ai-core.test.ts`, `api/telegram-bot.test.ts`, `src/lib/vault.test.ts`.

## Report a vulnerability
Email: hitesh.bansal.cd.eee24@itbhu.ac.in with subject `[Ruko security]`.
We acknowledge within 72 hours. Please do not open a public issue for
data-exposure or bypass reports. Safe-harbor: good-faith research welcomed.

## Scope
- In scope: `src/engine/*` (signal bypass), `api/ai-core.ts` + `api/validate.ts`
  (advisory-output bypass, prompt injection via why), `api/telegram.ts`,
  `api/whatsapp.ts` (webhook secret bypass, session leak), `src/lib/vault.ts`
  (backup decrypt without passphrase), `nginx/ruko.conf` (header/rate-limit gap).
- Out of scope: upstream Groq/Sarvam/Telegram/Meta outages, physical device
  access, social engineering of users.

## Hard rules (never regress)
1. No price targets, tips, tickers, broker links, or strategy — validator drops
   `buy|sell|hold|target|tip|nifty|sensex` (EN) and `खरीद|बेच|निवेश करें` (HI).
2. Proceed is always available — friction, never force.
3. AI default OFF with explicit consent modal; 4s timeout falls back to rules.
4. Webhook secrets required when set (`TELEGRAM_WEBHOOK_SECRET`,
   `WHATSAPP_WEBHOOK_VERIFY_TOKEN`); missing token means 503, never passthrough.
5. Backups are AES-GCM (PBKDF2 100k) with `RUKO1.` header; wrong passphrase fails.

## Headers and edge (see `nginx/ruko.conf`)
`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy: no-referrer`, `Permissions-Policy: microphone=(self), camera=()`.
Edge rate limits on `/api/ai` plus 20/hour in code. No cookies, no trackers.
