import { evaluateSignals, type PendingTrade } from '../src/engine/signals';
import { levelFor, frictionSeconds } from '../src/engine/pressure';
import { getFallbackTriggers, getFallbackQuestion } from '../src/ai/fallback';
import type { Funding, Horizon, Level, Signal, Trade, TriggerItem } from '../src/types';

/**
 * Pure conversation reducer for the Telegram-native Ruko pause ritual.
 *
 * No network, no clock access, no Telegram API — everything is driven by
 * (session, update, now) so the same logic is unit-testable and the HTTP
 * layer in `api/telegram.ts` stays thin.
 *
 * Guardrails mirrored from the app:
 * - Same 6 pressure signals (via `src/engine/signals`), same levels and
 *   friction seconds (via `src/engine/pressure`).
 * - Same reflection fallbacks (via `src/ai/fallback`); the AI layer is the
 *   shared `runReflectionTask` used by `/api/ai` — same zero-advisory
 *   validator.
 * - Amounts, funding, horizon and loss limits NEVER reach the AI layer.
 *   Only the typed "why" sentence, fired signal IDs and language leave the
 *   session — identical to the app's opt-in privacy contract.
 */

// ---------------------------------------------------------------------------
// Session model
// ---------------------------------------------------------------------------

export type Stage =
  | 'idle'
  | 'lang'
  | 'amount'
  | 'funding'
  | 'size'
  | 'last'
  | 'tt'
  | 'pressure'
  | 'why'
  | 'horizon'
  | 'max_loss'
  | 'reflecting'
  | 'decision'
  | 'done';

export interface BotStats {
  pauses: number;
  abandoned: number;
  delayed: number;
  proceeded: number;
}

export type LastAnswer = 'loss_recent' | 'loss_old' | 'profit' | 'none';

export interface BotSession {
  lang: 'hi' | 'en';
  stage: Stage;
  // quick-check answers
  amount?: number;
  funding?: Funding;
  sizeBigger?: boolean;
  last?: LastAnswer;
  tradesToday?: number; // 0 | 2 | 4 (0, "1-2", "3+")
  // pressure
  ritualStartedAt?: number;
  unlockAt?: number;
  signals?: Signal[];
  level?: Level;
  // decision
  why?: string;
  horizon?: Horizon;
  maxLoss?: number | null;
  triggers?: TriggerItem[];
  question?: string;
  // lifetime counters (best-effort, in-memory on the bot server)
  stats: BotStats;
}

export function newSession(lang: 'hi' | 'en' = 'hi'): BotSession {
  return {
    lang,
    stage: 'idle',
    stats: { pauses: 0, abandoned: 0, delayed: 0, proceeded: 0 },
  };
}

// ---------------------------------------------------------------------------
// Actions returned by the reducer
// ---------------------------------------------------------------------------

export interface KbButton {
  text: string;
  data: string;
}

