# AUDIT.md - Ruko v1 Architecture and State Audit

Date: October 2026  
Branch: `v2`  
Purpose: Baseline audit of Ruko prior to v2 multi-phase enhancement.

---

## 1. Repository Structure & Files in `src/`

### Root & Config
- `package.json`: Vite + React + TypeScript + Tailwind + Dexie + Recharts + PapaParse + Vitest + lucide-react + vite-plugin-pwa.
- `vite.config.ts`: Vite setup with React and VitePWA plugins.
- `tailwind.config.js`: Custom color palette (`navy`, `saffron`, `cream`, `rukoGreen`, `rukoRed`).
- `tsconfig.json`: TypeScript compiler options.
- `index.html`: Entry HTML document.
- `DECISIONS.md`: Log of architectural and behavioral design decisions.

### Source Files (`src/`)
- `src/main.tsx`: Application entry point; mounts `App` with StrictMode and imports CSS & i18n.
- `src/App.tsx`: HashRouter setup, route definitions, sticky bottom navigation bar, and More menu.
- `src/index.css`: Tailwind directives, root styles, dark theme, font family configuration.
- `src/types.ts`: Core type definitions (`Funding`, `Horizon`, `Outcome`, `Level`, `Trade`, `Decision`, `Rule`, `Signal`).
- `src/db.ts`: Dexie database schema (v1) with tables `trades`, `decisions`, `rules`, and helper `clearAll()`.
- `src/components/BigButton.tsx`: Accessible, mobile-friendly primary/secondary/danger/outline button component (min-h 48px).
- `src/components/BreathingCircle.tsx`: Calming breathing animation circle with 4s inhale / 4s exhale cycle.
- `src/components/MicButton.tsx`: Speech-to-text voice recognition trigger using Web Speech API.
- `src/components/SignalCard.tsx`: Formats and displays fired behavioral pressure signals with i18n messages.
- `src/engine/signals.ts`: Deterministic 6-signal pattern engine (`late_night`, `many_trades_today`, `quick_reentry_after_loss`, `size_escalation`, `loss_streak`, `risky_funding`).
- `src/engine/pressure.ts`: Calculates pressure `Level` (`calm`, `caution`, `high`) and maps friction seconds (10s, 30s, 60s).
- `src/engine/snippets.ts`: Random consequence snippets and SEBI study disclosures.
- `src/engine/signals.test.ts`: Vitest suite testing the 6 signals, pressure levels, guardrail words in `en.json`/`hi.json`, and CSV parsing.
- `src/i18n/index.ts`: i18next configuration loading `hi.json` and `en.json`.
- `src/i18n/en.json`: English locale dictionary.
- `src/i18n/hi.json`: Hindi locale dictionary (Devanagari script).
- `src/pages/Home.tsx`: Dashboard with large "Pause now" action button, today's pauses/saved stats, and pending morning reflection prompt.
- `src/pages/Pause.tsx`: v1 multi-step pause ritual (Step 1: Why, Step 2: Horizon, Step 3: Funding, Step 4: Limits, Step 5: Pressure check & countdown, Step 6: Confirmation).
- `src/pages/Journal.tsx`: Log of past decisions, 7-day stats summary, and morning-after reflection review.
- `src/pages/Mirror.tsx`: 7-day Recharts stacked bar chart of planned vs impulsive decisions, pause metrics, and borrowed money notice card.
- `src/pages/Trades.tsx`: Trade logging interface with 3-tap quick logger, CSV import, and recent trades table.
- `src/pages/Rules.tsx`: User-defined personal trading rules list, addition form, and suggested templates.
- `src/pages/Settings.tsx`: Language switcher (Hindi/English), demo data loader, and full database reset.
- `src/seed/seed.ts`: Realistic demo dataset generator (24 past trades, 8 decisions, 2 rules).
- `src/voice/voice.ts`: Browser Web Speech API wrappers for `SpeechSynthesis` and `SpeechRecognition` with graceful fallback.
- `src/workers/csvWorker.ts`: Web Worker for asynchronous PapaParse CSV parsing with Indian date formats and guardrails dropping unapproved columns.

---

## 2. Routes

| Route | Component | Status & Functionality |
|---|---|---|
| `/` | `Home` | Working. Shows big pause button, today's stats, and pending reflection prompt. |
| `/pause` | `Pause` | Working. 5-step form + countdown + decision recording into Dexie. |
| `/journal` | `Journal` | Working. Lists past decisions, allows logging morning reflections & feelings. |
| `/mirror` | `Mirror` | Working. 7-day stacked bar chart (Planned vs Impulsive) & high-level stats. |
| `/trades` | `Trades` | Working. Manual trade entry & CSV file import with Web Worker. |
| `/more` | `MoreMenu` | Working. Navigation hub for Rules and Settings. |
| `/rules` | `Rules` | Working. Create, view, and delete personal rules. |
| `/settings` | `Settings` | Working. Language switch, load demo seed, wipe all data. |

---

## 3. Currently Working Features & Verification

1. **Deterministic Pattern Engine**:
   - Accurately detects 6 behavioural signals (`late_night`, `many_trades_today`, `quick_reentry_after_loss`, `size_escalation`, `loss_streak`, `risky_funding`).
   - Maps fired signals to pressure levels (`calm`, `caution`, `high`) and friction durations (10s, 30s, 60s).
   - 27 unit tests pass in `signals.test.ts`.

2. **Strict Guardrails**:
   - Automated guardrail test ensures no banned words (`buy`, `sell`, `hold`, `target price`, `tip`, `tips`, `खरीद`, `बेच`) exist in locale JSONs.
   - CSV parser drops all tickers, symbols, brokers, and note columns, preserving zero stock-specific data.

3. **Storage & Data Integrity**:
   - IndexedDB database initialized via Dexie `ruko` v1 with tables `trades`, `decisions`, `rules`.
   - Seed data generator populates realistic history for demoing.

4. **i18n & Voice**:
   - Hindi and English translations available across all screens.
   - Text-to-speech (`speak`) and speech recognition (`listen`) work via native browser APIs with safe fallback when unsupported.

5. **PWA & Offline Readiness**:
   - Service worker generated via Workbox.
   - App compiles cleanly via `tsc && vite build`.
