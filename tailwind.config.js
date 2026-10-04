/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#14213D',
        cream: '#FAF6EE',
        saffron: '#F2A33A',
        rukoGreen: '#2BB3A3',
        rukoRed: '#E4572E',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', "'Noto Sans Devanagari'", 'sans-serif'],
      },
    },
  },
  plugins: [],
}
