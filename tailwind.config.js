/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        night: '#0E162E',
        navy: '#14213D',
        abyss: '#0A1122',
        cream: '#FAF6EE',
        paper: '#F5EDD9',
        saffron: '#F2A33A',
        ember: '#E07B2A',
        clay: '#92400E',
        rukoGreen: '#2BB3A3',
        rukoRed: '#E4572E',
      },
      fontFamily: {
        display: ['Fraunces', '"Tiro Devanagari Hindi"', 'Georgia', 'serif'],
        sans: ['Mukta', '"Noto Sans Devanagari"', '"Noto Sans Bengali"', '"Noto Sans Tamil"', '"Noto Sans Telugu"', '"Noto Sans Kannada"', '"Noto Sans Malayalam"', '"Noto Sans Gujarati"', '"Noto Sans Gurmukhi"', '"Noto Sans Oriya"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        diya: '0 0 24px rgba(242, 163, 58, 0.35), 0 0 64px rgba(242, 163, 58, 0.15)',
        card: '0 8px 32px rgba(0, 0, 0, 0.35)',
        lift: '0 12px 40px rgba(0, 0, 0, 0.45)',
        /* Clean institutional depth: flat white, hairline borders, one soft gray shadow */
        neu: '0 1px 2px rgba(20, 33, 61, 0.06), 0 4px 14px rgba(20, 33, 61, 0.07)',
        'neu-sm': '0 1px 2px rgba(20, 33, 61, 0.06)',
        'neu-in': 'inset 0 2px 6px rgba(20, 33, 61, 0.08)',
        'neu-btn': '0 2px 8px rgba(146, 64, 14, 0.25)',
        'neu-diya': '0 4px 18px rgba(242, 163, 58, 0.4), 0 2px 6px rgba(20, 33, 61, 0.12)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '45%': { opacity: '0.86', transform: 'scale(0.97)' },
          '60%': { opacity: '0.95', transform: 'scale(1.02)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise 0.5s ease-out both',
        flicker: 'flicker 3.2s ease-in-out infinite',
        'glow-pulse': 'glowPulse 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
