import { brutalistTheme } from './brutalist'
import { editorialLightTheme } from './editorial-light'
import { midnightTheme } from './midnight'
import { spotifyDarkTheme } from './spotify-dark'
import type { ThemeDefinition } from './types'

export const themes: ThemeDefinition[] = [
  spotifyDarkTheme,
  editorialLightTheme,
  brutalistTheme,
  midnightTheme,
]

export function getTheme(key: ThemeDefinition['key']): ThemeDefinition {
  return themes.find((theme) => theme.key === key) ?? spotifyDarkTheme
}
