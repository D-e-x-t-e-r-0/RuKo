import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { db } from '../db';
import type { Trade, Funding } from '../types';
import { BigButton } from '../components/BigButton';
import { parseCsvContent } from '../workers/csvWorker';

export const Trades: React.FC = () => {
  const { t } = useTranslation();

  // Quick Log State
  const [amount, setAmount] = useState('');
  const [funding, setFunding] = useState<Funding>('savings');
  const [pnl, setPnl] = useState('');

  // Trades and status
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadTrades = async () => {
    const all = await db.trades.toArray();
    all.sort((a, b) => b.ts - a.ts);
    setRecentTrades(all.slice(0, 20));
  };

  useEffect(() => {
    loadTrades();
  }, []);

  const handleSaveTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    let parsedPnl: number | null = null;
    if (pnl.trim() !== '') {
      const val = Number(pnl);
      if (!isNaN(val)) {
        parsedPnl = val;
      }
    }

    await db.trades.add({
      ts: Date.now(),
      amount: parsedAmount,
      pnl: parsedPnl,
      funding,
    });

    setAmount('');
    setPnl('');
    await loadTrades();
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportMessage(null);

    try {
      const text = await file.text();

      // Attempt parsing via Web Worker
      let trades: Trade[] = [];
      try {
        const worker = new Worker(new URL('../workers/csvWorker.ts', import.meta.url), {
          type: 'module',
        });

        trades = await new Promise<Trade[]>((resolve, reject) => {
          worker.onmessage = (event) => {
            if (event.data.success) {
              resolve(event.data.trades);
            } else {
              reject(new Error(event.data.error));
            }
            worker.terminate();
          };
          worker.onerror = (err) => {
            worker.terminate();
            reject(err);
          };
          worker.postMessage({ text });
        });
      } catch (workerErr) {
        console.warn('Worker fallback to direct parse:', workerErr);
        trades = parseCsvContent(text);
      }

      if (trades.length > 0) {
        await db.trades.bulkAdd(trades);
      }

      setImportMessage(t('trades.csv_imported', { n: trades.length }));
      await loadTrades();
    } catch (err: any) {
      console.error('CSV import failed:', err);
      setImportMessage('CSV parsing failed. Please check the file format.');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleDeleteAllTrades = async () => {
    if (window.confirm(t('trades.delete_confirm'))) {
      await db.trades.clear();
      setImportMessage(null);
      await loadTrades();
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-20 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-cream">
          {t('trades.title')}
        </h1>
      </header>

      {/* Quick Log in 3 Taps */}
      <section className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-4">
        <h2 className="text-sm uppercase font-bold text-saffron tracking-wider">
          {t('trades.quick_log_title')}
        </h2>

        <form onSubmit={handleSaveTrade} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('trades.amount_label')}
            </label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder={t('trades.amount_placeholder')}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full text-lg min-h-[48px] p-3 rounded-xl bg-slate-900 border border-slate-700 text-cream focus:border-saffron focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('trades.funding_label')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFunding('savings')}
                className={`min-h-[48px] py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  funding === 'savings'
                    ? 'bg-saffron text-navy'
                    : 'bg-slate-900 text-slate-300 border border-slate-700'
                }`}
              >
                {t('pause.funding_savings')}
              </button>
              <button
                type="button"
                onClick={() => setFunding('emergency')}
                className={`min-h-[48px] py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  funding === 'emergency'
                    ? 'bg-saffron text-navy'
                    : 'bg-slate-900 text-slate-300 border border-slate-700'
                }`}
              >
                {t('pause.funding_emergency')}
              </button>
              <button
                type="button"
                onClick={() => setFunding('loan')}
                className={`min-h-[48px] py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                  funding === 'loan'
                    ? 'bg-saffron text-navy'
                    : 'bg-slate-900 text-slate-300 border border-slate-700'
                }`}
              >
                {t('pause.funding_loan')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('trades.pnl_label')}
            </label>
            <input
              type="number"
              placeholder={t('trades.pnl_placeholder')}
              value={pnl}
              onChange={e => setPnl(e.target.value)}
              className="w-full text-base min-h-[48px] p-3 rounded-xl bg-slate-900 border border-slate-700 text-cream focus:border-saffron focus:outline-none"
            />
          </div>

          <BigButton type="submit" disabled={!amount.trim() || Number(amount) <= 0}>
            {t('trades.save_trade')}
          </BigButton>
        </form>
      </section>

      {/* CSV Import */}
      <section className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm uppercase font-bold text-saffron tracking-wider">
          {t('trades.csv_title')}
        </h2>
        <p className="text-xs text-slate-400">
          {t('trades.csv_note')}
        </p>

        <label className="block cursor-pointer">
          <span className="sr-only">{t('trades.choose_csv_sr')}</span>
          <div className="min-h-[48px] w-full border-2 border-dashed border-slate-600 hover:border-saffron rounded-xl p-3 text-center text-sm font-semibold text-cream flex items-center justify-center bg-slate-900/60 transition-colors">
            {isProcessing ? t('trades.processing_csv') : t('trades.select_csv')}
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvFileChange}
            disabled={isProcessing}
            className="hidden"
          />
        </label>

        {importMessage && (
          <div className="p-3 bg-rukoGreen/20 border border-rukoGreen/60 rounded-xl text-xs font-medium text-cream">
            {importMessage}
          </div>
        )}
      </section>

      {/* Recent Trades List */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm uppercase font-bold text-slate-400 tracking-wider">
            {t('trades.recent_trades')}
          </h2>
          {recentTrades.length > 0 && (
            <button
              onClick={handleDeleteAllTrades}
              className="text-xs text-rukoRed hover:underline font-semibold"
            >
              {t('trades.delete_all')}
            </button>
          )}
        </div>

        {recentTrades.length === 0 ? (
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 text-center space-y-3 shadow-md">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-700/60 flex items-center justify-center text-saffron text-2xl">
              📊
            </div>
            <h3 className="text-base font-bold text-cream">
              {t('trades.empty_title')}
            </h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              {t('trades.empty_desc')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade, idx) => (
              <div
                key={trade.id || idx}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-cream text-sm font-mono">
                    ₹{trade.amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    {format(new Date(trade.ts), 'dd MMM, HH:mm')} •{' '}
                    <span className="capitalize">{trade.funding}</span>
                  </div>
                </div>

                <div className="text-right">
                  {trade.pnl === null ? (
                    <span className="px-2 py-1 bg-slate-700/60 text-slate-300 rounded font-medium text-[11px]">
                      {t('trades.open')}
                    </span>
                  ) : trade.pnl >= 0 ? (
                    <span className="font-bold text-rukoGreen font-mono text-sm">
                      +₹{trade.pnl.toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="font-bold text-rukoRed font-mono text-sm">
                      -₹{Math.abs(trade.pnl).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
