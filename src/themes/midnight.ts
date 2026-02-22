import type { ThemeDefinition } from './types'

export const midnightTheme: ThemeDefinition = {
  name: 'Midnight',
  key: 'midnight',
  colors: {
    bg: '#0B1120',
    bgSurface: '#111827',
    bgSurfaceHover: '#1E293B',
    accent: '#60A5FA',
    accentMuted: '#93c5fd',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    border: '#334155',
    chart: ['#60A5FA', '#3B82F6', '#2563EB', '#4F46E5', '#6366F1', '#818CF8', '#38BDF8', '#22D3EE', '#0EA5E9', '#1D4ED8'],
    positive: '#34d399',
    negative: '#fb7185',
  },
  fonts: {
    heading: '"Trebuchet MS", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
    body: '"Avenir Next", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  borderRadius: '0.75rem',
}
