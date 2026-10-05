/** Midnight-diya design tokens shared by every mobile screen. */

export const colors = {
  night: '#0E162E',
  abyss: '#0A1122',
  navy: '#14213D',
  card: '#182747',
  cream: '#FAF6EE',
  muted: '#94A3B8',
  faint: '#64748B',
  line: 'rgba(148, 163, 184, 0.22)',
  saffron: '#F2A33A',
  ember: '#E07B2A',
  green: '#2BB3A3',
  red: '#E4572E',
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
