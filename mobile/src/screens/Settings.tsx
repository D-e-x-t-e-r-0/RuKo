import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BigButton, Card, Screen, Title } from '../components/ui';
import { LANGUAGES, changeAppLanguage, normalizeLang } from '../i18n';
import { getVoiceMode, setVoiceMode } from '../voice';
import { seedDemo, store } from '../storage';
import { colors, radius } from '../theme';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [msg, setMsg] = useState<string | null>(null);
  const [voice, setVoice] = useState<'auto' | 'sarvam' | 'device'>('auto');
  const current = normalizeLang(i18n.language);

  React.useEffect(() => {
    getVoiceMode().then(setVoice).catch(() => {});
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <Screen>
      <Title>{t('settings.title')}</Title>
      {msg ? (
        <View style={st.flash}>
          <Text style={st.flashTxt}>{msg}</Text>
        </View>
      ) : null}

      <Card>
        <Text style={st.h}>{t('settings.language')}</Text>
        <View style={st.grid}>
          {LANGUAGES.map(l => (
            <BigButton
              key={l.code}
              variant={current === l.code ? 'primary' : 'outline'}
              onPress={() => changeAppLanguage(l.code)}
            >
              {`${l.nativeName} · ${l.name}`}
            </BigButton>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={st.h}>{t('settings.voice_title')}</Text>
        <Text style={st.d}>{t('settings.voice_desc')}</Text>
        <View style={st.grid}>
          {(
            [
              ['auto', t('settings.voice_auto')],
              ['sarvam', t('settings.voice_sarvam')],
              ['device', t('settings.voice_device')],
            ] as const
          ).map(([m, label]) => (
            <BigButton
              key={m}
              variant={voice === m ? 'primary' : 'outline'}
              onPress={() => {
                setVoiceMode(m).then(() => setVoice(m)).catch(() => {});
              }}
            >
              {label}
            </BigButton>
          ))}
        </View>
      </Card>

      <BigButton
        variant="secondary"
        onPress={() => seedDemo().then(() => flash(t('settings.demo_loaded'))).catch(() => {})}
      >
        {t('settings.demo_data')}
      </BigButton>
      <BigButton
        variant="danger"
        onPress={() =>
          Alert.alert(t('settings.delete_data'), t('settings.delete_confirm'), [
            { text: t('pause.chip_no'), style: 'cancel' },
            {
              text: t('pause.chip_yes'),
              style: 'destructive',
              onPress: () => store.clearAll().then(() => flash(t('settings.data_cleared'))).catch(() => {}),
            },
          ])
        }
      >
        {t('settings.delete_data')}
      </BigButton>
      <Text style={st.privacy}>🔒 {t('settings.privacy_note')}</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  flash: { backgroundColor: 'rgba(43,179,163,0.16)', borderWidth: 1, borderColor: colors.green, borderRadius: radius.md, padding: 12 },
  flashTxt: { color: colors.cream, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  h: { color: colors.clay, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 },
  d: { color: colors.muted, fontSize: 12, marginBottom: 10 },
  grid: { gap: 8 },
  privacy: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
