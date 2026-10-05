import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme';

export function Screen({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[s.scroll, padded && s.pad]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[s.title, style]}>{children}</Text>;
}

export function Sub({ children, style }: { children?: React.ReactNode; style?: TextStyle }) {
  if (!children) return null;
  return <Text style={[s.sub, style]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';

export function BigButton({
  children,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onPress: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const vs = disabled ? [btn.base, btn.disabled] : [btn.base, btn[variant]];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [...vs, pressed && !disabled && btn.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.night : colors.cream} />
      ) : typeof children === 'string' ? (
        <Text style={[btn.text, variant === 'primary' && btn.textDark]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[s.chip, selected && s.chipOn]}
    >
      <Text style={[s.chipText, selected && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function LevelPill({ level, label }: { level: string; label: string }) {
  const color = level === 'high' ? colors.red : level === 'caution' ? colors.saffron : colors.green;
  return (
    <View style={[s.pill, { borderColor: color, backgroundColor: color + '26' }]}>
      <Text style={[s.pillText, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={s.divider} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  scroll: { flexGrow: 1, paddingBottom: 110 },
  pad: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: '800',
    color: colors.cream,
    letterSpacing: -0.5,
  },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.saffron,
    marginBottom: spacing.xs,
  },
  chip: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.abyss,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.saffron, borderColor: colors.saffron },
  chipText: { color: colors.cream, fontWeight: '700', fontSize: 14 },
  chipTextOn: { color: colors.night },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  divider: { height: 1, backgroundColor: colors.line, opacity: 0.6 },
});

const btn = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  text: { color: colors.cream, fontWeight: '800', fontSize: 16 },
  textDark: { color: colors.night },
  primary: {
    backgroundColor: colors.saffron,
    shadowColor: colors.saffron,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  secondary: { backgroundColor: colors.green },
  danger: { backgroundColor: colors.red },
  outline: { borderWidth: 2, borderColor: colors.faint, backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  disabled: { backgroundColor: 'rgba(242,163,58,0.3)' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
