# DECISIONS.md - Ruko Architecture & Implementation Decisions

This document records the architectural, behavioral, and technical decisions made during the development of **Ruko** for the SANGYAN Investor Resilience Hackathon (Track D: Financial Habits & Behavioural Resilience).

---

### 1. Zero External Network & Offline Autonomy
- **Decision**: Zero external network calls required for core functionality; offline-first by design.
- **Rationale**: Retail investors in Tier-2/3 India may face unstable mobile network connectivity. Financial pause rituals and reflections must never fail or lag due to network latency.
- **Implementation**: System fonts are prioritized (`system-ui, -apple-system, BlinkMacSystemFont, 'Noto Sans Devanagari', sans-serif`). All financial logs, decisions, and practice data are stored in local IndexedDB via Dexie (`db.version(3)`). The PWA service worker with Workbox caches all static assets for instant offline use.

---

### 2. Strict Guardrails Against Financial Advisory
- **Decision**: Absolute exclusion of market direction predictions, target prices, stock/index tickers, and broker recommendations.
- **Rationale**: Ruko's purpose is behavioural pause and self-reflection, not market analysis or trading advisory.
- **Implementation**:
  - The words `buy`, `sell`, `hold`, `target price`, `tip`, `tips` (English) and `खरीद`, `बेच` (Hindi) are strictly barred and guarded by an automated vitest test suite.
  - CSV parser ignores any ticker, symbol, or broker columns, storing only timestamp, amount, funding source, and optional P&L.
  - In practice trading mode, only fictional names are used (`Demo Index`, `Demo Co. A`, `Demo Co. B`, `Demo Futures (5x)`).

---

### 3. Voice Accessibility with Safe Graceful Degradation
- **Decision**: Native browser Web Speech API (`SpeechSynthesis` and `SpeechRecognition`) wrapped in a clean feature-detection interface without external cloud dependencies.
- **Rationale**: Tier-2/3 investors often prefer spoken Hindi or conversational prompts. If speech APIs are unsupported (such as in certain embedded webviews), the app hides the microphone/speaker triggers and operates seamlessly via touch/keyboard without errors.

---

### 4. 5-Screen Pause Ritual & Mindful Friction
- **Decision**: The pause ritual was restructured into 5 distinct, purposeful screens:
  1. *Screen 1 (Quick check)*: Fast input of amount, funding source, and last trade result.
  2. *Screen 2 (Pressure check)*: Behavioral pressure check showing plain-language facts with a friction countdown.
  3. *Screen 3 (Reflection wait)*: Synchronized breathing circle, auto-advancing cards with "Keep this card" toggle, voice read-aloud, and personal rules.
  4. *Screen 4 (Decision)*: Locked until the trader types at least 3 characters explaining *why* they want to make this trade, accompanied by time horizon and acceptable loss limits, leading to three conscious choices: *Abandon*, *Wait 30 minutes*, or *Proceed*.
  5. *Screen 5 (Confirmation)*: Immediate reinforcement acknowledging the pause with an uplifting courage quote ("That took a moment of courage. Nothing to prove.").
- **Rationale**: Separates sensory calming from analytical introspection, and ensures users articulate intent before deciding.

---

### 5. Web Worker CSV Parsing
- **Decision**: Heavy CSV ingestion parsed in `src/workers/csvWorker.ts` with PapaParse, with a direct parsing fallback.
- **Rationale**: Offloads parsing of large transaction logs off the main React rendering thread, maintaining smooth 60fps animations on low-end Android mobile devices.

---

### 6. Neutral Feedback & Objective Mirroring
- **Decision**: Ruko provides zero "good" or "bad" verdicts. It acts solely as an objective mirror reflecting detected behavioral patterns and consequences.
- **Rationale**: Behavioral science shows punitive or moralizing feedback causes user avoidance and drop-off, whereas neutral observation invites introspection.

---

### 7. Indian Date & Financial CSV Parsing Resilience
- **Decision**: Robust parser supporting Indian date conventions (`DD/MM/YYYY`, `DD-MM-YYYY`), accounting parentheses `(1,500.00)` for negative P&L, and explicit handling of unclosed trades (`-`, `N/A` parsed as `null`).
- **Rationale**: Retail investors in Tier-2/3 India export tradebooks from Indian brokers (Zerodha, Groww, AngelOne) where days frequently exceed 12 (`25/10/2026`) and standard JS `new Date()` parses as `NaN`.

---

