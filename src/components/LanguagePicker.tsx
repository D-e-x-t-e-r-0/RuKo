import React from 'react';
import { changeAppLanguage } from '../i18n';
import { speak } from '../voice/voice';

interface LanguagePickerProps {
  onSelect: (lang: 'hi' | 'en') => void;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({ onSelect }) => {
  const handleSelect = (lang: 'hi' | 'en') => {
    changeAppLanguage(lang);
    if (lang === 'hi') {
      speak('नमस्ते। यह ऐप आपको फ़ैसले से पहले एक पल रुकने में मदद करेगा।', 'hi-IN');
    } else {
      speak('Hello. This app helps you take a moment before you decide.', 'en-IN');
    }
    onSelect(lang);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-abyss text-cream flex flex-col justify-between p-6 max-w-md mx-auto">
      <div className="my-auto text-center space-y-6 rise">
        {/* App Logo & Title */}
        <div className="space-y-3">
          <div className="relative w-24 h-24 mx-auto rounded-full bg-gradient-to-b from-saffron/25 to-transparent border-2 border-saffron/70 flex items-center justify-center text-saffron text-4xl font-black shadow-diya">
            <span className="animate-flicker">रु</span>
          </div>
          <h1 className="font-ritual text-5xl font-black text-cream tracking-tight">
            रुको <span className="text-saffron">·</span> Ruko
          </h1>
          <div className="jaali-line w-48 mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-300 leading-relaxed max-w-xs mx-auto">
            फ़ैसले से पहले एक पल रुकें · Take a moment before you decide
          </p>
        </div>

        {/* Huge Language Buttons */}
        <div className="space-y-4 pt-6 max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => handleSelect('hi')}
            className="w-full min-h-[64px] py-4 px-6 rounded-2xl bg-saffron text-navy font-black text-2xl hover:bg-[#e09430] active:scale-95 transition-all shadow-xl flex items-center justify-center space-x-2"
          >
            <span>हिन्दी</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelect('en')}
            className="w-full min-h-[64px] py-4 px-6 rounded-2xl bg-slate-800 border-2 border-slate-600 text-cream font-black text-2xl hover:border-saffron hover:bg-slate-700/80 active:scale-95 transition-all shadow-xl flex items-center justify-center space-x-2"
          >
            <span>English</span>
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 pb-2">
        भाषा बाद में भी बदली जा सकती है • Language can be changed anytime
      </div>
    </div>
  );
};
