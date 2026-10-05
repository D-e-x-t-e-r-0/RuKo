# How to use Ruko — 5 minutes, no setup talk

I built Ruko for one moment: you are about to trade, your hands feel fast, and
you open the app instead of the broker.

## The 5-step pause (web, same in Telegram)

1. Quick check. Amount, where the money comes from, what the last trade did.
   20 seconds. Big buttons, Hindi default.
2. Pressure check. Ruko shows what it noticed: late night, 4th trade today,
   quick re-entry after a loss, bigger than usual, 3 losses in a row, loan money.
   Plain sentences. "Nothing here is a verdict. It is a mirror."
3. Reflection wait. Breathing circle, 2 cards, your own rules. Calm 10s,
   caution 30s, high 60s. The button stays locked. That wait is the point.
4. Decision. Write why in your words (3 letters is enough), pick horizon and
   max loss. Then abandon, wait 30 min, or proceed. Proceed is always there.
   I don't block you. I slow you down.
5. Confirmation. "That took a moment of courage. Nothing to prove."

## Practice without money

Open Practice. Pick Late night if you want to feel the worst case: 22:40,
a loss already seeded, fictional Demo Co. prices jumping around. Virtual
1,00,000. Try to open fast. The ritual freezes the clock and asks you to wait.
Close the session, open Debrief. You get re-entries after loss, size change,
drawdown, signals seen, and a Pause ON vs OFF table once you run twice.

## Telegram when data is slow

No install, works on 2G. Message the bot: `/start`, pick language, `/pause`.
Amount as a number, tap funding/size/last-trade buttons, read the same 6 signals,
breathe, type why, choose abandon/wait/proceed. `/mirror` shows counts.
Only your why sentence and signal names ever touch AI. Amounts stay in chat.

## AI and voice

AI is off until you turn it on in Settings. Off means zero network besides
loading the app. On means the app sends your why sentence + language, nothing
else. 4 seconds max, then it falls back to built-in questions. Sarvam voices
need a key; without it the phone's own Hindi/English voice reads the cards.

## Pi at home

Web: `http://ruko.local/` Health: `http://ruko.local/api/health`
Telegram check: `http://ruko.local/api/telegram`
Logs: `journalctl -u ruko-web -f` Full steps in `OPERATIONS.md` and `nginx/README.md`.
