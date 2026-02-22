import type { ThemeDefinition } from './types'

export const spotifyDarkTheme: ThemeDefinition = {
  name: 'Spotify Dark',
  key: 'spotify-dark',
  colors: {
    bg: '#121212',
    bgSurface: '#181818',
    bgSurfaceHover: '#282828',
    accent: '#1DB954',
    accentMuted: '#57e08a',
    text: '#FFFFFF',
    textMuted: '#B3B3B3',
    border: '#2c2c2c',
    chart: ['#1DB954', '#39c76b', '#53d67f', '#7be2a0', '#9debbd', '#36a85a', '#2a8445', '#1f6636', '#4fef94', '#89ffc0'],
    positive: '#4ade80',
    negative: '#f87171',
  },
  fonts: {
    heading: '"Segoe UI Variable Display", "Avenir Next", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
    body: '"Segoe UI Variable Text", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  borderRadius: '0.5rem',
}
