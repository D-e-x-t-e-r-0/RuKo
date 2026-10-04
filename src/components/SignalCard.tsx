import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Signal } from '../types';

interface SignalCardProps {
  signal: Signal;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal }) => {
  const { t } = useTranslation();

  const getMessage = () => {
    switch (signal.id) {
      case 'late_night':
        return t('signals.late_night', { hour: signal.params.hour });
      case 'many_trades_today':
        return t('signals.many_trades_today', { count: Number(signal.params.count) });
      case 'quick_reentry_after_loss':
        return t('signals.quick_reentry_after_loss', { minutes: signal.params.minutes });
      case 'size_escalation':
        return t('signals.size_escalation');
      case 'loss_streak':
        return t('signals.loss_streak');
      case 'risky_funding':
        return t('signals.risky_funding');
      default:
        return '';
    }
  };

  return (
    <div className="paper-card border border-saffron/25 border-l-4 border-l-saffron rounded-2xl p-4 text-cream shadow-card flex items-start space-x-3 rise">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-saffron text-base" aria-hidden="true">
        ◉
      </span>
      <div className="flex-1 text-[15px] leading-relaxed font-medium">
        {getMessage()}
      </div>
    </div>
  );
};
