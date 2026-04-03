import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.vue',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.ts',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
        },
        secondary: {
          DEFAULT: '#64748B',
          light: '#94A3B8',
          dark: '#475569',
        },
        accent: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#D97706',
        },
        success: '#16A34A',
        warning: '#EAB308',
        error: '#DC2626',
        fav: {
          DEFAULT: '#EC4899',
          light: '#FDF2F8',
          border: '#FBCFE8',
          text: '#DB2777',
          'match-bg': '#F8F1F6',
          'match-border': '#EDCFE4',
        },
        background: '#F8FAFC',
        surface: '#FFFFFF',
        text: {
          DEFAULT: '#1E293B',
          light: '#64748B',
          muted: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'heading': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        'subheading': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      maxWidth: {
        'content': '1366px',
      },
    },
  },
  plugins: [],
} satisfies Config
