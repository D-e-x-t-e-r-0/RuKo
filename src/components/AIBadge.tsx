import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AIBadgeProps {
  isAI: boolean;
  className?: string;
}

export const AIBadge: React.FC<AIBadgeProps> = ({ isAI, className = '' }) => {
  const { t } = useTranslation();
  const [showExplanation, setShowExplanation] = useState(false);

  if (!isAI) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider select-none ${className}`}
      >
        {t('ai_badge.rule_based')}
      </span>
    );
  }

  return (
    <div className={`inline-block ${className}`}>
      <div className="flex items-center space-x-1.5">
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-violet-100 border border-violet-300 text-violet-800 text-[10px] font-black uppercase tracking-wider shadow-sm select-none">
          <span>✨</span>
          <span>AI</span>
        </span>
        <button
          type="button"
          onClick={() => setShowExplanation(prev => !prev)}
          className="text-[11px] text-slate-500 hover:text-clay underline cursor-pointer"
        >
          {t('ai_badge.why_seeing')}
        </button>
      </div>

      {showExplanation && (
        <div className="mt-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed shadow-sm">
          {t('ai_badge.explanation')}
        </div>
      )}
    </div>
  );
};
