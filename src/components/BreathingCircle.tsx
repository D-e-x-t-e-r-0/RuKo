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
            box-shadow: 0 0 20px rgba(43, 179, 163, 0.3);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 0 45px rgba(43, 179, 163, 0.7);
          }
        }
        .breathing-pulse {
          animation: breathScale 8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .breathing-pulse {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>
      <div
        className="breathing-pulse w-44 h-44 rounded-full border-4 border-rukoGreen/60 bg-rukoGreen/20 flex flex-col items-center justify-center text-center p-4 transition-all"
        aria-label={breatheIn ? t('pause.breathe_in') : t('pause.breathe_out')}
      >
        <span className="text-xl font-bold tracking-wide text-cream">
          {breatheIn ? t('pause.breathe_in') : t('pause.breathe_out')}
        </span>
        <span className="text-xs text-slate-300 mt-1">
          {breatheIn ? '4s' : '4s'}
        </span>
      </div>
    </div>
  );
};
