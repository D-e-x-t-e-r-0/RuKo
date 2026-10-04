import { KEYWORD_MAP } from './keywords';
import type { TriggerItem } from '../types';

export function getFallbackTriggers(whyText: string): TriggerItem[] {
  if (!whyText || !whyText.trim()) return [];

  const lower = whyText.toLowerCase();
  const matched: TriggerItem[] = [];
  const seenTypes = new Set<string>();

  for (const group of KEYWORD_MAP) {
    if (seenTypes.has(group.type)) continue;

    for (const kw of group.keywords) {
      const idx = lower.indexOf(kw.toLowerCase());
      if (idx !== -1) {
        // Slice the exact text from the original user string
        const evidence = whyText.slice(idx, idx + kw.length);
        matched.push({
          type: group.type,
          evidence,
        });
        seenTypes.add(group.type);
        break;
      }
    }

    if (matched.length >= 3) break;
  }

  return matched;
}

export function getFallbackQuestion(
  firedSignals: string[],
  lang: 'hi' | 'en'
): string {
  const isHi = lang === 'hi';
  const firstSignal = firedSignals.length > 0 ? firedSignals[0] : null;

  switch (firstSignal) {
    case 'late_night':
      return isHi
        ? 'क्या आप कल दोपहर 2 बजे भी यही फ़ैसला लेते?'
        : 'Would you make this same decision at 2 pm tomorrow?';
    case 'quick_reentry_after_loss':
    case 'loss_streak':
      return isHi
        ? 'क्या आप पिछला घाटा वापस पाना चाहते हैं, या कोई नया कारण है?'
        : 'Are you trying to win back the last loss, or is there a fresh reason?';
    case 'risky_funding':
      return isHi
        ? 'यह पैसा किस काम के लिए था? अगर यह डूब गया तो वह काम कैसे होगा?'
        : 'What was this money meant for? Will that still be covered if you lose it?';
    case 'many_trades_today':
      return isHi
        ? 'आज के पिछले ट्रेड से आपने क्या सीखा?'
        : 'What did your earlier trades today teach you?';
    case 'size_escalation':
      return isHi
        ? 'यह रकम आम से बड़ी क्यों है?'
        : 'Why is this amount bigger than usual?';
    default:
      return isHi
        ? 'अगर आपका दोस्त यही करने जा रहा होता, तो आप उसे क्या कहते?'
        : 'What would you tell a friend who was about to do this?';
  }
}

export function getFallbackSummary(payload: any, lang: 'hi' | 'en'): string {
  const isHi = lang === 'hi';
  const pauses = payload.pauses ?? 0;
  const steppedBack = (payload.abandoned ?? 0) + (payload.delayed ?? 0);

  if (payload.context === 'practice') {
    return isHi
      ? `इस अभ्यास सत्र में आपने ${pauses} बार पॉज़ लिया और ${steppedBack} ट्रेड छोड़े या टाले।`
      : `In this practice session you paused ${pauses} times and stepped back from ${steppedBack} trades.`;
  }

  return isHi
    ? `इस हफ्ते आप ${pauses} बार रुके और ${steppedBack} ट्रेड से कदम पीछे खींचे।`
    : `This week you paused ${pauses} times and stepped back from ${steppedBack} trades.`;
}
