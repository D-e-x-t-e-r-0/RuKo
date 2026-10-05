# Eval harness — why judges trust the engine

This folder is the answer to "does it really work?" Every claim in the pitch
maps to a case here that runs in CI (`npm test` includes `eval/eval.test.ts`).

- `cases.json` — 25 cases: 15 signal/pressure cases (late-night, many-trades,
  quick-reentry, size-escalation, loss-streak, risky-funding + calm/high combos),
  6 guardrail cases (buy/target/Hindi must be rejected, clean reflection passes),
  4 privacy/CSV cases (amounts never leave device, ticker/broker dropped,
  DD/MM/YYYY + (1,500.00) parsing).
- `eval.test.ts` — loads cases, builds timestamps relative to today, asserts
  fired signals + `levelFor()` + `hasBannedWords()`. Deterministic, no network.
- `run.mjs` — `node eval/run.mjs` prints one judge-readable PASS line for demos.

Add a case: append JSON with `id/desc/pending/trades/expect`. Keep `expect: []`
for clean cases so regressions shout. Guardrail outputs go in `modelOutput`
with `expectBanned: true/false`.
