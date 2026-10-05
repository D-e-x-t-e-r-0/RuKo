import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Svg, { Line as SvgLine, Rect } from 'react-native-svg';
import { BigButton, Card, Chip, Screen, Title } from '../components/ui';
import { INSTRUMENTS, SCENARIOS, generatePrices, pricesToCandles, getSimTime, type Candle, type InstrumentId, type ScenarioId } from '../sim/market';
import { INITIAL_WALLET_BALANCE, calculatePnl, isAutoCloseTriggered } from '../sim/account';
import type { Outcome, PracticeTrade } from '../types';
import { store } from '../storage';
import { colors, radius, spacing } from '../theme';
import { PauseScreen } from './Pause';

const TICKS = 120;
const MARGINS = [10000, 25000, 50000] as const;

function CandleStrip({ candles }: { candles: Candle[] }) {
  const W = 320;
  const H = 120;
  if (candles.length === 0) return null;
  const all = candles.flatMap((c) => [c.high, c.low]);
  let hi = Math.max(...all);
  let lo = Math.min(...all);
  if (hi - lo < 0.01) {
    hi += 0.5;
    lo -= 0.5;
  }
  const y = (p: number) => 8 + (1 - (p - lo) / (hi - lo)) * (H - 16);
  const slot = W / candles.length;
  const bodyW = Math.max(3, Math.min(14, slot * 0.55));
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {candles.map((c, i) => {
        const up = c.close >= c.open;
        const color = up ? colors.green : colors.red;
        const cx = slot * i + slot / 2;
        const top = Math.min(y(c.open), y(c.close));
        const hgt = Math.max(2, Math.abs(y(c.close) - y(c.open)));
        return (
          <React.Fragment key={c.tick}>
            <SvgLine x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1.5} />
            {up ? (
              <Rect x={cx - bodyW / 2} y={top} width={bodyW} height={hgt} rx={1} fill={color} fillOpacity={0.9} />
            ) : (
              <Rect x={cx - bodyW / 2} y={top} width={bodyW} height={hgt} rx={1} fill="none" stroke={color} strokeWidth={2} />
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export function PracticeScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const [scenario, setScenario] = useState<ScenarioId>('calm');
  const [pauseOn, setPauseOn] = useState(true);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [wallet, setWallet] = useState(INITIAL_WALLET_BALANCE);
  const [instrument, setInstrument] = useState<InstrumentId>('demo_index');
  const [margin, setMargin] = useState<number>(10000);
  const [customMargin, setCustomMargin] = useState('10000');
  const [useCustom, setUseCustom] = useState(false);
  const [leverage, setLeverage] = useState<1 | 5>(1);
  const [entry, setEntry] = useState<number | null>(null);
  const [series, setSeries] = useState<Record<InstrumentId, number[]> | null>(null);
  const [trades, setTrades] = useState<PracticeTrade[]>([]);
  const [afterLoss, setAfterLoss] = useState(0);
  const [margins, setMargins] = useState<number[]>([]);
  const [pauses, setPauses] = useState(0);
  const [gaveUp, setGaveUp] = useState(0);
  const [drawdown, setDrawdown] = useState(0);
  const [autoClosed, setAutoClosed] = useState(false);
  const peak = useRef(INITIAL_WALLET_BALANCE);
  const ended = useRef(false);
  const [ritual, setRitual] = useState(false);
  const [pendingMargin, setPendingMargin] = useState(10000);

  const effMargin = useCustom ? Math.max(1000, Number(customMargin) || 10000) : margin;
  const sc = SCENARIOS[scenario];
  const prices = series?.[instrument] ?? [];
  const price = prices[tick] ?? 100;
  const simTs = useMemo(() => getSimTime(sc.startHour, sc.startMinute, tick), [sc, tick]);
  const pnl = entry == null ? 0 : calculatePnl(entry, price, margins[margins.length - 1] ?? effMargin, leverage);

  const start = async () => {
    ended.current = false;
    const s: Record<InstrumentId, number[]> = {
      demo_index: generatePrices(sc.fixedSeed, scenario, 'demo_index', TICKS),
      demo_co_a: generatePrices(sc.fixedSeed + 11, scenario, 'demo_co_a', TICKS),
      demo_co_b: generatePrices(sc.fixedSeed + 23, scenario, 'demo_co_b', TICKS),
      demo_futures: generatePrices(sc.fixedSeed + 37, scenario, 'demo_futures', TICKS),
    };
    setSeries(s);
    setTick(0);
    setWallet(INITIAL_WALLET_BALANCE);
    setEntry(null);
    setTrades([]);
    setAfterLoss(0);
    setMargins([]);
    setPauses(0);
    setGaveUp(0);
    setDrawdown(0);
    setAutoClosed(false);
    peak.current = INITIAL_WALLET_BALANCE;
    const id = await store.addSession({
      startedAt: Date.now(),
      scenario,
      pauseEnabled: pauseOn,
      tradesOpened: 0,
      tradesAfterLoss: 0,
      sizeIncreasePercent: 0,
      maxDrawdownPercent: 0,
      finalPnl: 0,
      pausesTaken: 0,
      abandonedOrDelayed: 0,
      observedSignals: [],
    });
    if (scenario === 'late_night') {
      const seedLoss: PracticeTrade = {
        sessionId: id,
        ts: getSimTime(sc.startHour, sc.startMinute, 0) - 5 * 60000,
        amount: 10000,
        pnl: -2500,
        funding: 'savings',
        instrument: 'Demo Index',
        entryPrice: 102.5,
        closePrice: 100,
        leverage: 1,
      };
      await store.addPracticeTrade(seedLoss);
      setTrades([seedLoss]);
    }
    setSessionId(id);
  };

  useEffect(() => {
    if (sessionId == null || !series || ritual) return;
    const tm = setInterval(() => setTick(x => Math.min(TICKS - 1, x + 1)), 1000);
    return () => clearInterval(tm);
  }, [sessionId, series, ritual]);

  // live signals + auto-close + drawdown
  useEffect(() => {
    if (sessionId == null || !series || ritual) return;
    if (tick >= TICKS - 1) {
      end();
      return;
    }
    if (entry != null) {
      const m = margins[margins.length - 1];
      if (isAutoCloseTriggered(entry, price, m, leverage)) {
        close(true);
        return;
      }
      const eq = wallet + m + pnl;
      if (eq > peak.current) peak.current = eq;
      setDrawdown(d => Math.max(d, ((peak.current - eq) / peak.current) * 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const open = (m: number) => {
    if (entry != null || m > wallet || sessionId == null) return;
    const lastLoss = [...trades].reverse().find(x => x.pnl != null && x.pnl < 0);
    if (lastLoss && simTs - lastLoss.ts <= 5 * 60000) setAfterLoss(n => n + 1);
    setWallet(w => w - m);
    setEntry(price);
    setMargins(x => [...x, m]);
  };

  const close = async (auto = false) => {
    if (entry == null || sessionId == null) return;
    const m = margins[margins.length - 1];
    const final = calculatePnl(entry, price, m, leverage);
    const rec: Omit<PracticeTrade, 'id'> = {
      sessionId,
      ts: simTs,
      amount: m,
      pnl: final,
      funding: 'savings',
      instrument: INSTRUMENTS[instrument].name,
      entryPrice: entry,
      closePrice: price,
      leverage,
    };
    await store.addPracticeTrade(rec);
    setTrades(x => [...x, { ...rec, id: Date.now() }]);
    setWallet(w => w + m + final);
    setEntry(null);
    if (auto) setAutoClosed(true);
  };

  const end = async () => {
    if (ended.current) return;
    ended.current = true;
    if (entry != null) {
      const m = margins[margins.length - 1];
      const final = calculatePnl(entry, price, m, leverage);
      await store.addPracticeTrade({
        sessionId: sessionId ?? 0,
        ts: simTs,
        amount: m,
        pnl: final,
        funding: 'savings',
        instrument: INSTRUMENTS[instrument].name,
        entryPrice: entry,
        closePrice: price,
        leverage,
      });
      setWallet(w => w + m + final);
      setEntry(null);
    }
    if (sessionId == null) return;
    const first = margins[0] ?? 0;
    const biggest = margins.length ? Math.max(...margins) : 0;
    await store.updateSession(sessionId, {
      endedAt: Date.now(),
      tradesOpened: trades.length + (entry != null ? 1 : 0),
      tradesAfterLoss: afterLoss,
      sizeIncreasePercent: first > 0 ? Math.max(0, Math.round(((biggest - first) / first) * 100)) : 0,
      maxDrawdownPercent: Math.round(drawdown * 10) / 10,
      finalPnl: wallet - INITIAL_WALLET_BALANCE + (entry != null ? pnl : 0),
      pausesTaken: pauses,
      abandonedOrDelayed: gaveUp,
      observedSignals: [],
    });
    const id = sessionId;
    setSessionId(null);
    setSeries(null);
    nav.navigate('Debrief' as never, { id } as never);
  };

  const requestOpen = () => {
    if (pauseOn) {
      setPendingMargin(effMargin);
      setRitual(true);
    } else {
      open(effMargin);
    }
  };

  const ritualDone = (outcome: Outcome) => {
    setRitual(false);
    setPauses(x => x + 1);
    if (outcome === 'proceeded') open(pendingMargin);
    else setGaveUp(x => x + 1);
  };

  if (ritual) {
    return <PauseScreen mode="practice" amount={pendingMargin} funding="savings" sessionId={sessionId ?? undefined} onDone={ritualDone} />;
  }

  if (sessionId == null || !series) {
    return (
      <Screen>
        <Title>{t('practice.title')}</Title>
        <Text style={st.sub}>{t('practice.select_scenario')}</Text>
        {(Object.keys(SCENARIOS) as ScenarioId[]).map(id => (
          <Pressable
            key={id}
            onPress={() => setScenario(id)}
            style={[st.opt, scenario === id && st.optOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: scenario === id }}
          >
            <Text style={st.optTitle}>
              {t(`practice.scenarios.${id}_title`, id)} · {String(SCENARIOS[id].startHour).padStart(2, '0')}:
              {String(SCENARIOS[id].startMinute).padStart(2, '0')}
            </Text>
            <Text style={st.optDesc}>{t(`practice.scenarios.${id}_desc`, '')}</Text>
          </Pressable>
        ))}
        <Card>
          <View style={st.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.toggleTitle}>{t('practice.pause_toggle')}</Text>
              <Text style={st.toggleDesc}>{t('practice.pause_toggle_desc')}</Text>
            </View>
            <Pressable
              onPress={() => setPauseOn(v => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: pauseOn }}
              style={[st.toggle, pauseOn && st.toggleOn]}
            >
              <View style={[st.knob, pauseOn && st.knobOn]} />
            </Pressable>
          </View>
        </Card>
        <BigButton onPress={start}>{t('practice.start_btn')}</BigButton>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={st.banner}>
        <Text style={st.bannerText}>{t('practice.banner')}</Text>
      </View>
      <Card>
        <View style={st.topRow}>
          <Text style={st.scTitle}>
            {t(`practice.scenarios.${scenario}_title`, scenario)} · {t('practice.ticks_left', { m: TICKS - tick })}
          </Text>
          <Pressable onPress={() => end()} style={st.endBtn}>
            <Text style={st.endTxt}>{t('practice.end_session')}</Text>
          </Pressable>
        </View>
        <View style={st.chart}>
          <CandleStrip candles={pricesToCandles(prices.slice(0, tick + 1), 5)} />
        </View>
        <View style={st.kvRow}>
          <View style={st.kv}>
            <Text style={st.k}>{t('practice.wallet')}</Text>
            <Text style={st.v}>₹{wallet.toLocaleString('en-IN')}</Text>
          </View>
          <View style={st.kv}>
            <Text style={st.k}>{t('practice.current_price')}</Text>
            <Text style={st.v}>{price.toFixed(2)}</Text>
          </View>
          <View style={st.kv}>
            <Text style={st.k}>{t('practice.unrealized_pnl')}</Text>
            <Text style={[st.v, { color: pnl >= 0 ? colors.green : colors.red }]}>
              {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </Card>

      {autoClosed ? (
        <View style={st.notice}>
          <Text style={st.noticeTxt}>{t('practice.auto_close_notice')}</Text>
        </View>
      ) : null}

      {entry == null ? (
        <Card>
          <Text style={st.h}>{t('practice.instrument')}</Text>
          <View style={st.row}>
            {(Object.keys(INSTRUMENTS) as InstrumentId[]).map(id => (
              <Chip key={id} label={INSTRUMENTS[id].name} selected={instrument === id} onPress={() => setInstrument(id)} />
            ))}
          </View>
          <Text style={[st.h, { marginTop: 12 }]}>{t('practice.margin')}</Text>
          <View style={st.row}>
            {MARGINS.map(m => (
              <Chip key={m} label={`₹${m / 1000}k`} selected={!useCustom && effMargin === m} onPress={() => { setUseCustom(false); setMargin(m); }} />
            ))}
            <Chip label={t('practice.custom_label')} selected={useCustom} onPress={() => setUseCustom(true)} />
          </View>
          {useCustom ? (
            <TextInput
              value={customMargin}
              onChangeText={setCustomMargin}
              keyboardType="numeric"
              placeholder={t('practice.enter_margin_placeholder')}
              placeholderTextColor={colors.faint}
              style={st.input}
            />
          ) : null}
          {INSTRUMENTS[instrument].maxLeverage === 5 ? (
            <>
              <Text style={[st.h, { marginTop: 12 }]}>{t('practice.leverage')}</Text>
              <View style={st.row}>
                <Chip label="1x" selected={leverage === 1} onPress={() => setLeverage(1)} />
                <Chip label="5x" selected={leverage === 5} onPress={() => setLeverage(5)} />
              </View>
            </>
          ) : null}
          <View style={{ marginTop: 12 }}>
            <BigButton onPress={requestOpen} disabled={effMargin > wallet}>
              {t('practice.open_position')}
            </BigButton>
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={st.posTxt}>
            {t('practice.position_active', {
              inst: INSTRUMENTS[instrument].name,
              margin: margins[margins.length - 1],
              lev: leverage,
            })}
          </Text>
          <View style={{ marginTop: 12 }}>
            <BigButton onPress={() => close()}>{t('practice.close_position')}</BigButton>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  sub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  opt: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.line },
  optOn: { borderColor: colors.saffron },
  optTitle: { color: colors.cream, fontWeight: '800', fontSize: 15 },
  optDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { color: colors.cream, fontWeight: '800', fontSize: 14 },
  toggleDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  toggle: { minHeight: 48, minWidth: 56, borderRadius: 24, backgroundColor: '#475569', justifyContent: 'center', padding: 4 },
  toggleOn: { backgroundColor: colors.saffron },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.night },
  knobOn: { alignSelf: 'flex-end' },
  banner: { backgroundColor: 'rgba(242,163,58,0.12)', borderWidth: 1, borderColor: colors.saffron, borderRadius: radius.md, padding: 10 },
  bannerText: { color: colors.saffron, fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 17 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scTitle: { color: colors.cream, fontWeight: '800', fontSize: 13, flex: 1 },
  endBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.red, borderRadius: 10 },
  endTxt: { color: '#FDA4AF', fontWeight: '800', fontSize: 12 },
  chart: { backgroundColor: colors.abyss, borderRadius: radius.md, padding: 6, marginTop: 10, alignItems: 'center' },
  kvRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  kv: { flex: 1, backgroundColor: colors.abyss, borderRadius: radius.md, padding: 10 },
  k: { color: colors.muted, fontSize: 10 },
  v: { color: colors.cream, fontWeight: '800', fontSize: 15, marginTop: 2 },
  h: { color: colors.cream, fontWeight: '800', fontSize: 14, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { backgroundColor: colors.abyss, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, color: colors.cream, fontSize: 16, padding: 12, minHeight: 52, marginTop: 10 },
  posTxt: { color: colors.cream, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  notice: { backgroundColor: 'rgba(228,87,46,0.14)', borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 10 },
  noticeTxt: { color: '#FCA5A5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
