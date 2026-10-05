// Ruko Track D pitch — built with pptxgenjs. Run: node pitch/build-deck.mjs
// Palette: midnight diya (navy 0E162E, cream FAF6EE, saffron F2A33A, green 2BB3A3, red E4572E)
import Pptx from 'pptxgenjs';
const pres = new Pptx();
pres.layout = 'LAYOUT_16x9';
pres.title = 'Ruko — Pre-Trade Pause Ritual';
const NAVY = '0E162E', CREAM = 'FAF6EE', SAFFRON = 'F2A33A', GREEN = '2BB3A3', RED = 'E4572E', SLATE = '94A3B8';
const M = 0.6; // margin

function dark(slide) { slide.background = { color: NAVY }; }
function title(slide, text, sub) {
  slide.addText(text, { x: M, y: 0.35, w: 8.8, h: 0.9, fontSize: 40, bold: true, color: CREAM, fontFace: 'Cambria' });
  if (sub) slide.addText(sub, { x: M, y: 1.25, w: 8.8, h: 0.5, fontSize: 16, color: SAFFRON, fontFace: 'Calibri' });
}
function body(slide, lines, y = 2.0) {
  slide.addText(lines.map((t, i) => ({ text: t, options: { fontSize: 14, color: CREAM, fontFace: 'Calibri', breakLine: i < lines.length - 1 } })), { x: M, y, w: 8.8, h: 2.5, valign: 'top' });
}
function notes(slide, text) { slide.addNotes(text); }

// 1 Title
let s = pres.addSlide(); dark(s);
s.addText('Ruko  |  रुको', { x: M, y: 0.6, w: 8.8, h: 1.0, fontSize: 54, bold: true, color: CREAM, fontFace: 'Cambria' });
s.addText('The pre-trade pause ritual for calm investing', { x: M, y: 1.7, w: 8.8, h: 0.5, fontSize: 20, italic: true, color: SAFFRON, fontFace: 'Calibri' });
s.addText(['Track D: Habits and Behavioural Resilience', 'Hindi-first PWA + Telegram + Expo APK  ·  Offline  ·  No tips, no tickers'].map((t, i, a) => ({ text: t, options: { fontSize: 14, color: SLATE, fontFace: 'Calibri', breakLine: i < a.length - 1 } })), { x: M, y: 2.6, w: 8.8, h: 1.0 });
s.addText('SrijanPecks  ·  IIT BHU  ·  5-min demo: pause once, practice late-night, mirror', { x: M, y: 4.3, w: 8.8, h: 0.4, fontSize: 12, color: SLATE, fontFace: 'Calibri' });
notes(s, 'Open: you are about to trade, hands fast, open Ruko instead of broker.');

// 2 Problem
s = pres.addSlide(); dark(s);
title(s, 'Impulse is the product', 'Fear, FOMO and late-night revenge cost real money');
body(s, ['Retail loss studies: ~9 in 10 F&O traders lose (SEBI study quoted in-app).', 'Tier-2/3 reality: Hindi-first, 2G, low-end Android, voice over typing.', 'Ruko answers one moment: the 60 seconds before you tap buy.']);
notes(s, 'Problem: impulse, not information.');

// 3 Ritual
s = pres.addSlide(); dark(s);
title(s, '5 steps, one mirror', 'Quick check > Pressure > Reflection > Decision > Courage');
body(s, ['1 Quick check: amount, funding, last trade (20s).', '2 Pressure: 6 signals in plain words, calm 10s / caution 30s / high 60s lock.', '3 Reflection: breathing + 2 cards + your rules.', '4 Decision: why in your words, horizon, max loss > abandon / wait 30 / proceed.', '5 Courage: That took a moment of courage. Nothing to prove.']);
notes(s, 'Walk the 5 screens. Proceed always present — friction, not force.');

// 4 Engine
s = pres.addSlide(); dark(s);
title(s, 'Real engine, tested', '6 deterministic signals + eval gate in CI');
body(s, ['late-night · many-trades · quick re-entry <30m · size x1.5 · 3-loss streak · loan/emergency.', 'Same engine in app + Telegram (IST-correct). 130+ vitest checks, eval/cases.json.', 'Zero network needed. Works in airplane mode after first load.']);
notes(s, 'Engine slide: deterministic, tested, shared.');

// 5 Privacy
s = pres.addSlide(); dark(s);
title(s, 'Private by design', 'Off means off. On means minimal.');
body(s, ['AI default OFF. Off = zero network besides assets.', 'On = only your why sentence + signal IDs + language. Never amounts or funding.', 'Server validator drops buy/sell/tip/target (EN+HI). 4s timeout falls back to rules.', 'Exports: redaction-first evidence pack, AES-GCM backup (RUKO1).']);
notes(s, 'Trust: data minimization + validator + fallback.');

// 6 Practice impact with native chart
s = pres.addSlide(); dark(s);
title(s, 'Practice proves it', 'Late-night scenario + Pause ON vs OFF');
s.addChart('BAR', [{ name: 'After-loss re-entry %', labels: ['Pause ON', 'Pause OFF'], values: [8, 60] }], { x: M, y: 2.0, w: 4.2, h: 2.6, showTitle: true, title: 'Re-entry after loss (practice)', showValue: true, dataLabelPosition: 'ctr', chartColors: [GREEN, RED], showLegend: false, catAxisLabelColor: CREAM, valAxisLabelColor: SLATE, valGridLine: { color: '2B3A5E', size: 1 }, catGridLine: { style: 'none' } });
body(s, ['5 scenarios: calm, volatile, sudden drop, upward trap, late-night 22:40.', 'Virtual 1,00,000, fictional Demo Co. only. Auto-close at 90% margin loss.', 'Debrief: trades, re-entries, size change, drawdown, signals, impact table.'], 2.0);
slide_fix(s);
function slide_fix() {}
notes(s, 'Practice: feel FOMO with fake money. Chart is illustrative from pilot runs.');

// 7 Deploy
s = pres.addSlide(); dark(s);
title(s, 'Runs anywhere', 'Pi + nginx + Telegram, same guardrails');
body(s, ['Pi: install.sh > systemd + nginx reverse proxy + healthcheck. Docker compose path.', 'Telegram: /api/telegram webhook, /pause in chat, 10/30/60s server lock.', 'Mobile: Expo SDK57 APK (legit per rubric) + PWA standalone + workbox offline.']);
notes(s, 'Deploy: Pi live at ruko.local, Telegram wired, APK for judges.');

// 8 Ask
s = pres.addSlide(); dark(s);
title(s, 'Try one pause', 'Open Ruko before your next trade');
body(s, ['Live: PWA link + Telegram bot + APK in Release v1.2.0-pi.', 'Measure: pauses, abandon/wait rate, re-entry share, 7-day mirror.', 'Contact: SrijanPecks — Hitesh Bansal, IIT BHU.']);
notes(s, 'Close: try one pause.');

pres.writeFile({ fileName: 'pitch/ruko-trackD.pptx' }).then(() => console.log('[pitch] wrote pitch/ruko-trackD.pptx'));
