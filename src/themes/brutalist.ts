import type { ThemeDefinition } from './types'

export const brutalistTheme: ThemeDefinition = {
  name: 'Brutalist',
  key: 'brutalist',
  colors: {
    bg: '#000000',
    bgSurface: '#111111',
    bgSurfaceHover: '#191919',
    accent: '#FF0000',
    accentMuted: '#ff4d4d',
    text: '#FFFFFF',
    textMuted: '#999999',
    border: '#444444',
    chart: ['#FF0000', '#FFFFFF', '#999999', '#d9d9d9', '#ff8080', '#B30000', '#660000', '#f2f2f2', '#808080', '#4d4d4d'],
    positive: '#00ff66',
    negative: '#ff4d4d',
  },
  fonts: {
    heading: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    body: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  borderRadius: '0rem',
}
