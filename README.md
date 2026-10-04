# Ruko (रुको) — Pre-Trade Pause Ritual & Decision Mirror

**SANGYAN Investor Resilience Hackathon**  
*Track D: Financial Habits & Behavioural Resilience*

---

## 1. What Ruko Is

Ruko (रुको) is a mobile-first, offline-capable Progressive Web Application (PWA) designed for retail investors in Tier-2 and Tier-3 India. 

Rather than acting on impulse or emotional distress, the user opens Ruko to complete a structured **pause ritual**:
1. **Screen 1 (Quick check):** Fast input of trade amount, funding source, and recent trade outcome.
2. **Screen 2 (Pressure check):** Real-time behavioral pressure check evaluating 6 distinct signals (late-night, rapid reentry after loss, size escalation, loss streak, risky funding, trading volume).
3. **Screen 3 (Reflection wait):** Conscious friction with a synchronized breathing circle, dynamic auto-advancing reflection cards with a "Keep this card" toggle, voice read-aloud via Web Speech, and your personal rules.
4. **Screen 4 (Decision):** Locked until the trader types at least 3 characters explaining *why* they want to make this trade, accompanied by time horizon and acceptable loss limits, leading to three conscious choices: *Abandon*, *Wait 30 minutes*, or *Proceed*.
5. **Screen 5 (Confirmation):** Immediate reinforcement acknowledging the pause with an uplifting courage quote ("That took a moment of courage. Nothing to prove.").

---

## 2. Practice Mode Dummy Trading Simulator

Ruko includes an offline, deterministic **Practice Simulator** allowing users to experience psychological market stress without risking real capital:
- **Permanent Safety Banner:** *"Practice money. Not real. Prices are random and cannot be predicted."*
- **5 Market Scenarios:**
  - `Calm day`: Small drift, minimal noise.
  - `Volatile day`: Large swings both directions.
  - `Sudden drop`: Rapid ~12% drawdown after an initial steady rise.
  - `Upward trap`: Sharp rise followed by sudden reversal.
  - `Late night`: Sim clock starts at 22:40 with prior loss seeded to trigger late-night and reentry pressure signals.
- **Fictional Instruments:** Demo Index, Demo Co. A, Demo Co. B, Demo Futures (5x leverage). No real market tickers or symbols.
- **Virtual Account:** Starting balance of ₹1,00,000, margin chips (10%, 25%, 50%), and 1x or 5x leverage.
- **Auto-Close Rule:** If unrealized position loss reaches or exceeds 90% of allocated margin, the position is automatically closed with an educational notice banner.
- **Integrated Pause Ritual:** When enabled, opening a position freezes the simulator clock and triggers the 5-screen pause ritual. Abandoning or delaying cancels the entry; proceeding opens it.
- **Session Debrief:** Comprehensive post-session analysis measuring total trades opened, rapid reentries (<= 5m after a loss), size escalation %, max drawdown %, realized P&L, pauses completed, observed pressure signals, an AI or rule-based reflection summary, and a self-reflection note prompt.

---

## 3. Opt-in AI Layer & Strict Data Privacy

Ruko features an optional, privacy-preserving AI assistant:
- **Default OFF:** Disabled by default with an explicit consent modal.
- **Privacy Guarantee:** With AI off, **nothing leaves your device** (zero network calls besides initial app asset loading). With AI on, **only** the typed why sentence (or aggregate counts for weekly/practice summaries), signal IDs, and language are sent. Never amounts, trades, funding sources, names, or personal identifiers.
- **Serverless API Proxy:** Requests route through `/api/ai` (Vercel) or `netlify/functions/ai` (Netlify) where API keys reside securely. No API keys exist in client bundles.
- **Rate Limited:** Server-side rate limiting caps requests to 20 calls per IP per hour.
- **Zero-Advisory Enforcement:** Server-side response validator checks every output for banned words. If the model attempts to advise on market direction or predict prices, the response is discarded and a deterministic fallback is served.
- **4-Second Timeout:** If the network is slow or offline, the client silently falls back to rule-based triggers and summaries without blocking the user.
- **Transparent Attribution:** Every AI-generated question or summary displays a badge explaining exactly why the content is shown.

---

## 4. Hard Guardrails

- **Zero Advisory:** No price targets, market sentiment predictions, or trading advice.
- **No Real Tickers or Broker APIs:** Strictly uses fictional instruments for practice and generic amounts for logging. No broker links, SMS/OTP access, or credentials.
- **Non-Judgmental Tone:** Objective mirroring of facts rather than moralizing labels.
- **Unblocked Proceed Option:** Slows traders down with mindful friction, but preserves autonomy.

---

## 5. Tech Stack

- **Framework:** React 18 + TypeScript (Strict Mode) + Vite
- **Styling:** Tailwind CSS (Navy `#14213D`, Cream `#FAF6EE`, Saffron `#F2A33A`, Green `#2BB3A3`, Red `#E4572E`)
- **Routing:** `react-router-dom` (HashRouter for universal static hosting)
- **Local Storage:** `dexie` (IndexedDB v3)
- **PWA:** `vite-plugin-pwa` (precache + web app manifest)
- **Charts:** `recharts` (weekly mirror stacked bar chart and practice price line chart)
- **i18n & Speech:** `i18next`, `react-i18next` (`hi` default, `en`), Web Speech API
- **Testing:** `vitest`

---

## 6. How to Run Locally

### Install dependencies:
```bash
npm install
```

### Run development server:
```bash
npm run dev
```

### Run tests:
```bash
npm test
```

### Build production bundle:
```bash
npm run build
```

---

## 7. How to Deploy to Vercel or Netlify

### Environment Variables (Optional for AI Layer):
- `GEMINI_API_KEY`: Your Google Gemini API key (configured as a secret in Vercel/Netlify dashboard; backwards compatible with `ANTHROPIC_API_KEY`).
- `AI_MODEL`: Gemini model to use (defaults to `gemini-1.5-flash`).

### Deploying to Vercel:
1. Connect this repository to Vercel (or run `npx vercel`).
2. Settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. In Project Settings -> Environment Variables, add:
   - `GEMINI_API_KEY`: `AIzaSy...`
   - `AI_MODEL`: `gemini-1.5-flash` (optional)
4. The serverless route `/api/ai.ts` is automatically detected and served by Vercel.
