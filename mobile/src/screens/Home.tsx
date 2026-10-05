import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Card, Screen, Title } from '../components/ui';
import { getRandomSnippet } from '../engine/snippets';
import { store } from '../storage';
import { colors, fonts, radius, spacing } from '../theme';

function greetingKey(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'home.greeting_morning';
  if (h >= 12 && h < 17) return 'home.greeting_afternoon';
  if (h >= 17 && h < 22) return 'home.greeting_evening';
  return 'home.greeting_night';
}

export function HomeScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const [pauses, setPauses] = useState(0);
  const [saved, setSaved] = useState(0);
  const [pending, setPending] = useState(false);
  const [thought] = useState(() => getRandomSnippet());

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const all = await store.decisions();
          const today = new Date().toDateString();
          const td = all.filter(d => new Date(d.ts).toDateString() === today);
          setPauses(td.length);
          setSaved(td.filter(d => d.outcome !== 'proceeded').length);
          setPending(all.some(d => !d.reflection && !d.feeling && Date.now() - d.ts > 6 * 3600 * 1000));
        } catch (_) {}
      })();
    }, [])
  );

  return (
    <Screen>
      <View style={st.hero}>
        <View style={st.greetPill}>
          <View style={st.dot} />
          <Text style={st.greet}>{t(greetingKey())}</Text>
        </View>
        <Title style={st.app}>{t('app_name')}</Title>
        <Text style={st.tag}>{t('app_tagline')}</Text>
      </View>

      <View style={st.diyaWrap}>
        <Pressable
          onPress={() => nav.navigate('Pause')}
          accessibilityRole="button"
          accessibilityLabel={t('home.pause_button')}
          style={({ pressed }) => [st.diya, pressed && st.diyaPressed]}
        >
          <Text style={st.diyaText}>{t('home.pause_button')}</Text>
          <Text style={st.diyaSub}>{t('home.tap_before_trading')}</Text>
        </Pressable>
      </View>

      <Card>
        <Text style={st.cardLabel}>🪔  {t('home.thought_for_today')}</Text>
        <Text style={st.thought}>“{t(`snippets.${thought.key}`)}”</Text>
        {thought.sourceKey ? <Text style={st.source}>— {t(`snippets.${thought.sourceKey}`)}</Text> : null}
      </Card>

      {pending ? (
        <Card style={st.alert}>
          <Text style={st.alertTitle}>{t('home.pending_reflection_title')}</Text>
          <Text style={st.alertBody}>{t('home.pending_reflection_desc')}</Text>
          <Pressable onPress={() => nav.navigate('Journal')} style={st.alertBtn}>
            <Text style={st.alertBtnText}>{t('home.review_now')}</Text>
          </Pressable>
        </Card>
      ) : null}

      <Card>
        <Text style={st.cardLabel}>{t('home.today_stats_title')}</Text>
        <View style={st.stats}>
          <View style={st.stat}>
            <Text style={st.statN}>{pauses}</Text>
            <Text style={st.statL}>{t('home.today_pauses')}</Text>
          </View>
          <View style={st.stat}>
            <Text style={[st.statN, { color: colors.green }]}>{saved}</Text>
            <Text style={st.statL}>{t('home.today_saved')}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={st.practiceTitle}>{t('home.try_practice_title')}</Text>
        <Text style={st.practiceDesc}>{t('home.try_practice_desc')}</Text>
        <Pressable onPress={() => nav.navigate('Practice')} style={st.practiceBtn}>
          <Text style={st.practiceBtnText}>{t('home.try_practice_btn')}</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: spacing.sm },
  greetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.abyss,
    borderWidth: 1,
    borderColor: colors.saffron + '55',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.saffron },
  greet: { color: colors.saffron, fontSize: 12, fontWeight: '700' },
  app: { fontSize: 46, marginTop: 6 },
  tag: { color: colors.muted, fontSize: 14, marginTop: 2 },
  diyaWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  diya: {
    width: 208,
    height: 208,
    borderRadius: 104,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: 'rgba(242,163,58,0.25)',
    shadowColor: colors.saffron,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  diyaPressed: { transform: [{ scale: 0.96 }] },
  diyaText: { fontFamily: fonts.display, fontSize: 38, fontWeight: '900', color: colors.night },
  diyaSub: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.night, opacity: 0.75, marginTop: 2 },
  cardLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: colors.saffron, textTransform: 'uppercase' },
  thought: { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 18, color: colors.cream, marginTop: 8, lineHeight: 26 },
  source: { color: colors.faint, fontSize: 12, marginTop: 6 },
  alert: { borderColor: colors.saffron, borderWidth: 1.5, backgroundColor: 'rgba(242,163,58,0.08)' },
  alertTitle: { color: colors.saffron, fontWeight: '800', fontSize: 16 },
  alertBody: { color: colors.cream, fontSize: 14, marginTop: 4, lineHeight: 20 },
  alertBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBtnText: { color: colors.night, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.abyss, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  statN: { fontSize: 26, fontWeight: '800', color: colors.cream },
  statL: { fontSize: 11, color: colors.muted, marginTop: 2, textAlign: 'center' },
  practiceTitle: { color: colors.cream, fontWeight: '800', fontSize: 15 },
  practiceDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  practiceBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceBtnText: { color: colors.night, fontWeight: '800', fontSize: 13 },
});
