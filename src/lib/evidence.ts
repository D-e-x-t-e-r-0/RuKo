import { redactForExport } from './vault';
import type { Decision } from '../types';

// Evidence pack — what the user can show a friend/counsellor, or what judges
// inspect to verify "real engine, not README claims". Contains only mirror-safe
// fields: counts, signal IDs, friction seconds, choices. No amounts, no why text
// verbatim unless user opts in.

export interface EvidencePack {
  generatedAt: string;
  pauses: number;
  abandoned: number;
  delayed: number;
  proceeded: number;
  signalsSeen: Record<string, number>;
  decisions: Array<Record<string, any>>;
}

export function buildEvidencePack(decisions: Decision[], opts: { includeWhy?: boolean } = {}): EvidencePack {
  const signalsSeen: Record<string, number> = {};
  const rows = decisions.map((d: any) => {
    for (const s of d.signals ?? []) signalsSeen[s] = (signalsSeen[s] ?? 0) + 1;
    const base = redactForExport({ ...d });
    if (!opts.includeWhy) delete (base as any).why;
    return base;
  });
  const count = (v: string) => decisions.filter((d: any) => d.choice === v).length;
  return {
    generatedAt: new Date().toISOString(),
    pauses: decisions.length,
    abandoned: count('abandon'),
    delayed: count('wait'),
    proceeded: count('proceed'),
    signalsSeen,
    decisions: rows,
  };
}

export function evidencePackText(p: EvidencePack): string {
  const lines = [
    `Ruko evidence pack — ${p.generatedAt}`,
    `Pauses: ${p.pauses} (abandon ${p.abandoned}, wait ${p.delayed}, proceed ${p.proceeded})`,
    `Signals: ${Object.entries(p.signalsSeen).map(([k, v]) => `${k}x${v}`).join(', ') || 'none'}`,
    `Privacy: amounts/funding/why excluded by default. This pack proves pauses happened.`,
  ];
  return lines.join('\n');
}
