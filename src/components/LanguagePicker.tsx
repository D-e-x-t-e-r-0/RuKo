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
    <div className="fixed inset-0 z-[100] bg-navy text-cream flex flex-col justify-between p-6 max-w-md mx-auto">
      <div className="my-auto text-center space-y-6">
        {/* App Logo & Title */}
        <div className="space-y-2">
          <div className="w-20 h-20 mx-auto rounded-full bg-saffron/20 border-4 border-saffron flex items-center justify-center text-saffron text-3xl font-black">
            रु
          </div>
          <h1 className="text-4xl font-black text-saffron tracking-tight font-sans">
            रुको · Ruko
          </h1>
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
