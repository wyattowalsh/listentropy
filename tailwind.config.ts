import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        'surface-elevated': 'var(--color-surface-elevated)',
        accent: 'var(--color-accent)',
        'accent-muted': 'var(--color-accent-muted)',
        'accent-contrast': 'var(--color-accent-contrast)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        border: 'var(--color-border)',
      },
      borderRadius: {
        'theme-sm': 'var(--radius-sm)',
        theme: 'var(--radius)',
        'theme-lg': 'var(--radius-lg)',
      },
      spacing: {
        panel: 'var(--space-panel)',
        'panel-lg': 'var(--space-panel-lg)',
        'control-x': 'var(--space-control-x)',
        'control-y': 'var(--space-control-y)',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
      },
      boxShadow: {
        surface: 'var(--shadow-surface)',
        card: 'var(--shadow-card)',
        interactive: 'var(--shadow-interactive)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        normal: 'var(--motion-normal)',
        slow: 'var(--motion-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        emphasized: 'var(--ease-emphasized)',
        decelerated: 'var(--ease-decelerated)',
      },
      keyframes: {
        fadeSlideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        reveal: 'fadeSlideUp var(--motion-normal) var(--ease-emphasized) both',
        shimmer: 'shimmer var(--motion-shimmer) linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
