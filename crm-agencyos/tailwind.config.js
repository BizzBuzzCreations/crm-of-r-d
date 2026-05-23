/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
        sidebar: {
          DEFAULT: '#0f172a',
          hover:   '#1e293b',
          border:  'rgba(255,255,255,0.06)',
          text:    '#94a3b8',
          active:  'rgba(99,102,241,0.18)',
        },
      },
      keyframes: {
        slideUp:   { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        scaleIn:   { from: { opacity: 0, transform: 'scale(.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        slideUp:  'slideUp .2s ease',
        fadeIn:   'fadeIn .2s ease',
        scaleIn:  'scaleIn .15s ease',
        shimmer:  'shimmer 1.4s infinite linear',
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,.1),0 2px 6px rgba(0,0,0,.06)',
        modal: '0 20px 60px rgba(0,0,0,.18)',
        glow:  '0 0 20px rgba(99,102,241,.25)',
      },
    },
  },
  plugins: [],
}
