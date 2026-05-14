/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0b0e',
        neural: '#00ff88', /* The classic CodeSync green accent */
        memory: '#00c2ff', /* Live/active states */
        surface: {
          100: '#1a1d27',
          200: '#13151c',
          300: '#0f1117'
        },
        border: {
          light: '#2a2f45',
          dark: '#1e2130'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif']
      },
      boxShadow: {
        'sci-glow': '0 0 20px rgba(0, 255, 136, 0.2)',
        'card-float': '0 8px 30px rgba(0, 0, 0, 0.4)',
        'inset-neon': 'inset 0 0 0 1px rgba(255, 255, 255, 0.08)'
      }
    },
  },
  plugins: [],
}
