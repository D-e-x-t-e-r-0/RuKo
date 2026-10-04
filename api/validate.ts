export const BANNED_REGEX =
  /\b(buy|sell|hold|target|stock|share price|nifty|sensex|banknifty|invest in|should trade)\b/i;

export const BANNED_HINDI_REGEX =
  /खरीदो|बेचो|निवेश करें|स्टॉक|शेयर खरीद/;

export function hasBannedWords(text: string): boolean {
  if (!text) return false;
  return BANNED_REGEX.test(text) || BANNED_HINDI_REGEX.test(text);
}

export interface TriggerItem {
  type: 'fomo' | 'revenge' | 'tip_following' | 'greed' | 'fear' | 'overconfidence';
  evidence: string;
}

const ALLOWED_TRIGGER_TYPES = new Set([
  'fomo',
  'revenge',
  'tip_following',
  'greed',
  'fear',
  'overconfidence',
]);

export function validateTriggers(
  data: any,
  whyText: string
): { triggers: TriggerItem[] } | null {
  if (!data || typeof data !== 'object') return null;
  if (!Array.isArray(data.triggers)) return null;

  const validItems: TriggerItem[] = [];

  for (const item of data.triggers) {
    if (!item || typeof item !== 'object') continue;
    if (!ALLOWED_TRIGGER_TYPES.has(item.type)) continue;
    if (typeof item.evidence !== 'string') continue;

    const evidence = item.evidence.trim();
    if (!evidence) continue;

    // Reject banned words in evidence
    if (hasBannedWords(evidence)) continue;

    // At most 8 words
    const words = evidence.split(/\s+/);
    if (words.length > 8) continue;

    // Must be exact substring of whyText (case-insensitive check against original text)
    if (!whyText.toLowerCase().includes(evidence.toLowerCase())) {
      continue;
    }

    validItems.push({
      type: item.type,
      evidence,
    });

    if (validItems.length >= 3) break;
  }

  return { triggers: validItems };
}

export function validateQuestion(data: any): { question: string } | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.question !== 'string') return null;

  const question = data.question.trim();
  if (!question || question.length > 160) return null;
  if (hasBannedWords(question)) return null;

  return { question };
}

export function validateSummary(data: any): { summary: string } | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.summary !== 'string') return null;

  const summary = data.summary.trim();
  if (!summary || summary.length > 400) return null;
  if (hasBannedWords(summary)) return null;

  return { summary };
}
