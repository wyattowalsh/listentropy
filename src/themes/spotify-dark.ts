import type { ThemeDefinition } from './types'

export const spotifyDarkTheme: ThemeDefinition = {
  name: 'Listentropy Dark',
  key: 'spotify-dark',
  colors: {
    bg: '#0f1115',
    bgSurface: '#161b24',
    bgSurfaceHover: '#1f2733',
    bgSurfaceElevated: '#263142',
    accent: '#c9a46b',
    accentMuted: '#ddc49f',
    accentContrast: '#1b140b',
    focusRing: '#ebd8ba',
    text: '#f5f7fa',
    textMuted: '#a7afbe',
    border: '#2b3444',
    chart: ['#c9a46b', '#8fa7d8', '#b7c48d', '#d68d7b', '#9c8cca', '#7fa7a5', '#d8b58f', '#96bce6', '#bdaada', '#7e8ca8'],
    positive: '#4fb783',
    negative: '#e3828a',
  },
  fonts: {
    heading: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
    body: '"Segoe UI Variable Text", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  borderRadius: '0.625rem',
}
