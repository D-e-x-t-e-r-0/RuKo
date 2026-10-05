import React from 'react';
import { LANGUAGES, changeAppLanguage, getSpeechCode } from '../i18n';
import { speak } from '../voice/voice';

interface LanguagePickerProps {
  onSelect: (lang: string) => void;
}

const GREETINGS: Record<string, string> = {
  hi: 'नमस्ते। यह ऐप आपको फ़ैसले से पहले एक पल रुकने में मदद करेगा।',
  en: 'Hello. This app helps you take a moment before you decide.',
  bn: 'নমস্কার। এই অ্যাপ সিদ্ধান্তের আগে এক মুহূর্ত থামতে সাহায্য করবে।',
  mr: 'नमस्कार. हे ॲप निर्णयाआधी एक क्षण थांबायला मदत करेल.',
  ta: 'வணக்கம். முடிவெடுக்கும் முன் ஒரு கணம் நிற்க இந்தச் செயலி உதவும்.',
  te: 'నమస్కారం. నిర్ణయానికి ముందు క్షణం ఆగడానికి ఈ యాప్ సహాయపడుతుంది.',
  kn: 'ನಮಸ್ಕಾರ. ನಿರ್ಧಾರಕ್ಕೂ ಮುನ್ನ ಒಂದು ಕ್ಷಣ ನಿಲ್ಲಲು ಈ ಆ್ಯಪ್ ಸಹಾಯ ಮಾಡುತ್ತದೆ.',
  ml: 'നമസ്കാരം. തീരുമാനത്തിന് മുൻപ് ഒരു നിമിഷം നിൽക്കാൻ ഈ ആപ്പ് സഹായിക്കും.',
  gu: 'નમસ્તે. આ ઍપ નિર્ણય પહેલાં એક ક્ષણ થોભવામાં મદદ કરશે.',
  pa: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ। ਇਹ ਐਪ ਫ਼ੈਸਲੇ ਤੋਂ ਪਹਿਲਾਂ ਪਲ ਰੁਕਣ ਵਿੱਚ ਮਦਦ ਕਰੇਗੀ।',
  or: 'ନମସ୍କାର। ଏହି ଆପ ନିଷ୍ପତ୍ତି ପୂର୍ବରୁ ଟିକେ ଅଟକିବାରେ ସାହାଯ୍ୟ କରିବ।',
  as: 'নমস্কাৰ। এই এপে সিদ্ধান্তৰ আগতে এটা মুহূৰ্ত ৰ’বলৈ সহায় কৰিব।',
};

export const LanguagePicker: React.FC<LanguagePickerProps> = ({ onSelect }) => {
  const handleSelect = (lang: string) => {
    changeAppLanguage(lang);
    speak(GREETINGS[lang] ?? GREETINGS.hi, getSpeechCode(lang));
    onSelect(lang);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#FAFAF9] text-navy flex flex-col justify-between p-6 max-w-md mx-auto overflow-y-auto">
      <div className="my-auto text-center space-y-6 rise">
        {/* App Logo & Title */}
        <div className="space-y-3">
          <div className="relative w-24 h-24 mx-auto rounded-full bg-gradient-to-b from-saffron to-ember border-2 border-saffron flex items-center justify-center text-night text-4xl font-black shadow-neu-diya">
            <span className="animate-flicker">रु</span>
          </div>
          <h1 className="font-ritual text-5xl font-black text-navy tracking-tight">
            रुको <span className="text-clay">·</span> Ruko
          </h1>
          <div className="jaali-line w-48 mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600 leading-relaxed max-w-xs mx-auto">
            फ़ैसले से पहले एक पल रुकें · Take a moment before you decide
          </p>
        </div>

        {/* Twelve-language grid */}
        <div className="grid grid-cols-2 gap-3 pt-4 max-w-sm mx-auto" role="group" aria-label="Language">
          {LANGUAGES.map((l, idx) => (
            <button
              key={l.code}
              type="button"
              onClick={() => handleSelect(l.code)}
              className={`min-h-[56px] py-3 px-4 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
                idx === 0
                  ? 'bg-saffron text-night shadow-neu-btn hover:bg-[#e09430]'
                  : 'bg-white border-2 border-slate-200 text-navy hover:border-saffron shadow-sm'
              }`}
            >
              <span className="block leading-tight">{l.nativeName}</span>
              <span className="block text-[11px] font-semibold opacity-70">{l.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 pb-2 pt-4">
        भाषा बाद में भी बदली जा सकती है • Language can be changed anytime
      </div>
    </div>
  );
};
