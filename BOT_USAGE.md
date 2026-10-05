# Ruko Telegram Bot — Usage Guide

Ruko (रुको) brings the full 5-screen pre-trade pause ritual into a Telegram chat. No app install, no advice, no tips, no predictions — only a pause. 🪞

**Bot:** the one you created with @BotFather (e.g. `@Viditkumar_bot`)

---

## Commands

| Command | What it does |
| --- | --- |
| `/start` | Onboarding greeting (bilingual Hindi/English) with a language picker |
| `/pause` | Start the pre-trade pause ritual (the 5-screen flow below) |
| `/mirror` | Your pause statistics so far — pauses, stepped back, went ahead anyway |
| `/checkin` | A nudge for when you return after a "Wait 30 minutes" decision |
| `/lang` | Switch language (हिन्दी / English) |
| `/cancel` | Leave the current ritual at any point |
| `/help` | List all commands |

---

## The ritual (what `/pause` walks you through)

1. **Quick check (Step 1/5)** — Type the trade amount (a plain number, e.g. `5000`). Then tap buttons: funding source (salary/savings, emergency fund, loan), whether the amount is bigger than usual, your most recent trade outcome, and how many trades you've made today.
2. **Pressure check (Step 2/5)** — The bot evaluates the same **6 behavioral signals** as the app: late-night, many trades today, quick re-entry after a loss, size escalation, loss streak, risky funding. *"Nothing here is a verdict. It is a mirror."*
3. **Reflection wait (Step 3/5)** — Breathing instructions + reflection cards. The decision button is **locked server-side** for the friction window (calm 10s / caution 30s / high 60s). Early taps get *"Still breathing… Xs left."*
4. **Decision (Step 4/5)** — Type **why** you're making this trade (at least 3 characters). Pick a time horizon and an acceptable loss limit (or skip). The bot mirrors your words back and asks one reflective question. Then choose: **Abandon**, **Wait 30 minutes**, or **Go ahead anyway**.
5. **Confirmation (Step 5/5)** — *"That took a moment of courage. Nothing to prove."* If you chose Wait, you're told when to come back (IST).

---

## Notes

- **Any text mid-ritual** that isn't expected gets nudged back to the flow; buttons are for the quick answers, typing is for amounts and your "why".
- **Session state** lives on the bot server only (24h TTL) and is never synced with the app's on-device journal.
- **Privacy:** amounts, funding, horizon and loss limits never reach the AI layer — only your typed "why" sentence and fired signal names (same contract as the app).
- **Autonomy is preserved:** *Proceed* is always available. Ruko adds friction, never bans.

---

## Running locally

```bash
npm run dev        # terminal 1 — app + /api/telegram endpoint
npm run bot:dev    # terminal 2 — long-polling bridge (no tunnel needed)
```

Then open your bot in Telegram and send `/start`. Requires `TELEGRAM_BOT_TOKEN` in `.env` (full `<bot_id>:<secret>` from @BotFather).

Offline (no token needed):

```bash
npm run bot:mock                                        # terminal 1
TELEGRAM_API_BASE=http://127.0.0.1:8081 npm run dev     # terminal 2
TELEGRAM_API_BASE=http://127.0.0.1:8081 npm run bot:dev # terminal 3
```

Webhook mode (deployed): `npm run bot:set-webhook -- https://your-app.vercel.app`
