import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BigButton, Card, Chip, LevelPill, Screen, Title } from '../components/ui';
import { evaluateSignals, type LastTradeHint } from '../engine/signals';
import { levelFor } from '../engine/pressure';
import { getFallbackQuestion, getFallbackTriggers } from '../lib/fallback';
import type { Funding, Horizon, Level, Outcome, Signal } from '../types';
import { store } from '../storage';
import { listen, speak } from '../voice';
import { colors, fonts, radius, spacing } from '../theme';
import { getSpeechCode } from '../i18n';

type Props = { mode?: 'real' | 'practice'; amount?: number; funding?: Funding; sessionId?: number; onDone?: (o: Outcome) => void };

const AMOUNTS = [500, 1000, 5000];

/** Dynamic-key translation helper (i18next strict key types). */
function tx(t: (k: string, o?: object) => string, key: string, opts?: string | object): string {
  return t(key, opts as object);
}

export function PauseScreen(embedded?: Props) {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: string | object): string => tx(tr as (k: string, o?: object) => string, k, o);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const p: Props = { ...(route.params ?? {}), ...(embedded ?? {}) };
  const mode = p.mode ?? 'real';

  const [screen, setScreen] = useState(mode === 'practice' ? 2 : 1);
  const [amount, setAmount] = useState(p.amount ? String(p.amount) : '1000');
  const [custom, setCustom] = useState(p.amount ? String(p.amount) : '');
  const [useCustom, setUseCustom] = useState(!!p.amount);
  const [funding, setFunding] = useState<Funding>(p.funding ?? 'savings');
  const [lastResult, setLastResult] = useState<'loss' | 'profit' | 'none'>('none');
  const [lastWhen, setLastWhen] = useState<'now' | '30m' | 'hrs'>('now');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [level, setLevel] = useState<Level>('calm');
  const [why, setWhy] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('today');
  const [maxLoss, setMaxLoss] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cardIdx, setCardIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [spokenNote, setSpokenNote] = useState(false);

  const effAmount = useCustom ? Number(custom) || 0 : Number(amount) || 0;

  const evaluate = async () => {
    const now = Date.now();
    let hint: LastTradeHint | undefined;
    if (lastResult !== 'none') {
      hint = { result: lastResult, minutesAgo: lastWhen === 'now' ? 2 : lastWhen === '30m' ? 30 : 120 };
    }
    let past: { ts: number; amount: number; pnl: number | null; funding: Funding }[] = [];
    if (mode === 'practice') {
      const all = await store.practiceTrades();
      past = (p.sessionId ? all.filter(x => x.sessionId === p.sessionId) : all).map(x => ({
        ts: x.ts,
        amount: x.amount,
        pnl: x.pnl,
        funding: x.funding,
      }));
    } else {
      past = await store.trades();
    }
    const sigs = evaluateSignals(past as never, { ts: now, amount: effAmount, funding, lastTradeHint: hint });
    setSignals(sigs);
    setLevel(levelFor(sigs));
    setScreen(2);
  };

  const lang = i18n.language;
  const fired = useMemo(() => signals.filter(s => s.fired), [signals]);

  const cards = useMemo(() => {
    const list: { id: string; title: string; kind: 'breath' | 'why' | 'horizon' | 'loss' | 'signal' | 'general' | 'body' | 'ai'; text: string }[] = [
      { id: 'breath', title: t('pause.breathe_in'), kind: 'breath', text: t('pause.breathe_in') },
    ];
    for (const s of fired) {
      const key = s.id === 'late_night' ? { hour: String(s.params.hour) } : s.id === 'many_trades_today' ? { count: Number(s.params.count) } : s.id === 'quick_reentry_after_loss' ? { minutes: Number(s.params.minutes) } : {};
      list.push({ id: `sig-${s.id}`, title: t(`signal_names.${s.id}`, s.id), kind: 'signal', text: t(`signals.${s.id}`, key) });
    }
    const fb = getFallbackQuestion(
      fired.map(s => s.id),
      lang.startsWith('hi') ? 'hi' : 'en'
    );
    if (fb) list.push({ id: 'fbq', title: '✦', kind: 'ai', text: fb });
    list.push(
      { id: 'why', title: t('pause.why_card_title'), kind: 'why', text: t('pause.why_card_title') },
      { id: 'horizon', title: t('pause.q_horizon'), kind: 'horizon', text: t('pause.q_horizon') },
      { id: 'loss', title: t('pause.max_loss_title'), kind: 'loss', text: t('pause.q_loss') },
      { id: 'body', title: '🫁', kind: 'body', text: t('pause.body_card_text') }
    );
    return list;
  }, [fired, lang, t]);

  const card = cards[Math.min(cardIdx, cards.length - 1)];

  const say = (text: string) => {
    setSpokenNote(true);
    speak(text, getSpeechCode(lang));
    setTimeout(() => setSpokenNote(false), 2500);
  };

  const dictate = async (into: (v: string) => void) => {
    if (listening) return;
    setListening(true);
    try {
      const text = await listen(getSpeechCode(lang));
      if (text) into(text);
    } catch (_) {
    } finally {
      setListening(false);
    }
  };

  const decide = async (outcome: Outcome) => {
    if (saving || why.trim().length < 3) return;
    setSaving(true);
    setSaveError(null);
    try {
      const triggers = getFallbackTriggers(why).slice(0, 3).map(x => ({ type: x.type, evidence: x.evidence }));
      const reflections = Object.entries(answers).map(([qid, answer]) => ({ qid, answer }));
      await store.addDecision({
        ts: Date.now(),
        why: why.trim(),
        horizon,
        funding,
        amount: effAmount,
        maxLoss: Number(maxLoss) || 0,
        level,
        firedSignals: fired.map(s => s.id),
        outcome,
        reflections,
        triggers,
        mode,
      });
      if (outcome === 'proceeded' && effAmount > 0) {
        if (mode === 'practice') {
          await store.addPracticeTrade({ sessionId: p.sessionId, ts: Date.now(), amount: effAmount, pnl: null, funding });
        } else {
          await store.addTrade({ ts: Date.now(), amount: effAmount, pnl: null, funding });
        }
      }
      if (p.onDone) {
        p.onDone(outcome);
      } else {
        nav.goBack();
      }
    } catch (_) {
      setSaveError(t('practice.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={st.step}>
        {t('pause.step_prefix')} {screen} {t('pause.step_of')} 5
      </Text>

      {mode === 'practice' ? (
        <View style={st.banner}>
          <Text style={st.bannerText}>{t('pause.practice_banner')}</Text>
        </View>
      ) : null}

      {screen === 1 ? (
        <>
          <Title>{t('pause.quick_check_title')}</Title>
          <Card>
            <Text style={st.h}>{t('pause.amount_label')}</Text>
            <View style={st.row}>
              {AMOUNTS.map(a => (
                <Chip key={a} label={`₹${a}`} selected={!useCustom && amount === String(a)} onPress={() => { setUseCustom(false); setAmount(String(a)); }} />
              ))}
              <Chip label={t('pause.amount_other')} selected={useCustom} onPress={() => setUseCustom(true)} />
            </View>
            {useCustom ? (
              <TextInput
                value={custom}
                onChangeText={setCustom}
                keyboardType="numeric"
                placeholder={t('pause.amount_other_placeholder')}
                placeholderTextColor={colors.faint}
                style={st.input}
              />
            ) : null}
          </Card>
          <Card>
            <Text style={st.h}>{t('pause.q_funding')}</Text>
            <View style={st.row}>
              {(['savings', 'emergency', 'loan'] as Funding[]).map(f => (
                <Chip key={f} label={t(`pause.funding_${f}`)} selected={funding === f} onPress={() => setFunding(f)} />
              ))}
            </View>
          </Card>
          <Card>
            <Text style={st.h}>{t('pause.last_trade_prompt')}</Text>
            <View style={st.row}>
              {(['loss', 'profit', 'none'] as const).map(r => (
                <Chip key={r} label={t(`pause.last_trade_${r}`)} selected={lastResult === r} onPress={() => setLastResult(r)} />
              ))}
            </View>
            <View style={[st.row, { marginTop: 10 }]}>
              {(['now', '30m', 'hrs'] as const).map(w => (
                <Chip
                  key={w}
                  label={w === 'now' ? t('pause.timing_just_now') : w === '30m' ? t('pause.timing_30m') : t('pause.timing_hours')}
                  selected={lastWhen === w}
                  onPress={() => setLastWhen(w)}
                />
              ))}
            </View>
          </Card>
          <BigButton onPress={evaluate}>{t('pause.next')}</BigButton>
        </>
      ) : null}

      {screen === 2 ? (
        <>
          <View style={st.levelRow}>
            <Title>{t(`levels.${level}`)}</Title>
            <LevelPill level={level} label={t(`levels.${level}`)} />
          </View>
          <Text style={st.mirror}>{t('pause.mirror_disclaimer')}</Text>
          {fired.length === 0 ? (
            <Card>
              <Text style={st.body}>{t('signals.none')}</Text>
            </Card>
          ) : (
            fired.map(s => (
              <Card key={s.id} style={st.signal}>
                <Text style={st.body}>
                  {t(
                    `signals.${s.id}`,
                    s.id === 'late_night'
                      ? { hour: String(s.params.hour) }
                      : s.id === 'many_trades_today'
                        ? { count: Number(s.params.count) }
                        : s.id === 'quick_reentry_after_loss'
                          ? { minutes: Number(s.params.minutes) }
                          : {}
                  )}
                </Text>
              </Card>
            ))
          )}
          <BigButton onPress={() => { setCardIdx(0); setScreen(3); }}>{t('pause.next')}</BigButton>
        </>
      ) : null}

      {screen === 3 && card ? (
        <>
          <Title>{t('pause.mindful_reflection')}</Title>
          <Card style={st.deck}>
            <Text style={st.deckTitle}>{card.title}</Text>
            <Text style={st.deckText}>{card.text}</Text>
            {card.kind === 'why' ? (
              <View style={st.whyRow}>
                <TextInput
                  value={why}
                  onChangeText={v => {
                    setWhy(v);
                    setAnswers(a => ({ ...a, why: v }));
                  }}
                  placeholder={t('pause.why_placeholder')}
                  placeholderTextColor={colors.faint}
                  multiline
                  style={[st.input, st.whyInput]}
                />
                <View style={st.voiceRow}>
                  <Pressable onPress={() => dictate(v => { setWhy(v); setAnswers(a => ({ ...a, why: v })); })} style={st.voiceBtn} accessibilityLabel="Voice input">
                    <Text style={st.voiceTxt}>{listening ? '●' : '🎙'}</Text>
                  </Pressable>
                  <Pressable onPress={() => say(card.text)} style={st.voiceBtn} accessibilityLabel="Read aloud">
                    <Text style={st.voiceTxt}>🔊</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {card.kind === 'horizon' ? (
              <View style={st.row}>
                {(['today', 'days', 'weeks'] as Horizon[]).map(h => (
                  <Chip key={h} label={t(`pause.horizon_${h}`)} selected={horizon === h} onPress={() => { setHorizon(h); setAnswers(a => ({ ...a, horizon: h })); }} />
                ))}
              </View>
            ) : null}
            {card.kind === 'loss' ? (
              <TextInput
                value={maxLoss}
                onChangeText={v => {
                  setMaxLoss(v);
                  setAnswers(a => ({ ...a, max_loss: v }));
                }}
                keyboardType="numeric"
                placeholder={t('pause.loss_placeholder')}
                placeholderTextColor={colors.faint}
                style={st.input}
              />
            ) : null}
            {spokenNote ? <Text style={st.spoken}>🔊 …</Text> : null}
          </Card>
          <View style={st.nav}>
            <Pressable
              disabled={cardIdx === 0}
              onPress={() => setCardIdx(i => Math.max(0, i - 1))}
              style={[st.navBtn, cardIdx === 0 && st.navOff]}
            >
              <Text style={st.navTxt}>{t('pause.prev_card')}</Text>
            </Pressable>
            <Text style={st.counter}>
              {cardIdx + 1} / {cards.length}
            </Text>
            {cardIdx < cards.length - 1 ? (
              <Pressable onPress={() => setCardIdx(i => i + 1)} style={st.navBtn}>
                <Text style={st.navTxt}>{t('pause.next_card')}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setScreen(4)} style={[st.navBtn, st.navGo]}>
                <Text style={[st.navTxt, st.navGoTxt]}>{t('pause.skip_to_decide')}</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : null}

      {screen === 4 ? (
        <>
          <Title>{t('pause.recap_title')}</Title>
          <Card>
            <Text style={st.recap}>“{why || '—'}”</Text>
            <Text style={st.recapSub}>
              {t('pause.horizon_label')}: {t(`pause.horizon_${horizon}`)} · {t('pause.max_loss_label')}: ₹{maxLoss || '0'}
            </Text>
          </Card>
          {why.trim().length < 3 ? (
            <Text style={st.warn}>{t('pause.why_min_chars_prompt')}</Text>
          ) : null}
          {saveError ? (
            <Text style={st.err} accessibilityRole="alert">
              {saveError}
            </Text>
          ) : null}
          <BigButton variant="danger" disabled={why.trim().length < 3} loading={saving} onPress={() => decide('abandoned')}>
            {t('pause.btn_abandon')}
          </BigButton>
          <BigButton variant="secondary" disabled={why.trim().length < 3} onPress={() => decide('delayed')}>
            {t('pause.btn_delay')}
          </BigButton>
          <Pressable disabled={why.trim().length < 3} onPress={() => decide('proceeded')} style={st.proceed}>
            <Text style={[st.proceedTxt, why.trim().length < 3 && st.dim]}>{t('pause.btn_proceed')}</Text>
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  step: { color: colors.faint, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  banner: { backgroundColor: 'rgba(242,163,58,0.12)', borderWidth: 1, borderColor: colors.saffron, borderRadius: radius.md, padding: 10 },
  bannerText: { color: colors.saffron, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  h: { color: colors.cream, fontWeight: '800', fontSize: 15, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    backgroundColor: colors.abyss,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    color: colors.cream,
    fontSize: 16,
    padding: 12,
    minHeight: 52,
    marginTop: 10,
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mirror: { color: colors.faint, fontStyle: 'italic', fontSize: 13 },
  body: { color: colors.cream, fontSize: 15, lineHeight: 22 },
  signal: { borderLeftWidth: 4, borderLeftColor: colors.saffron },
  deck: { borderColor: colors.saffron + '66', minHeight: 260 },
  deckTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, fontWeight: '700' },
  deckText: { color: colors.cream, fontSize: 16, lineHeight: 24, marginTop: 8 },
  whyRow: { marginTop: 4 },
  whyInput: { minHeight: 90, textAlignVertical: 'top' },
  voiceRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  voiceBtn: {
    minWidth: 52,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: colors.abyss,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTxt: { fontSize: 20 },
  spoken: { color: colors.faint, fontSize: 12, marginTop: 8 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  navOff: { opacity: 0.35 },
  navTxt: { color: colors.cream, fontWeight: '700' },
  navGo: { backgroundColor: colors.saffron, borderColor: colors.saffron },
  navGoTxt: { color: colors.night },
  counter: { color: colors.faint, fontWeight: '700' },
  recap: { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 18, color: colors.cream, lineHeight: 26 },
  recapSub: { color: colors.muted, fontSize: 13, marginTop: 8 },
  warn: { color: colors.saffron, fontSize: 13, fontWeight: '600' },
  err: { color: colors.red, fontSize: 13, fontWeight: '700', backgroundColor: 'rgba(228,87,46,0.12)', padding: 10, borderRadius: radius.md, overflow: 'hidden' },
  proceed: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  proceedTxt: { color: colors.muted, textDecorationLine: 'underline', fontSize: 14 },
  dim: { opacity: 0.4 },
});
