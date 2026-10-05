import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Card, Screen, Title } from '../components/ui';
import { store } from '../storage';
import { colors, radius, spacing } from '../theme';

interface Day { label: string; planned: number; impulsive: number }

const BAR_W = 22;
const GAP = 10;
const MAX_H = 110;

function Bars({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map(d => d.planned + d.impulsive));
  const W = days.length * (BAR_W + GAP);
  const H = MAX_H + 22;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {days.map((d, i) => {
        const ph = (d.planned / max) * MAX_H;
        const ih = (d.impulsive / max) * MAX_H;
        const x = i * (BAR_W + GAP);
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={MAX_H - ph} width={BAR_W} height={ph} rx={3} fill={colors.green} />
            <Rect x={x} y={MAX_H - ph - ih} width={BAR_W} height={ih} rx={3} fill={colors.red} />
            <SvgText x={x + BAR_W / 2} y={H - 6} fontSize={10} fill={colors.muted} textAnchor="middle">
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export function MirrorScreen() {
  const { t } = useTranslation();
  const [days, setDays] = useState<Day[]>([]);
  const [pauses, setPauses] = useState(0);
  const [saved, setSaved] = useState(0);
  const [impPct, setImpPct] = useState(0);
  const [loanHeavy, setLoanHeavy] = useState(false);
  const [cmp, setCmp] = useState<{ on: string; onLoss: string; off: string; offLoss: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const all = (await store.decisions()).filter(d => d.mode !== 'practice');
          const now = new Date();
          const arr: Day[] = [];
          for (let i = 6; i >= 0; i--) {
            const day = new Date(now);
            day.setDate(now.getDate() - i);
            const ds = day.toDateString();
            const dd = all.filter(d => new Date(d.ts).toDateString() === ds);
            let p = 0;
            let im = 0;
            for (const d of dd) {
              if ((d.level === 'calm' || d.level === 'caution') && d.horizon !== 'today') p++;
              else im++;
            }
            arr.push({ label: day.toLocaleDateString(undefined, { weekday: 'narrow' }), planned: p, impulsive: im });
          }
          setDays(arr);
          const week = all.filter(d => Date.now() - d.ts < 7 * 86400000);
          setPauses(week.length);
          setSaved(week.filter(d => d.outcome !== 'proceeded').length);
          const imp = week.filter(d => !((d.level === 'calm' || d.level === 'caution') && d.horizon !== 'today')).length;
          setImpPct(week.length ? Math.round((imp / week.length) * 100) : 0);
          setLoanHeavy(week.filter(d => d.funding === 'loan').length >= 3);
          const sessions = (await store.sessions()).filter(s => s.endedAt || (s.tradesOpened ?? 0) > 0);
          if (sessions.length) {
            const on = sessions.filter(s => s.pauseEnabled);
            const off = sessions.filter(s => !s.pauseEnabled);
            const avg = (ss: typeof sessions) => (ss.length ? (ss.reduce((a, s) => a + (s.tradesOpened ?? 0), 0) / ss.length).toFixed(1) : '0');
            const loss = (ss: typeof sessions) => {
              const t = ss.reduce((a, s) => a + (s.tradesOpened ?? 0), 0);
              const l = ss.reduce((a, s) => a + (s.tradesAfterLoss ?? 0), 0);
              return t ? `${Math.round((l / t) * 100)}%` : '0%';
            };
            setCmp({ on: avg(on), onLoss: loss(on), off: avg(off), offLoss: loss(off) });
          }
        } catch (_) {}
      })();
    }, [])
  );

  if (!pauses) {
    return (
      <Screen>
        <Title>{t('mirror.title')}</Title>
        <Card style={st.empty}>
          <Text style={st.emoji}>🪞</Text>
          <Text style={st.emptyH}>{t('mirror.empty_title')}</Text>
          <Text style={st.emptyD}>{t('mirror.empty_desc')}</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t('mirror.title')}</Title>
      <Text style={st.sub}>{t('mirror.subtitle')}</Text>
      <Card>
        <Bars days={days} />
        <View style={st.legend}>
          <Text style={[st.leg, { color: colors.greenInk }]}>● {t('mirror.planned')}</Text>
          <Text style={[st.leg, { color: colors.red }]}>● {t('mirror.impulsive')}</Text>
        </View>
      </Card>
      <View style={st.stats}>
        <Card style={st.stat}>
          <Text style={st.n}>{pauses}</Text>
          <Text style={st.l}>{t('mirror.stat_pauses')}</Text>
        </Card>
        <Card style={st.stat}>
          <Text style={[st.n, { color: colors.greenInk }]}>{saved}</Text>
          <Text style={st.l}>{t('mirror.stat_saved')}</Text>
        </Card>
        <Card style={st.stat}>
          <Text style={[st.n, { color: colors.red }]}>{impPct}%</Text>
          <Text style={st.l}>{t('mirror.stat_impulsive')}</Text>
        </Card>
      </View>
      {loanHeavy ? (
        <Card style={st.support}>
          <Text style={st.supH}>ℹ {t('mirror.notice')}</Text>
          <Text style={st.supB}>{t('mirror.support_card')}</Text>
        </Card>
      ) : null}
      {cmp ? (
        <Card>
          <Text style={st.cmpH}>{t('mirror.practice_comparison_title')}</Text>
          <View style={st.cmpRow}>
            <Text style={[st.cmpCell, { color: colors.greenInk }]}>{t('mirror.comparison_pause_on')}</Text>
            <Text style={st.cmpCell}>{t('mirror.avg_trades')}: {cmp.on}</Text>
            <Text style={st.cmpCell}>{t('mirror.loss_chasing_share')}: {cmp.onLoss}</Text>
          </View>
          <View style={st.cmpRow}>
            <Text style={[st.cmpCell, { color: colors.red }]}>{t('mirror.comparison_pause_off')}</Text>
            <Text style={st.cmpCell}>{t('mirror.avg_trades')}: {cmp.off}</Text>
            <Text style={st.cmpCell}>{t('mirror.loss_chasing_share')}: {cmp.offLoss}</Text>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  legend: { flexDirection: 'row', gap: spacing.md, marginTop: 8 },
  leg: { fontSize: 12, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  n: { fontSize: 24, fontWeight: '800', color: colors.cream },
  l: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emoji: { fontSize: 44 },
  emptyH: { color: colors.cream, fontWeight: '800', fontSize: 16, marginTop: 8 },
  emptyD: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 4 },
  support: { borderColor: colors.saffron, borderWidth: 1.5 },
  supH: { color: colors.clay, fontWeight: '800', fontSize: 12 },
  supB: { color: colors.cream, fontSize: 13, lineHeight: 19, marginTop: 6 },
  cmpH: { color: colors.clay, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  cmpRow: { marginTop: 8, gap: 2, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  cmpCell: { color: colors.cream, fontSize: 12 },
});
