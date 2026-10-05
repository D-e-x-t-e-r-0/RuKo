/** Institutional light tokens shared by every mobile screen.
 *  Same brand hues as web (saffron/ember/green/red stay); surfaces go white
 *  with hairline borders and one soft gray shadow — features first. */
export const colors = {
  night: '#FAFAF9',
  abyss: '#FFFFFF',
  navy: '#14213D',
  card: '#FFFFFF',
  cardHi: '#FFFFFF',
  cardLo: '#EEF2F7',
  cream: '#14213D',
  muted: '#475569',
  faint: '#94A3B8',
  line: '#E2E8F0',
  saffron: '#F2A33A',
  saffronHi: '#F6B252',
  saffronLo: '#D98A26',
  ember: '#E07B2A',
  clay: '#92400E',
  green: '#2BB3A3',
  greenInk: '#0F766E',
  red: '#E4572E',
  redInk: '#B91C1C',
} as const;

/** Clean institutional shadow pairs (iOS shadow + Android elevation). */
export const neu = {
  light: 'rgba(255, 255, 255, 1)',
  dark: 'rgba(20, 33, 61, 0.08)',
  card: {
    shadowColor: '#14213D',
    shadowOpacity: 0.08,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  btn: {
    shadowColor: '#92400E',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
} as const;

/** Fraunces/serif display is a bundled-asset concern; system serif keeps
 *  the ritual voice without font downloads on first install. */
export const fonts = {
  display: 'Georgia',
  body: 'System',
} as const;

export const levels: Record<string, { label: string; color: string; bg: string }> = {
  calm: { label: 'levels.calm', color: colors.green, bg: 'rgba(43,179,163,0.16)' },
  caution: { label: 'levels.caution', color: colors.saffron, bg: 'rgba(242,163,58,0.16)' },
  high: { label: 'levels.high', color: colors.red, bg: 'rgba(228,87,46,0.16)' },
};
