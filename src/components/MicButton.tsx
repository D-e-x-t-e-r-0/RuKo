import React, { useState } from 'react';
import { canListen, listen } from '../voice/voice';
import { useTranslation } from 'react-i18next';

interface MicButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export const MicButton: React.FC<MicButtonProps> = ({ onTranscript, className = '' }) => {
  const { i18n } = useTranslation();
  const [listening, setListening] = useState(false);

  if (!canListen()) {
    return null;
  }

  const handleListen = async () => {
    if (listening) return;
    setListening(true);
    try {
      const lang = i18n.language.startsWith('hi') ? 'hi-IN' : 'en-IN';
      const text = await listen(lang);
      if (text) {
        onTranscript(text);
      }
    } catch (err) {
      console.warn('Listening failed:', err);
    } finally {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleListen}
      disabled={listening}
      title={listening ? 'सुन रहे हैं... (Listening...)' : 'बोलकर लिखें (Voice input)'}
      aria-label="Voice input"
      className={`min-h-[48px] min-w-[48px] p-2.5 rounded-full flex items-center justify-center transition-all ${
        listening
          ? 'bg-rukoRed text-cream animate-pulse'
          : 'bg-slate-700/80 text-saffron hover:bg-slate-700 active:bg-slate-600'
      } ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-6 h-6"
      >
        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
      </svg>
    </button>
  );
};
