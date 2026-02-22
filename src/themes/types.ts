export interface ThemeDefinition {
  name: string
  key: 'spotify-dark' | 'editorial-light' | 'brutalist' | 'midnight'
  colors: {
    bg: string
    bgSurface: string
    bgSurfaceHover: string
    accent: string
    accentMuted: string
    text: string
    textMuted: string
    border: string
    chart: string[]
    positive: string
    negative: string
  }
  fonts: {
    heading: string
    body: string
    mono: string
  }
  borderRadius: string
}