### 8. Strict Mobile Touch Target Compliance
- **Decision**: All interactive buttons, voice triggers, and action targets enforce a minimum 48px height and width (`min-h-[48px] min-w-[48px]`).
- **Rationale**: Complies with mobile-first accessibility standards for low-end Android touchscreens, preventing accidental taps under emotional stress.

---

### 9. Opt-in AI Layer with Strict Data Minimization
- **Decision**: AI features are strictly opt-in (default OFF) via an explicit consent modal.
- **Rationale**: User privacy is paramount. Users must have total transparency over what data leaves their device.
- **Implementation**:
  - The client transmits *only* the user's single typed "Why" sentence and language code (`hi` or `en`).
  - Account balances, trade history, profit/loss, and rules are **never** transmitted to the AI endpoint.
  - Serverless functions `/api/ai.ts` and `netlify/functions/ai.ts` connect to the Groq Cloud chat-completions API (OpenAI-compatible, `llama-3.3-70b-versatile` by default, JSON mode) using lightweight `fetch` with IP rate limiting (20 req/hour) and output validation against financial advice. Key is read from `GROQ_API_KEY`, falling back to the legacy `GEMINI_API_KEY` slot.
  - Client implements a strict 4-second timeout with silent fallback to rule-based questions and summaries.

---

### 10. Deterministic Practice Simulator with Pseudorandom PRNG
- **Decision**: Pure client-side simulation using Mulberry32 PRNG and Box-Muller Gaussian transformation with fixed seeds.
- **Rationale**: Allows repeatable, scientifically controlled scenarios (`calm`, `volatile`, `crash`, `rally_reversal`, `late_night`) that test specific emotional triggers like FOMO and panic without relying on external market data feeds.

---

### 11. Practice Account Mechanics & Auto-Close Protection
- **Decision**: Virtual ₹1,00,000 wallet with margin chips (10%, 25%, 50%), leverage restricted to 1x (or 5x only for Demo Futures), and auto-close at 90% unrealized margin loss.
- **Rationale**: Teaches position sizing and downside limits safely. The auto-close mechanism models stop-loss protection and prevents infinite drawdown.

---

### 12. Simulation Clock Synchronization
- **Decision**: 1 real second = 1 simulation minute (120 ticks = 2 hours sim time). Simulator clock freezes during the Pause ritual.
- **Rationale**: Enables realistic time-of-day signal evaluation (e.g. late night starting at 22:40) in a 2-minute real-world session, while ensuring the pause ritual provides true calm without race conditions.

---

### 13. Strict Reflection Ordering & Enforced Countdown Friction
- **Decision**: The "Continue" button on Screen 3 is strictly disabled while the friction countdown is active (`disabled={countdown > 0}`). Reflection cards strictly follow the sequence: BreathCard -> SignalCards -> MirrorCard -> RuleCard -> CoreCards (Why, Horizon, MaxLoss) -> GeneralCards -> BodyCard.
- **Rationale**: Mindful friction requires actual elapsed time; allowing skipping defeats the behavioral purpose of the pause ritual. Ordering ensures contextual signals are processed before user rationalization.

---

### 14. Real-Only Mirror with Dedicated Practice Impact Analysis
- **Decision**: The Weekly Mirror aggregates only real decisions (`d.mode !== 'practice'`). An optional comparison table breaks down completed practice sessions comparing Pause ON vs. Pause OFF metrics (average trades per session, share of trades opened right after a loss).
- **Rationale**: Keeps real personal accountability clean from dummy testing, while proving the behavioral efficacy of the pause ritual in practice mode.

---

### 15. Complete Removal of Timers from the Question/Reflection Window
- **Decision**: Removed all timers, countdown clocks, second counters, and auto-advance intervals from the Screen 3 reflection window. The breathing circle animates naturally without a timer clock, and users navigate through the cards and questions unhurried at their own pace.
- **Rationale**: Any ticking clock or forced countdown during reflection directly induces cognitive stress and anxiety, contradicting Ruko's purpose of calm self-observation. Users advance question-by-question when ready, or skip to Decide once their core why rationale is formulated.

---

### 16. Clean Institutional Light Theme (NSDL-grade, features first)
- **Decision**: Replaced the dark midnight-diya skin with a clean light theme on web and Expo: white surfaces, `#F4F6FA` app background, navy ink, hairline borders, one soft shadow. Saffron survives only as fill (Pause button, primary CTAs, selected states); small accent text uses Clay `#92400E` for contrast; chart down-candles are hollow so color is never the only signal.
- **Rationale**: Judge and user feedback showed the dark theme hid the primary action and spent contrast on decoration. An investor-safety tool must read like a public institution: labels first, color second, every number legible in sunlight on a 2GB phone.


