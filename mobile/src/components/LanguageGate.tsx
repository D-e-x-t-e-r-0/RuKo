import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, changeAppLanguage } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';
import { Screen } from './ui';

/** First-run language chooser — mirrors the web onboarding ritual. */
export function LanguageGate({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={st.hero}>
        <View style={st.emblem}>
          <Text style={st.glyph}>रु</Text>
        </View>
        <Text style={st.title}>
          रुको <Text style={{ color: colors.saffron }}>·</Text> Ruko
        </Text>
        <View style={st.rule} />
        <Text style={st.sub}>फ़ैसले से पहले एक पल रुकें · Take a moment before you decide</Text>
      </View>
      <View style={st.grid}>
        {LANGUAGES.map((l, i) => (
          <Pressable
            key={l.code}
            onPress={() => {
              changeAppLanguage(l.code).then(onDone).catch(onDone);
            }}
            accessibilityRole="button"
            style={[st.btn, i === 0 ? st.btnHot : st.btnCold]}
          >
            <Text style={[st.native, i === 0 && st.dark]}>{l.nativeName}</Text>
            <Text style={[st.name, i === 0 && st.darkDim]}>{l.name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={st.foot}>{t('settings.language')} · anytime</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: spacing.lg },
  emblem: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.saffron,
    backgroundColor: 'rgba(242,163,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { color: colors.saffron, fontSize: 36, fontWeight: '900' },
  title: { fontFamily: fonts.display, fontSize: 40, fontWeight: '900', color: colors.cream, marginTop: 10 },
  rule: { width: 180, height: 1, backgroundColor: colors.saffron + '88', marginVertical: 10 },
  sub: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.md },
  btn: { width: '48%', flexGrow: 1, minHeight: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', padding: 10 },
  btnHot: { backgroundColor: colors.saffron },
  btnCold: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  native: { color: colors.cream, fontSize: 17, fontWeight: '800' },
  name: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  dark: { color: colors.night },
  darkDim: { color: colors.night, opacity: 0.65 },
  foot: { color: colors.faint, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
