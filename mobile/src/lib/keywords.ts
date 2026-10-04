export interface KeywordMapping {
  type: 'fomo' | 'revenge' | 'tip_following' | 'greed' | 'fear' | 'overconfidence';
  keywords: string[];
}

export const KEYWORD_MAP: KeywordMapping[] = [
  {
    type: 'fomo',
    keywords: ['everyone', 'miss', 'last chance', 'सब लोग', 'मौका', 'छूट'],
  },
  {
    type: 'revenge',
    keywords: ['win back', 'recover', 'get it back', 'वापस', 'घाटा निकालना', 'भरपाई'],
  },
  {
    type: 'tip_following',
    keywords: ['group', 'telegram', 'whatsapp', 'youtube', 'told me', 'बताया', 'ग्रुप', 'टेलीग्राम', 'व्हाट्सऐप'],
  },
  {
    type: 'greed',
    keywords: ['double', 'jackpot', 'huge', 'दोगुना', 'जैकपॉट', 'बड़ा मुनाफ़ा'],
  },
  {
    type: 'fear',
    keywords: ['scared', 'panic', 'afraid', 'डर', 'घबरा'],
  },
  {
    type: 'overconfidence',
    keywords: ['sure', 'cannot lose', 'guaranteed', 'पक्का', 'गारंटी'],
  },
];
