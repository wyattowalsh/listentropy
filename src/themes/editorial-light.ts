import type { ThemeDefinition } from './types'

export const editorialLightTheme: ThemeDefinition = {
  name: 'Editorial Light',
  key: 'editorial-light',
  colors: {
    bg: '#FAFAF7',
    bgSurface: '#FFFFFF',
    bgSurfaceHover: '#F0EDE6',
    accent: '#C8553D',
    accentMuted: '#da8e7d',
    text: '#1A1A1A',
    textMuted: '#6B6B6B',
    border: '#d9d4cc',
    chart: ['#C8553D', '#E07A5F', '#F2CC8F', '#D4A373', '#A98467', '#7F5539', '#9C6644', '#B08968', '#D9AE94', '#E6CCB2'],
    positive: '#15803d',
    negative: '#b91c1c',
  },
  fonts: {
    heading: 'Georgia, "Iowan Old Style", "Times New Roman", Times, serif',
    body: '"Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  borderRadius: '0.25rem',
}
