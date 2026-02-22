import { create } from 'zustand'

import { getTheme } from '@/themes'
import type { ThemeDefinition } from '@/themes/types'

const THEME_STORAGE_KEY = 'listentropy-theme'

interface ThemeState {
  themeKey: ThemeDefinition['key']
  setTheme: (themeKey: ThemeDefinition['key']) => void
}

export function applyTheme(themeKey: ThemeDefinition['key']): void {
  const theme = getTheme(themeKey)
  const root = document.documentElement
  root.style.setProperty('--color-bg', theme.colors.bg)
  root.style.setProperty('--color-surface', theme.colors.bgSurface)
  root.style.setProperty('--color-surface-hover', theme.colors.bgSurfaceHover)
  root.style.setProperty('--color-surface-elevated', theme.colors.bgSurfaceHover)
  root.style.setProperty('--color-accent', theme.colors.accent)
  root.style.setProperty('--color-accent-muted', theme.colors.accentMuted)
  root.style.setProperty('--color-text', theme.colors.text)
  root.style.setProperty('--color-text-muted', theme.colors.textMuted)
  root.style.setProperty('--color-border', theme.colors.border)
  root.style.setProperty('--color-positive', theme.colors.positive)
  root.style.setProperty('--color-negative', theme.colors.negative)
  root.style.setProperty('--focus-ring', theme.colors.accent)
  root.style.setProperty(
    '--shadow-card',
    theme.key === 'editorial-light'
      ? '0 8px 24px rgba(26, 26, 26, 0.08)'
      : theme.key === 'brutalist'
        ? '0 0 0 rgba(0,0,0,0)'
        : '0 10px 30px rgba(0, 0, 0, 0.25)',
  )
  theme.colors.chart.forEach((color, index) => {
    root.style.setProperty(`--color-chart-${index}`, color)
  })
  root.style.setProperty('--radius', theme.borderRadius)
  root.style.setProperty('--font-heading', theme.fonts.heading)
  root.style.setProperty('--font-body', theme.fonts.body)
  root.style.setProperty('--font-mono', theme.fonts.mono)
}

const storedTheme =
  (typeof window !== 'undefined'
    ? (localStorage.getItem(THEME_STORAGE_KEY) as ThemeDefinition['key'] | null)
    : null) ?? 'spotify-dark'

export const useThemeStore = create<ThemeState>((set) => ({
  themeKey: storedTheme,
  setTheme: (themeKey) => {
    localStorage.setItem(THEME_STORAGE_KEY, themeKey)
    applyTheme(themeKey)
    set({ themeKey })
  },
}))
