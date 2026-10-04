import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BigButton, Card, Screen, Title } from '../components/ui';
import { getFallbackSummary } from '../lib/fallback';
import type { PracticeSession } from '../types';
import { store } from '../storage';
import { colors, radius, spacing } from '../theme';

export function DebriefScreen() {
  const { t, i18n } = useTranslation();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const id: number | undefined = route.params?.id;
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [note, setNote] = useState('');
  const [savedTick, setSavedTick] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const all = await store.sessions();
          const s = all.find(x => x.id === id) ?? null;
          setSession(s);
          setNote(s?.selfReflection ?? '');
        } catch (_) {}
      })();
    }, [id])
  );

  if (!session) {
    return (
      <Screen>
        <Title>{t('debrief.title')}</Title>
        <BigButton onPress={() => nav.navigate('Practice')}>{t('debrief.practice_again')}</BigButton>
      </Screen>
    );
  }

  const lang = i18n.language.startsWith('hi') ? 'hi' : 'en';
  const metrics: [string, string][] = [
    [t('debrief.final_pnl'), `${(session.finalPnl ?? 0) >= 0 ? '+' : '-'}₹${Math.abs(session.finalPnl ?? 0).toLocaleString('en-IN')}`],
    [t('debrief.max_drawdown'), `${session.maxDrawdownPercent ?? 0}%`],
    [t('debrief.trades_opened'), String(session.tradesOpened ?? 0)],
    [t('debrief.quick_reentry'), String(session.tradesAfterLoss ?? 0)],
    [t('debrief.size_change'), `${session.sizeIncreasePercent ?? 0}%`],
    [t('debrief.pauses_taken'), String(session.pausesTaken ?? 0)],
  ];

  const save = async () => {
    if (session.id == null) return;
    await store.updateSession(session.id, { selfReflection: note.trim() || undefined });
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 2000);
  };

  return (
    <Screen>
      <Title>{t('debrief.title')}</Title>
      <Text style={st.sc}>{t(`practice.scenarios.${session.scenario}_title`, session.scenario)}</Text>
      <View style={st.grid}>
        {metrics.map(([k, v]) => (
          <Card key={k} style={st.cell}>
            <Text style={st.k}>{k}</Text>
            <Text style={st.v}>{v}</Text>
          </Card>
        ))}
      </View>
      <Card>
        <Text style={st.h}>{t('debrief.ai_summary_title')}</Text>
        <Text style={st.body}>
          {getFallbackSummary(
            {
              pauses: session.pausesTaken ?? 0,
              abandoned: session.abandonedOrDelayed ?? 0,
              delayed: 0,
              proceeded: (session.tradesOpened ?? 0) - (session.abandonedOrDelayed ?? 0),
              impulsivePercent: 0,
              regretCount: 0,
              calmCount: 0,
              context: 'practice',
            },
            lang as 'hi' | 'en'
          )}
        </Text>
      </Card>
      <Card>
        <Text style={st.h}>{t('debrief.self_reflection_prompt')}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('debrief.self_reflection_placeholder')}
          placeholderTextColor={colors.faint}
          multiline
          style={st.input}
        />
        <Pressable onPress={save} style={st.save}>
          <Text style={st.saveTxt}>{savedTick ? t('debrief.note_saved') : t('debrief.save_note')}</Text>
        </Pressable>
      </Card>
      <Text style={st.disclaimer}>{t('debrief.closing_disclaimer')}</Text>
      <BigButton onPress={() => nav.navigate('Practice')}>{t('debrief.practice_again')}</BigButton>
      <BigButton variant="outline" onPress={() => nav.navigate('Home')}>
        {t('debrief.back_home')}
      </BigButton>
    </Screen>
  );
}

const st = StyleSheet.create({
  sc: { color: colors.saffron, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%', flexGrow: 1 },
  k: { color: colors.muted, fontSize: 11 },
  v: { color: colors.cream, fontWeight: '800', fontSize: 17, marginTop: 2 },
  h: { color: colors.saffron, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  body: { color: colors.cream, fontSize: 14, lineHeight: 20, marginTop: 8 },
  input: { backgroundColor: colors.abyss, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, color: colors.cream, padding: 12, minHeight: 88, textAlignVertical: 'top', marginTop: 8 },
  save: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.saffron, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  saveTxt: { color: colors.night, fontWeight: '800' },
  disclaimer: { color: colors.faint, fontStyle: 'italic', fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
