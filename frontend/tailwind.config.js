/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        safe: {
          green: '#19D09C',
          emerald: '#00BFA6',
          dark: '#073B4C',
          blue: '#0A7C86',
          navy: '#034155',
          soft: '#E8FFFA',
          purple: '#7168D9',
          violet: '#7A5CCB',
          red: '#D90446',
          yellow: '#FFB703',
          charcoal: '#232323'
        }
      },
      boxShadow: {
        soft: '0 18px 45px rgba(3, 65, 85, 0.12)',
        app: '0 20px 60px rgba(7, 59, 76, 0.22)'
      },
      backgroundImage: {
        'safe-gradient': 'linear-gradient(135deg, #073B4C 0%, #0A7C86 45%, #19D09C 100%)',
        'safe-violet': 'linear-gradient(160deg, #7168D9 0%, #7A5CCB 100%)',
        'safe-red': 'linear-gradient(135deg, #D90446 0%, #C8033F 100%)'
      }
    }
  },
  plugins: []
};