export type BotAction =
  | {
      kind: 'send';
      text: string;
      keyboard?: KbButton[][];
      // plain: true → do not send with Markdown parse_mode (message embeds
      // user-derived text that could break Telegram's Markdown parser).
      plain?: boolean;
    }
  | { kind: 'reflect'; task: 'triggers' | 'question'; payload: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Timezone helpers — the web app evaluates signals on-device (user local
// time); the bot must evaluate in IST because serverless hosts run UTC.
// ---------------------------------------------------------------------------

const IST_OFFSET_MIN = 330;

export function istParts(ts: number): { hour: number; dayStart: number } {
  const shifted = new Date(ts + IST_OFFSET_MIN * 60 * 1000);
  const hour = shifted.getUTCHours();
  const dayStart =
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
    IST_OFFSET_MIN * 60 * 1000;
  return { hour, dayStart };
}

export function formatISTTime(ts: number, lang: 'hi' | 'en'): string {
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(ts).toLocaleTimeString(locale, {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Signal synthesis — map the chat answers onto the same engine the app uses
// ---------------------------------------------------------------------------

export function synthesizeTrades(s: BotSession, now: number): Trade[] {
  const amount = s.amount ?? 0;
  const funding: Funding = s.funding ?? 'savings';
  const pastAmt = s.sizeBigger ? Math.max(1, Math.round(amount / 2)) : amount;
  const H = 3600_000;
  const trades: Trade[] = [];

  // Most recent trade comes from the "last trade" answer.
  if (s.last === 'loss_recent') {
    trades.push({ ts: now - 12 * 60_000, amount: pastAmt, pnl: -1, funding });
  } else if (s.last === 'loss_old') {
    trades.push({ ts: now - 45 * 60_000, amount: pastAmt, pnl: -1, funding });
  } else if (s.last === 'profit') {
    trades.push({ ts: now - 30 * 60_000, amount: pastAmt, pnl: 1, funding });
  } else {
    trades.push({ ts: now - 5 * H, amount: pastAmt, pnl: null, funding });
  }

  // Earlier trades today (drive many_trades_today via calendar count).
  const tt = s.tradesToday ?? 0;
  for (let i = 0; i < tt; i++) {
    trades.push({ ts: now - (2 + i) * H, amount: pastAmt, pnl: null, funding });
  }

  // size_escalation needs >= 3 past trades; pad with yesterday trades so the
  // self-reported "bigger than usual" answer can fire it like the app does.
  const needPad = Math.max(0, 3 - trades.length);
  for (let i = 0; i < needPad; i++) {
    trades.push({ ts: now - (26 + i) * H, amount: pastAmt, pnl: null, funding });
  }

  return trades;
}

export function evaluatePressure(s: BotSession, now: number): { signals: Signal[]; level: Level } {
  const trades = synthesizeTrades(s, now);
  const pending: PendingTrade = {
    ts: now,
    amount: s.amount ?? 0,
    funding: s.funding ?? 'savings',
  };
  const signals = evaluateSignals(trades, pending);

  // IST overrides for the two time-based signals (serverless runs UTC).
  const { hour, dayStart } = istParts(now);
  const lateNight = signals.find(x => x.id === 'late_night');
  if (lateNight) {
    lateNight.fired = hour >= 22 || hour < 5;
    lateNight.params = { hour };
  }
  const todayCount = trades.filter(t => t.ts >= dayStart && t.ts <= now).length + 1;
  const many = signals.find(x => x.id === 'many_trades_today');
  if (many) {
    many.fired = todayCount >= 4;
    many.params = { count: todayCount };
  }

  return { signals, level: levelFor(signals) };
}

export function extractAmount(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = parseInt(cleaned, 10);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 1e12) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Copy — mirrors src/i18n/{en,hi}.json so the bot speaks with the app's voice
// ---------------------------------------------------------------------------

const T = {
  en: {
    welcome:
      '🙏 *Ruko (रुको)* — your pre-trade pause ritual, right here in chat.\n\nBefore your next trade, send /pause. Ruko walks you through the same 5 steps as the app: quick check → pressure check → reflection wait → decision → confirmation.\n\nNothing here is advice, tips or predictions. It is a mirror. 🪞',
    intro:
      '🙏 Namaste! Ruko is your pause ritual in chat — no app needed.\n\nBefore your next trade, send /pause. Nothing here is advice, tips or predictions. It is a mirror. 🪞\n\nSend /help for all commands.',
    help:
      '*Ruko commands*\n/pause — start the pre-trade pause ritual\n/mirror — your pause counts\n/checkin — a nudge when you come back\n/lang — switch language\n/cancel — leave the current ritual\n\nNo advice. No tips. No predictions. Only a pause. 🪞',
    nudgeRitual:
      'A pause is already in progress. Finish it, or send /cancel to leave it.',
    nudgeIdle:
      'Send /pause right before your next trade — that is what Ruko is for. 🪞',
    cancelDone: 'Okay, ritual cancelled. Ruko is here whenever you need a pause. 🪞',
    stepAmount:
      '*Step 1/5 · Quick check*\n\nHow much money are you about to trade? Send a number (₹).',
    askAmountAgain: 'Please send a plain number (₹), like 5000.',
    qFunding: 'Where is this money coming from?',
    fundSavings: '💰 Salary / savings',
    fundEmergency: '🚨 Emergency fund',
    fundLoan: '⚠️ Loan or borrowed',
    qSize: 'Compared to your usual trade size, this amount is…',
    sizeBigger: '📈 Bigger than usual',
    sizeSimilar: '≈ Similar or smaller',
    qLast: 'Your most recent trade — what happened, and when?',
    lastLossRecent: '🩸 Loss, under 30 min ago',
    lastLossOld: '🩸 Loss, over 30 min ago',
    lastProfit: '🌱 Profit, recently',
    lastNone: '🚫 No recent trade',
    qTt: 'How many trades have you already made today (not counting this one)?',
    tt0: 'None',
    tt2: '1–2',
    tt4: '3 or more',
    mirrorDisclaimer: 'Nothing here is a verdict. It is a mirror.',
    privacy:
      '🛡️ Amounts, funding and limits stay out of AI analysis. Only your own words and signal names are ever used.',
    breathe: '🫁 Unclench your jaw. Drop your shoulders. Take three slow breaths.',
    breatheLoop: 'In 4… hold 4… out 6. Repeat.',
    cardsTitle: 'Reflection cards — read slowly:',
    unlockBtn: '🔓 I am ready to decide',
    locked:
      'Still breathing… {{sec}}s left. The wait is the exercise. 🫁',
    qWhy:
      '*Step 4/5 · Decision*\n\nWhy are you making this trade? Answer in your own words — at least 3 characters.',
    whyShort: 'Please write at least 3 characters for why before deciding.',
    qHorizon: 'What is your time horizon for this trade?',
    hToday: 'Today only',
    hDays: 'A few days',
    hWeeks: 'Weeks or more',
    qMaxLoss: 'How much loss can you accept on this trade (₹)? Send a number, or skip.',
    skip: 'Skip',
    mirroring: '🪞 Holding your words up to the mirror…',
    mirrorHeard: '🪞 What I hear in your words:',
    mirrorHeardNone: '🪞 No strong behavioural triggers in your words.',
    noticedPattern: '• {{type}} — because you wrote "{{evidence}}"',
    questionLead: 'One question to sit with:',
    proceed: '▶️ Go ahead anyway',
    recorded: '✅ Decision recorded.',
    finalAbandon:
      'You stepped back — that counts. A pause is never a loss.\n\n_"That took a moment of courage. Nothing to prove."_',
    finalWait:
      'Good. Come back at {{time}} IST and send /pause — or just type "check in".\n\n_"That took a moment of courage. Nothing to prove."_',
    finalProceed:
      'You chose with open eyes. If it turns, come back and pause before adding more.\n\n_"That took a moment of courage. Nothing to prove."_',
    courage: '"That took a moment of courage. Nothing to prove."',
    checkin:
      '⏳ Check-in: is the urge to re-enter still there?\n\nIf yes — send /pause before acting. If it passed, well done. 🙏',
    mirrorStats:
      '📊 Your mirror so far:\n• Pauses: {{pauses}}\n• Stepped back (abandoned or waited): {{stepped}}\n• Went ahead anyway: {{proceeded}}\n\nKept on the bot server only — never synced with your app journal.',
    mirrorEmpty:
      'No pauses yet. Send /pause before your next trade and this mirror will start filling. 📊',
    // signal lines (mirror i18n signals.*)
    sigLate: 'It is {{hour}}:00. Late-night decisions are often rushed.',
    sigMany: 'This would be trade number {{count}} today.',
    sigReentry: 'Your last trade was a loss, {{minutes}} minutes ago.',
    sigSize: 'This amount is much bigger than your last few trades.',
    sigStreak: 'Your last 3 closed trades were all losses.',
    sigFunding: 'This money is marked as emergency or loan money.',
    sigNone: 'No pressure signals right now.',
    levelCalm: 'Calm',
    levelCaution: 'Caution',
    levelHigh: 'High pressure',
    signalsFired: '{{n}} of 6 signals fired.',
    // snippets (mirror i18n snippets.*)
    snip1: 'A 20% loss needs a 25% gain to get back to where you started.',
    snip2: 'A 50% loss needs a 100% gain to get back to where you started.',
    snip3: "SEBI's own study found that about 9 out of 10 individual F&O traders made a net loss.",
    snip4: 'Money you cannot afford to lose is the hardest money to trade calmly.',
    // trigger labels (mirror i18n pause.trigger_labels.*)
    fomo: 'FOMO',
    revenge: 'wanting to win back a loss',
    tip_following: 'following social suggestions',
    greed: 'greed',
    fear: 'fear',
    overconfidence: 'overconfidence',
  },
  hi: {
    welcome:
      '🙏 *रुको (Ruko)* — आपका प्री-ट्रेड पॉज़ रिचुअल, अब चैट में ही।\n\nअगले ट्रेड से पहले /pause भेजें। रुको ऐप जैसे ही 5 कदम चलाता है: क्विक चेक → प्रेशर चेक → रिफ्लेक्शन वेट → फैसला → पुष्टि।\n\nयहाँ कोई सलाह, टिप या भविष्यवाणी नहीं है। सिर्फ़ एक आईना। 🪞',
    intro:
      '🙏 नमस्ते! रुको आपका पॉज़ रिचुअल है — चैट में ही, ऐप की ज़रूरत नहीं।\n\nअगले ट्रेड से पहले /pause भेजें। यहाँ कोई सलाह, टिप या भविष्यवाणी नहीं है। सिर्फ़ एक आईना। 🪞\n\nसभी कमांड के लिए /help भेजें।',
    help:
      '*रुको कमांड*\n/pause — प्री-ट्रेड पॉज़ रिचुअल शुरू करें\n/mirror — आपके पॉज़ के आँकड़े\n/checkin — वापसी पर एक नज़र\n/lang — भाषा बदलें\n/cancel — चालू रिचुअल छोड़ें\n\nकोई सलाह नहीं। कोई टिप नहीं। कोई भविष्यवाणी नहीं। सिर्फ़ एक पॉज़। 🪞',
    nudgeRitual: 'एक पॉज़ पहले से चल रहा है। उसे पूरा करें, या /cancel भेजकर छोड़ दें।',
    nudgeIdle: 'अगले ट्रेड से ठीक पहले /pause भेजें — रुको इसी के लिए है। 🪞',
    cancelDone: 'ठीक है, रिचुअल रद्द कर दिया। जब पॉज़ चाहिए, रुको यहीं है। 🪞',
    stepAmount: '*कदम 1/5 · क्विक चेक*\n\nइस ट्रेड में कितने रुपये लगाने जा रहे हैं? सिर्फ़ नंबर भेजें (₹)।',
    askAmountAgain: 'कृपया सिर्फ़ नंबर (₹) भेजें, जैसे 5000।',
    qFunding: 'पैसा कहाँ से आ रहा है?',
    fundSavings: '💰 सैलरी / बचत',
    fundEmergency: '🚨 इमरजेंसी फंड',
    fundLoan: '⚠️ लोन या उधार',
    qSize: 'आपके आम ट्रेड की रकम से यह रकम…',
    sizeBigger: '📈 आम से बड़ी है',
    sizeSimilar: '≈ आम जितनी या छोटी',
    qLast: 'आपका पिछला ट्रेड — क्या हुआ था, कब हुआ था?',
    lastLossRecent: '🩸 घाटा, 30 मिनट से कम पहले',
    lastLossOld: '🩸 घाटा, 30 मिनट से पहले',
    lastProfit: '🌱 फ़ायदा, हाल में',
    lastNone: '🚫 कोई हालिया ट्रेड नहीं',
    qTt: 'आज आपने अब तक कितने ट्रेड किए हैं (यह वाला छोड़कर)?',
    tt0: 'कोई नहीं',
    tt2: '1–2',
    tt4: '3 या ज़्यादा',
    mirrorDisclaimer: 'यह कोई फ़ैसला नहीं, सिर्फ़ एक आईना है।',
    privacy:
      '🛡️ रकम, फंडिंग और लिमिट AI विश्लेषण से बाहर रहते हैं। सिर्फ़ आपके अपने शब्द और संकेतों के नाम इस्तेमाल होते हैं।',
    breathe: '🫁 जबड़ा ढीला करें, कंधे नीचे। तीन धीमी साँसें लें।',
    breatheLoop: 'सांस लें 4… रोकें 4… छोड़ें 6। दोहराएँ।',
    cardsTitle: 'रिफ्लेक्शन कार्ड — धीरे-धीरे पढ़ें:',
    unlockBtn: '🔓 मैं फैसला लेने के लिए तैयार हूँ',
    locked: 'अभी भी साँस ले रहे हैं… {{sec}} सेकंड बाकी। यही इंतज़ार असली अभ्यास है। 🫁',
    qWhy: '*कदम 4/5 · फैसला*\n\nयह ट्रेड क्यों कर रहे हैं? अपने शब्दों में लिखें — कम से कम 3 अक्षर।',
    whyShort: 'फ़ैसला लेने से पहले कृपया कारण में कम से कम 3 अक्षर लिखें।',
    qHorizon: 'यह ट्रेड कितने समय के लिए है?',
    hToday: 'आज ही',
    hDays: 'कुछ दिन',
    hWeeks: 'कुछ हफ्ते या ज़्यादा',
    qMaxLoss: 'इस ट्रेड में कितना नुकसान सह सकते हैं (₹)? नंबर भेजें, या छोड़ दें।',
    skip: 'छोड़ें',
    mirroring: '🪞 आपके शब्दों को आईने में देख रहे हैं…',
    mirrorHeard: '🪞 आपके शब्दों में मुझे यह दिखा:',
    mirrorHeardNone: '🪞 आपके शब्दों में कोई तेज़ व्यवहार संकेत नहीं मिला।',
    noticedPattern: '• {{type}} — क्योंकि आपने लिखा "{{evidence}}"',
    questionLead: 'एक सवाल, जिस पर ठहरकर सोचें:',
    proceed: '▶️ फिर भी आगे बढ़ो',
    recorded: '✅ फैसला दर्ज हो गया।',
    finalAbandon: 'आप कदम पीछे खींचे — यह भी गिनती में है। रुकना कभी घाटा नहीं।\n\n_"यह हिम्मत की बात थी। कुछ साबित करने की ज़रूरत नहीं।"_',
    finalWait:
      'अच्छा। {{time}} IST पर वापस आएँ और /pause भेजें — या बस "check in" लिखें।\n\n_"यह हिम्मत की बात थी। कुछ साबित करने की ज़रूरत नहीं।"_',
    finalProceed:
      'आपने खुली आँखों से चुना। अगर बात बिगड़े, तो और जोड़ने से पहले रुककर आइए।\n\n_"यह हिम्मत की बात थी। कुछ साबित करने की ज़रूरत नहीं।"_',
    courage: '"यह हिम्मत की बात थी। कुछ साबित करने की ज़रूरत नहीं।"',
    checkin:
      '⏳ चेक-इन: दोबारा एंट्री की बेचैनी अभी भी है?\n\nअगर हाँ — काम करने से पहले /pause भेजें। अगर निकल गई, शाबाश। 🙏',
    mirrorStats:
      '📊 अब तक का आपका आईना:\n• पॉज़: {{pauses}}\n• कदम पीछे (छोड़ा या टाला): {{stepped}}\n• फिर भी आगे बढ़े: {{proceeded}}\n\nसिर्फ़ बॉट सर्वर पर सुरक्षित — ऐप की जर्नल से कभी सिंक नहीं होता।',
    mirrorEmpty: 'अभी कोई पॉज़ नहीं। अगले ट्रेड से पहले /pause भेजें — यह आईना भरने लगेगा। 📊',
    sigLate: 'अभी रात के {{hour}} बजे हैं। देर रात के फैसले अक्सर जल्दबाज़ी में होते हैं।',
    sigMany: 'आज यह {{count}} नंबर का ट्रेड होगा।',
    sigReentry: 'पिछला ट्रेड घाटे में था, {{minutes}} मिनट पहले।',
    sigSize: 'यह रकम पिछले कुछ ट्रेड से काफ़ी बड़ी है।',
    sigStreak: 'पिछले 3 बंद ट्रेड सब घाटे में रहे।',
    sigFunding: 'यह पैसा इमरजेंसी या लोन का है।',
    sigNone: 'अभी कोई दबाव का संकेत नहीं दिखा।',
    levelCalm: 'शांत',
    levelCaution: 'सावधान',
    levelHigh: 'ज़्यादा दबाव',
    signalsFired: '6 में से {{n}} संकेत दिखे।',
    snip1: '20% नुकसान की भरपाई के लिए 25% फ़ायदा चाहिए।',
    snip2: '50% नुकसान की भरपाई के लिए 100% फ़ायदा चाहिए।',
    snip3: 'SEBI के अपने अध्ययन में लगभग 10 में से 9 व्यक्तिगत F&O ट्रेडर्स को शुद्ध घाटा हुआ।',
    snip4: 'जिस पैसे को खोने का डर हो, उससे शांत होकर ट्रेड करना सबसे मुश्किल होता है।',
    fomo: 'FOMO (छूट जाने का डर)',
    revenge: 'घाटा वापस पाने की चाह',
    tip_following: 'टिप का पीछा करना',
    greed: 'लालच',
    fear: 'डर या घबराहट',
    overconfidence: 'अति-आत्मविश्वास',
  },
} as const;

type Lang = 'hi' | 'en';

function t(s: BotSession, key: keyof typeof T['en'], params?: Record<string, string | number>): string {
  const dict = T[s.lang] as Record<string, string>;
  let text = dict[key] ?? (T.en as Record<string, string>)[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), String(v));
    }
  }
  return text;
}

const btn = (text: string, data: string): KbButton => ({ text, data });

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

export function pressureText(s: BotSession): string {
  const fired = (s.signals ?? []).filter(x => x.fired);
  const lines: string[] = [];
  for (const sig of fired) {
    if (sig.id === 'late_night') lines.push(t(s, 'sigLate', { hour: sig.params.hour }));
    else if (sig.id === 'many_trades_today') lines.push(t(s, 'sigMany', { count: sig.params.count }));
    else if (sig.id === 'quick_reentry_after_loss') lines.push(t(s, 'sigReentry', { minutes: sig.params.minutes }));
    else if (sig.id === 'size_escalation') lines.push(t(s, 'sigSize'));
    else if (sig.id === 'loss_streak') lines.push(t(s, 'sigStreak'));
    else if (sig.id === 'risky_funding') lines.push(t(s, 'sigFunding'));
  }

  const n = fired.length;
  const level = s.level ?? 'calm';
  const levelText =
    level === 'calm' ? t(s, 'levelCalm') : level === 'caution' ? t(s, 'levelCaution') : t(s, 'levelHigh');

  const body = n === 0 ? t(s, 'sigNone') : lines.join('\n');
  const counts = n === 0 ? '' : `\n\n${t(s, 'signalsFired', { n })} — ${levelText}`;

  return `🪞 *${s.lang === 'hi' ? 'कदम 2/5 · प्रेशर चेक' : 'Step 2/5 · Pressure check'}*\n\n${body}${counts}\n\n${t(s, 'mirrorDisclaimer')}`;
}

const SNIPPET_KEYS = ['snip1', 'snip2', 'snip3', 'snip4'] as const;

export function reflectionText(s: BotSession, unlockAt: number, now: number): string {
  const waitSec = Math.max(0, Math.round((unlockAt - now) / 1000));
  const picked: string[] = [];
  const pool = [...SNIPPET_KEYS];
  while (picked.length < 2 && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(t(s, pool[i] as keyof typeof T['en']));
    pool.splice(i, 1);
  }
  const header =
    s.lang === 'hi' ? 'कदम 3/5 · रिफ्लेक्शन वेट' : 'Step 3/5 · Reflection wait';
  return [
    `🕯️ *${header}*`,
    '',
    t(s, 'breathe'),
    t(s, 'breatheLoop'),
    '',
    `${t(s, 'cardsTitle')}`,
    ...picked.map(sn => `„ ${sn}`),
    '',
    t(s, 'mirrorDisclaimer'),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Keyboard builders
// ---------------------------------------------------------------------------

const kbLang = (): KbButton[][] => [[btn('हिन्दी', 'lang:hi'), btn('English', 'lang:en')]];

const kbCancel = (s: BotSession): KbButton[][] => [
  [btn(s.lang === 'hi' ? '✖️ रिचुअल छोड़ें' : '✖️ Leave the ritual', 'cancel')],
];

const kbFunding = (s: BotSession): KbButton[][] => [
  [btn(t(s, 'fundSavings'), 'fund:savings')],
  [btn(t(s, 'fundEmergency'), 'fund:emergency')],
  [btn(t(s, 'fundLoan'), 'fund:loan')],
  ...kbCancel(s),
];

const kbSize = (s: BotSession): KbButton[][] => [
  [btn(t(s, 'sizeBigger'), 'size:yes'), btn(t(s, 'sizeSimilar'), 'size:no')],
];

const kbLast = (s: BotSession): KbButton[][] => [
  [btn(t(s, 'lastLossRecent'), 'last:loss_recent')],
  [btn(t(s, 'lastLossOld'), 'last:loss_old')],
  [btn(t(s, 'lastProfit'), 'last:profit'), btn(t(s, 'lastNone'), 'last:none')],
];

const kbTt = (s: BotSession): KbButton[][] => [
  [btn(t(s, 'tt0'), 'tt:0'), btn(t(s, 'tt2'), 'tt:2'), btn(t(s, 'tt4'), 'tt:4')],
];

const kbUnlock = (s: BotSession): KbButton[][] => [[btn(t(s, 'unlockBtn'), 'dec:unlock')]];

const kbHorizon = (s: BotSession): KbButton[][] => [
  [btn(t(s, 'hToday'), 'horizon:today'), btn(t(s, 'hDays'), 'horizon:days')],
  [btn(t(s, 'hWeeks'), 'horizon:weeks')],
];

const kbMaxLoss = (s: BotSession): KbButton[][] => [[btn(t(s, 'skip'), 'maxloss:skip')]];

const kbDecision = (s: BotSession): KbButton[][] => [
  [btn(s.lang === 'hi' ? '🚫 यह ट्रेड छोड़ दो' : '🚫 Abandon this trade', 'dec:abandon')],
  [btn(s.lang === 'hi' ? '⏳ 30 मिनट रुको' : '⏳ Wait 30 minutes', 'dec:wait')],
  [btn(s.lang === 'hi' ? '▶️ फिर भी आगे बढ़ो' : '▶️ Go ahead anyway', 'dec:proceed')],
];

// ---------------------------------------------------------------------------
// Triggers / question messages
// ---------------------------------------------------------------------------

function triggersLine(s: BotSession, tr: TriggerItem): string {
  const label = t(s, tr.type as keyof typeof T['en']);
  return t(s, 'noticedPattern', { type: label, evidence: tr.evidence });
}

export function mirrorText(s: BotSession): string {
  const triggers = s.triggers ?? [];
  const head =
    triggers.length === 0
      ? t(s, 'mirrorHeardNone')
      : [t(s, 'mirrorHeard'), ...triggers.map(tr => triggersLine(s, tr))].join('\n');
  const question = s.question ?? '';
  return [
    head,
    '',
    question ? `${t(s, 'questionLead')}\n"${question}"` : '',
    '',
    t(s, 'privacy'),
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function ritualInProgress(s: BotSession): boolean {
  return !['idle', 'done', 'lang'].includes(s.stage);
}

function resetRitualAnswers(s: BotSession): void {
  s.amount = undefined;
  s.funding = undefined;
  s.sizeBigger = undefined;
  s.last = undefined;
  s.tradesToday = undefined;
  s.signals = undefined;
  s.level = undefined;
  s.ritualStartedAt = undefined;
  s.unlockAt = undefined;
  s.why = undefined;
  s.horizon = undefined;
  s.maxLoss = undefined;
  s.triggers = undefined;
  s.question = undefined;
}

function beginPressureStep(s: BotSession, now: number): BotAction[] {
  const { signals, level } = evaluatePressure(s, now);
  s.signals = signals;
  s.level = level;
  s.ritualStartedAt = now;
  s.unlockAt = now + frictionSeconds[level] * 1000;
  s.stage = 'pressure';
  return [
    { kind: 'send', text: pressureText(s) },
    { kind: 'send', text: reflectionText(s, s.unlockAt, now), keyboard: kbUnlock(s) },
    { kind: 'send', text: t(s, 'privacy') },
  ];
}

export function handleCommand(s: BotSession, raw: string, now: number): BotAction[] {
  const cmd = raw.trim().split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();

  switch (cmd) {
    case 'start': {
      if (ritualInProgress(s)) return [{ kind: 'send', text: t(s, 'nudgeRitual') }];
      s.stage = 'lang';
      resetRitualAnswers(s);
      // First contact: greet in both languages until a language is chosen.
      return [{ kind: 'send', text: `${T.en.welcome}\n\n———\n\n${T.hi.welcome}`, keyboard: kbLang() }];
    }
    case 'pause': {
      if (ritualInProgress(s)) return [{ kind: 'send', text: t(s, 'nudgeRitual') }];
      resetRitualAnswers(s);
      s.ritualStartedAt = now;
      s.stage = 'amount';
      return [{ kind: 'send', text: t(s, 'stepAmount') }];
    }
    case 'lang': {
      s.stage = 'lang';
      return [{ kind: 'send', text: s.lang === 'hi' ? '🌐 भाषा चुनें:' : '🌐 Choose language:', keyboard: kbLang() }];
    }
    case 'mirror': {
      const st = s.stats;
      if (st.pauses === 0) return [{ kind: 'send', text: t(s, 'mirrorEmpty') }];
      return [
        {
          kind: 'send',
          text: t(s, 'mirrorStats', {
            pauses: st.pauses,
            stepped: st.abandoned + st.delayed,
            proceeded: st.proceeded,
          }),
        },
      ];
    }
    case 'checkin':
      return [{ kind: 'send', text: t(s, 'checkin') }];
    case 'cancel': {
      const wasRitual = ritualInProgress(s);
      s.stage = 'idle';
      resetRitualAnswers(s);
      return [{ kind: 'send', text: wasRitual ? t(s, 'cancelDone') : t(s, 'nudgeIdle') }];
    }
    case 'help':
      return [{ kind: 'send', text: t(s, 'help') }];
    default:
      return [{ kind: 'send', text: t(s, 'help') }];
  }
}

export function handleText(s: BotSession, raw: string, now: number): BotAction[] {
  const text = raw.trim();
  if (text.startsWith('/')) return handleCommand(s, text, now);

  switch (s.stage) {
    case 'amount': {
      const amount = extractAmount(text);
      if (amount === null) return [{ kind: 'send', text: t(s, 'askAmountAgain') }];
      s.amount = amount;
      s.stage = 'funding';
      return [{ kind: 'send', text: t(s, 'qFunding'), keyboard: kbFunding(s) }];
    }
    case 'why': {
      const why = text.slice(0, 500);
      if (why.trim().length < 3) return [{ kind: 'send', text: t(s, 'whyShort') }];
      s.why = why;
      s.stage = 'horizon';
      return [{ kind: 'send', text: t(s, 'qHorizon'), keyboard: kbHorizon(s) }];
    }
    case 'max_loss': {
      const amount = extractAmount(text);
      s.maxLoss = amount; // null when unparseable → treated like skip
      return beginReflectionStep(s, now);
    }
    case 'idle':
    case 'done':
    case 'lang':
      return [{ kind: 'send', text: t(s, 'nudgeIdle') }];
    default:
      // mid-ritual text where buttons are expected
      return [{ kind: 'send', text: t(s, 'nudgeRitual') }];
  }
}

function beginReflectionStep(s: BotSession, now: number): BotAction[] {
  s.stage = 'reflecting'; // transient; applyTriggersResult moves it on
  s.triggers = undefined;
  s.question = undefined;
  return [
    { kind: 'send', text: t(s, 'mirroring') },
    {
      kind: 'reflect',
      task: 'triggers',
      // Privacy: only the typed why sentence — never amounts/funding/limits.
      payload: { why: s.why ?? '' },
    },
  ];
}

export function handleCallback(s: BotSession, data: string, now: number): BotAction[] {
  const [ns, value] = data.split(':');

  switch (ns) {
    case 'cancel': {
      const wasRitual = ritualInProgress(s);
      s.stage = 'idle';
      resetRitualAnswers(s);
      return [{ kind: 'send', text: wasRitual ? t(s, 'cancelDone') : t(s, 'nudgeIdle') }];
    }
    case 'lang': {
      s.lang = value === 'en' ? 'en' : 'hi';
      s.stage = 'idle';
      return [{ kind: 'send', text: t(s, 'intro') }];
    }
    case 'fund': {
      if (s.stage !== 'funding') return [];
      const funding = value as Funding;
      if (!['savings', 'emergency', 'loan'].includes(funding)) return [];
      s.funding = funding;
      s.stage = 'size';
      return [{ kind: 'send', text: t(s, 'qSize'), keyboard: kbSize(s) }];
    }
    case 'size': {
      if (s.stage !== 'size') return [];
      s.sizeBigger = value === 'yes';
      s.stage = 'last';
      return [{ kind: 'send', text: t(s, 'qLast'), keyboard: kbLast(s) }];
    }
    case 'last': {
      if (s.stage !== 'last') return [];
      if (!['loss_recent', 'loss_old', 'profit', 'none'].includes(value)) return [];
      s.last = value as LastAnswer;
      s.stage = 'tt';
      return [{ kind: 'send', text: t(s, 'qTt'), keyboard: kbTt(s) }];
    }
    case 'tt': {
      if (s.stage !== 'tt') return [];
      const tt = parseInt(value, 10);
      if (![0, 2, 4].includes(tt)) return [];
      s.tradesToday = tt;
      return beginPressureStep(s, now);
    }
    case 'dec': {
      if (value === 'unlock') {
        if (s.stage !== 'pressure') return [];
        if (s.unlockAt !== undefined && now < s.unlockAt) {
          const sec = Math.ceil((s.unlockAt - now) / 1000);
          return [{ kind: 'send', text: t(s, 'locked', { sec }) }];
        }
        s.stage = 'why';
        return [{ kind: 'send', text: t(s, 'qWhy') }];
      }
      if (s.stage !== 'decision') return [];
      if (value === 'abandon') {
        s.stats.pauses++;
        s.stats.abandoned++;
        s.stage = 'done';
        return [{ kind: 'send', text: `${t(s, 'recorded')}\n\n${t(s, 'finalAbandon')}` }];
      }
      if (value === 'wait') {
        s.stats.pauses++;
        s.stats.delayed++;
        s.stage = 'done';
        const at = formatISTTime(now + 30 * 60_000, s.lang);
        return [{ kind: 'send', text: `${t(s, 'recorded')}\n\n${t(s, 'finalWait', { time: at })}` }];
      }
      if (value === 'proceed') {
        s.stats.pauses++;
        s.stats.proceeded++;
        s.stage = 'done';
        return [{ kind: 'send', text: `${t(s, 'recorded')}\n\n${t(s, 'finalProceed')}` }];
      }
      return [];
    }
    case 'horizon': {
      if (s.stage !== 'horizon') return [];
      if (!['today', 'days', 'weeks'].includes(value)) return [];
      s.horizon = value as Horizon;
      s.stage = 'max_loss';
      return [{ kind: 'send', text: t(s, 'qMaxLoss'), keyboard: kbMaxLoss(s) }];
    }
    case 'maxloss': {
      if (s.stage !== 'max_loss') return [];
      s.maxLoss = null;
      return beginReflectionStep(s, now);
    }
    default:
      return [];
  }
}

/**
 * Called with the validated result of the `triggers` reflection task
 * (or null when the AI layer is off/failed → deterministic fallback).
 */
export function applyTriggersResult(s: BotSession, data: { triggers?: TriggerItem[] } | null): BotAction[] {
  const triggers = data?.triggers ?? getFallbackTriggers(s.why ?? '');
  s.triggers = triggers.slice(0, 3);
  const firedIds = (s.signals ?? []).filter(x => x.fired).map(x => x.id);
  return [
    {
      kind: 'reflect',
      task: 'question',
      payload: { why: s.why ?? '', triggers: s.triggers, signals: firedIds },
    },
  ];
}

/**
 * Called with the validated result of the `question` reflection task
 * (or null → deterministic fallback question). Emits the mirror message
 * plus the three conscious choices.
 */
export function applyQuestionResult(s: BotSession, data: { question?: string } | null): BotAction[] {
  const firedIds = (s.signals ?? []).filter(x => x.fired).map(x => x.id);
  s.question = data?.question ?? getFallbackQuestion(firedIds, s.lang);
  s.stage = 'decision';
  return [
    {
      kind: 'send',
      text: mirrorText(s),
      keyboard: kbDecision(s),
      plain: true, // embeds the user's own words — never Markdown-parsed
    },
  ];
}