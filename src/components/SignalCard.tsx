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
    <div className="bg-slate-800/80 border-l-4 border-saffron rounded-r-xl p-4 text-cream shadow-sm flex items-start space-x-3">
      <div className="flex-1 text-base leading-relaxed font-medium">
        {getMessage()}
      </div>
    </div>
  );
};
