import { create } from 'zustand'

import { readLocalStorageItem, writeLocalStorageItem } from '@/store/browserStorage'
import { getTheme } from '@/themes'
import type { ThemeDefinition } from '@/themes/types'

const THEME_STORAGE_KEY = 'listentropy-theme'

interface ThemeState {
  themeKey: ThemeDefinition['key']
  setTheme: (themeKey: ThemeDefinition['key']) => void
}

function getStoredTheme(): ThemeDefinition['key'] {
  const storedTheme = readLocalStorageItem(THEME_STORAGE_KEY)
  if (!storedTheme) {
    return 'spotify-dark'
  }
  return getTheme(storedTheme as ThemeDefinition['key']).key
}

export function applyTheme(themeKey: ThemeDefinition['key']): void {
  const theme = getTheme(themeKey)
  const root = document.documentElement
  root.style.setProperty('--color-bg', theme.colors.bg)
  root.style.setProperty('--color-surface', theme.colors.bgSurface)
  root.style.setProperty('--color-surface-hover', theme.colors.bgSurfaceHover)
  root.style.setProperty('--color-surface-elevated', theme.colors.bgSurfaceElevated)
  root.style.setProperty('--color-accent', theme.colors.accent)
  root.style.setProperty('--color-accent-muted', theme.colors.accentMuted)
  root.style.setProperty('--color-accent-contrast', theme.colors.accentContrast)
  root.style.setProperty('--color-text', theme.colors.text)
  root.style.setProperty('--color-text-muted', theme.colors.textMuted)
  root.style.setProperty('--color-border', theme.colors.border)
  root.style.setProperty('--color-positive', theme.colors.positive)
  root.style.setProperty('--color-negative', theme.colors.negative)
  root.style.setProperty('--focus-ring', theme.colors.focusRing)
  root.style.setProperty('--focus-ring-offset', theme.colors.bg)
  if (theme.key === 'editorial-light') {
    root.style.setProperty('--shadow-surface', '0 1px 0 rgba(26, 26, 26, 0.02), 0 8px 20px rgba(26, 26, 26, 0.07)')
    root.style.setProperty('--shadow-card', '0 14px 32px rgba(26, 26, 26, 0.1)')
    root.style.setProperty('--shadow-interactive', '0 4px 12px rgba(26, 26, 26, 0.12)')
  } else if (theme.key === 'brutalist') {
    root.style.setProperty('--shadow-surface', '0 0 0 rgba(0, 0, 0, 0)')
    root.style.setProperty('--shadow-card', '0 0 0 rgba(0, 0, 0, 0)')
    root.style.setProperty('--shadow-interactive', '0 0 0 rgba(0, 0, 0, 0)')
  } else {
    root.style.setProperty('--shadow-surface', '0 1px 0 rgba(255, 255, 255, 0.02), 0 10px 24px rgba(5, 8, 14, 0.32)')
    root.style.setProperty('--shadow-card', '0 18px 44px rgba(2, 6, 12, 0.42)')
    root.style.setProperty('--shadow-interactive', '0 8px 18px rgba(4, 9, 17, 0.28)')
  }
  theme.colors.chart.forEach((color, index) => {
    root.style.setProperty(`--color-chart-${index}`, color)
  })
  root.style.setProperty('--radius', theme.borderRadius)
  root.style.setProperty('--font-heading', theme.fonts.heading)
  root.style.setProperty('--font-body', theme.fonts.body)
  root.style.setProperty('--font-mono', theme.fonts.mono)
}

const storedTheme = getStoredTheme()

export const useThemeStore = create<ThemeState>((set) => ({
  themeKey: storedTheme,
  setTheme: (themeKey) => {
    writeLocalStorageItem(THEME_STORAGE_KEY, themeKey)
    applyTheme(themeKey)
    set({ themeKey })
  },
}))
