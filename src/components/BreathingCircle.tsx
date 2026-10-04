import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const BreathingCircle: React.FC = () => {
  const { t } = useTranslation();
  const [breatheIn, setBreatheIn] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setBreatheIn(prev => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center my-6">
      <style>{`
        @keyframes breathScale {
          0%, 100% {
            transform: scale(0.85);
            box-shadow: 0 0 20px rgba(43, 179, 163, 0.3), 0 0 60px rgba(242, 163, 58, 0.12);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 0 45px rgba(43, 179, 163, 0.7), 0 0 90px rgba(242, 163, 58, 0.25);
          }
        }
        @keyframes ringDrift {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.12); opacity: 0.15; }
        }
        .breathing-pulse {
          animation: breathScale 8s ease-in-out infinite;
        }
        .breath-ring {
          animation: ringDrift 8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .breathing-pulse, .breath-ring {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
      <div className="relative flex items-center justify-center" role="img" aria-label={breatheIn ? t('pause.breathe_in') : t('pause.breathe_out')}>
        <div className="breath-ring absolute w-52 h-52 rounded-full border border-saffron/30" aria-hidden="true" />
        <div className="breath-ring absolute w-64 h-64 rounded-full border border-rukoGreen/20" aria-hidden="true" style={{ animationDelay: '-4s' }} />
        <div
          className="breathing-pulse relative w-44 h-44 rounded-full border-4 border-rukoGreen/60 bg-gradient-to-b from-rukoGreen/25 to-navy flex flex-col items-center justify-center text-center p-4 transition-all"
        >
          <span className="font-ritual text-2xl font-bold tracking-wide text-cream">
            {breatheIn ? t('pause.breathe_in') : t('pause.breathe_out')}
          </span>
          <span className="text-xs text-slate-300 mt-1 font-sans" aria-hidden="true">
            {breatheIn ? '··· in ···' : '··· out ···'}
          </span>
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-400 max-w-[240px] text-center leading-relaxed">
        {t('pause.body_card_text')}
      </p>
    </div>
  );
};
