import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Card, Chip, LevelPill, Screen, Title } from '../components/ui';
import type { Decision, PracticeSession } from '../types';
import { store } from '../storage';
import { colors, radius, spacing } from '../theme';

export function JournalScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const [filter, setFilter] = useState<'real' | 'practice'>('real');
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [feelings, setFeelings] = useState<Record<number, 'calm' | 'regret' | 'unsure'>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const d = await store.decisions();
          d.sort((a, b) => b.ts - a.ts);
          setDecisions(d);
          const s = await store.sessions();
          s.sort((a, b) => b.startedAt - a.startedAt);
          setSessions(s);
        } catch (_) {}
      })();
    }, [])
  );

  const shown = decisions.filter(d => (filter === 'practice' ? d.mode === 'practice' : d.mode !== 'practice'));

  const saveReflection = async (id: number) => {
    const feeling = feelings[id];
    const text = (notes[id] || '').trim();
    if (!feeling && !text) return;
    await store.updateDecision(id, { feeling: feeling || 'unsure', reflection: text || undefined });
    const d = await store.decisions();
    d.sort((a, b) => b.ts - a.ts);
    setDecisions(d);
  };

  return (
    <Screen>
      <Title>{t('journal.title')}</Title>
      <View style={st.row}>
        <Chip label={t('journal.filter_real')} selected={filter === 'real'} onPress={() => setFilter('real')} />
        <Chip label={t('journal.filter_practice')} selected={filter === 'practice'} onPress={() => setFilter('practice')} />
      </View>

      {filter === 'practice' && sessions.length > 0
        ? sessions.map(s => {
            const pnlv = s.finalPnl ?? 0;
            return (
              <Card key={s.id}>
                <View style={st.sHead}>
                  <Text style={st.sName}>{t(`practice.scenarios.${s.scenario}_title`, s.scenario)}</Text>
                  <Text style={st.sDate}>{new Date(s.startedAt).toLocaleDateString()}</Text>
                </View>
                <View style={st.sGrid}>
                  <View>
                    <Text style={st.k}>P&L</Text>
                    <Text style={st.mono}>
                      {pnlv >= 0 ? '+' : '-'}₹{Math.abs(pnlv).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View>
                    <Text style={st.k}>{t('debrief.max_drawdown')}</Text>
                    <Text style={st.mono}>{s.maxDrawdownPercent ?? 0}%</Text>
                  </View>
                  <View>
                    <Text style={st.k}>{t('journal.pauses_label')}</Text>
                    <Text style={st.mono}>{s.pausesTaken ?? 0}</Text>
                  </View>
                </View>
                <Pressable onPress={() => nav.navigate('Debrief' as never, { id: s.id } as never)} style={st.link}>
                  <Text style={st.linkTxt}>{t('journal.view_debrief')}</Text>
                </Pressable>
              </Card>
            );
          })
        : null}

      {shown.length === 0 ? (
        <Card style={st.empty}>
          <Text style={st.emptyT}>📖</Text>
          <Text style={st.emptyH}>{t('journal.empty_title')}</Text>
          <Text style={st.emptyD}>{t('journal.empty_desc')}</Text>
        </Card>
      ) : (
        shown.map(d => (
          <Card key={d.id}>
            <View style={st.dHead}>
              <Text style={st.dDate}>
                {new Date(d.ts).toLocaleDateString()} · {new Date(d.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <LevelPill level={d.level} label={t(`levels.${d.level}`)} />
            </View>
            <Text style={st.why}>“{d.why}”</Text>
            <View style={st.dFoot}>
              <Text style={st.outcome}>
                {t('journal.outcome_label')}: {t(`journal.outcome_${d.outcome}`)}
              </Text>
              <Text style={st.mono}>₹{d.amount.toLocaleString('en-IN')}</Text>
            </View>
            <Pressable
              onPress={() => setExpanded(e => ({ ...e, [d.id!]: !e[d.id!] }))}
              style={st.expand}
              accessibilityRole="button"
              accessibilityState={{ expanded: !!expanded[d.id!] }}
            >
              <Text style={st.expandTxt}>
                {t('journal.details')} {expanded[d.id!] ? '▲' : '▼'}
              </Text>
            </Pressable>
            {expanded[d.id!] ? (
              <View style={st.detail}>
                <Text style={st.detailTxt}>
                  {t('journal.max_loss_label')} ₹{d.maxLoss.toLocaleString('en-IN')}
                </Text>
                <Text style={st.detailTxt}>
                  {t('journal.signals_label')}{' '}
                  {d.firedSignals.length ? d.firedSignals.map(s => t(`signal_names.${s}`, s)).join(', ') : t('journal.none')}
                </Text>
                {d.reflection || d.feeling ? (
                  <Text style={st.detailTxt}>
                    {t('journal.reflection_label')} {d.feeling ? t(`journal.feel_${d.feeling}`) + ' · ' : ''}
                    {d.reflection ?? ''}
                  </Text>
                ) : null}
                {!d.reflection && !d.feeling && Date.now() - d.ts > 6 * 3600 * 1000 ? (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <Text style={st.detailTxt}>{t('journal.morning_prompt')}</Text>
                    <View style={st.row}>
                      {(['calm', 'regret', 'unsure'] as const).map(f => (
                        <Chip key={f} label={t(`journal.feel_${f}`)} selected={feelings[d.id!] === f} onPress={() => setFeelings(x => ({ ...x, [d.id!]: f }))} />
                      ))}
                    </View>
                    <TextInput
                      value={notes[d.id!] ?? ''}
                      onChangeText={v => setNotes(x => ({ ...x, [d.id!]: v }))}
                      placeholder={t('journal.reflection_placeholder')}
                      placeholderTextColor={colors.faint}
                      style={st.input}
                    />
                    <Pressable onPress={() => saveReflection(d.id!)} style={st.save}>
                      <Text style={st.saveTxt}>{t('journal.save_reflection')}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyT: { fontSize: 40 },
  emptyH: { color: colors.cream, fontWeight: '800', fontSize: 16, marginTop: 8 },
  emptyD: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 4 },
  sHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sName: { color: colors.cream, fontWeight: '800', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  sDate: { color: colors.muted, fontSize: 12 },
  sGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  k: { color: colors.muted, fontSize: 10 },
  mono: { color: colors.cream, fontWeight: '800', fontFamily: 'Courier' },
  link: { minHeight: 48, justifyContent: 'center' },
  linkTxt: { color: colors.clay, fontWeight: '800', fontSize: 13 },
  dHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  dDate: { color: colors.muted, fontSize: 12 },
  why: { color: colors.cream, fontSize: 16, fontWeight: '700', marginTop: 8, lineHeight: 22 },
  dFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  outcome: { color: colors.muted, fontSize: 12 },
  expand: { minHeight: 48, justifyContent: 'center' },
  expandTxt: { color: colors.clay, fontWeight: '700', fontSize: 13 },
  detail: { backgroundColor: colors.abyss, borderRadius: radius.md, padding: 10, marginTop: 4, gap: 6 },
  detailTxt: { color: '#CBD5E1', fontSize: 12, lineHeight: 17 },
  input: { backgroundColor: colors.night, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, color: colors.cream, padding: 10, minHeight: 48 },
  save: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.saffron, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: colors.navy, fontWeight: '800' },
});
