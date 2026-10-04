import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../db';
import type { Rule } from '../types';
import { BigButton } from '../components/BigButton';

export const Rules: React.FC = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<Rule[]>([]);
  const [newRuleText, setNewRuleText] = useState('');

  const loadRules = async () => {
    try {
      const all = await db.rules.toArray();
      setRules(all);
    } catch (_) {
      setRules([]);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleAddRule = async (textToAdd?: string) => {
    const text = (textToAdd || newRuleText).trim();
    if (!text) return;

    await db.rules.add({ text });
    if (!textToAdd) setNewRuleText('');
    await loadRules();
  };

  const handleDeleteRule = async (id?: number) => {
    if (!id) return;
    await db.rules.delete(id);
    await loadRules();
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-20 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-cream">
          {t('rules.title')}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          {t('rules.subtitle')}
        </p>
      </header>

      {/* Add New Rule Form */}
      <div className="space-y-3">
        <textarea
          rows={2}
          value={newRuleText}
          onChange={e => setNewRuleText(e.target.value)}
          placeholder={t('rules.add_placeholder')}
          className="w-full text-base p-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-cream focus:border-saffron focus:outline-none"
        />
        <BigButton
          onClick={() => handleAddRule()}
          disabled={!newRuleText.trim()}
        >
          {t('rules.btn_add')}
        </BigButton>
      </div>

      {/* Suggested Rules */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-3">
        <h2 className="text-xs uppercase font-bold text-saffron tracking-wider">
          {t('rules.suggestions_title')}
        </h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleAddRule(t('rules.rule_1'))}
            className="w-full min-h-[48px] text-left p-3 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-saffron text-sm text-slate-200 transition-colors"
          >
            + {t('rules.rule_1')}
          </button>
          <button
            type="button"
            onClick={() => handleAddRule(t('rules.rule_2'))}
            className="w-full min-h-[48px] text-left p-3 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-saffron text-sm text-slate-200 transition-colors"
          >
            + {t('rules.rule_2')}
          </button>
        </div>
      </div>

      {/* Existing Rules List */}
      <div className="space-y-3">
        <h2 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
          {rules.length} Rules Active
        </h2>
        {rules.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            {t('rules.no_rules')}
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => (
              <div
                key={rule.id}
                className="bg-slate-800/80 border-l-4 border-rukoGreen rounded-r-xl p-3.5 flex items-center justify-between space-x-3"
              >
                <p className="text-sm font-medium text-cream flex-1">
                  {rule.text}
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  aria-label="Delete rule"
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-rukoRed transition-colors text-base"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
