import { useMemo } from 'react'
import { Music2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { getSpotifyPkceConfig } from '@/lib/spotify-auth/oauth'
import { themes } from '@/themes'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'
import { useThemeStore } from '@/store/useThemeStore'
import type { TimezoneMode } from '@/lib/types'

interface HeaderProps {
  onReset: () => void
  onOpenAdvanced?: () => void
  timezoneMode: TimezoneMode
  onTimezoneModeChange: (mode: TimezoneMode) => void
}

export function Header({ onReset, onOpenAdvanced, timezoneMode, onTimezoneModeChange }: HeaderProps): JSX.Element {
  const themeKey = useThemeStore((state) => state.themeKey)
  const setTheme = useThemeStore((state) => state.setTheme)
  const spotifyStatus = useSpotifyAuthStore((state) => state.status)
  const spotifySession = useSpotifyAuthStore((state) => state.session)
  const connectSpotify = useSpotifyAuthStore((state) => state.connectSpotify)
  const spotifyOauthConfigured = useMemo(() => {
    try {
      return Boolean(getSpotifyPkceConfig().clientId)
    } catch {
      return false
    }
  }, [])

  function handleSpotifyAuthButton(): void {
    if (spotifySession) {
      onOpenAdvanced?.()
      return
    }
    if (!spotifyOauthConfigured) {
      onOpenAdvanced?.()
      return
    }
    void connectSpotify()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Music2 className="h-5 w-5 text-accent" />
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-semibold text-text">Listentropy</h1>
            <p className="truncate text-xs text-text-muted">Your music. Your data. Your story.</p>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2">
          <Select
            aria-label="Select theme"
            value={themeKey}
            onChange={(event) =>
              setTheme(event.currentTarget.value as (typeof themes)[number]['key'])
            }
            className="min-w-0 flex-1 sm:flex-none sm:min-w-[160px]"
          >
            {themes.map((theme) => (
              <option key={theme.key} value={theme.key}>
                {theme.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Select timezone mode"
            value={timezoneMode}
            onChange={(event) => onTimezoneModeChange(event.currentTarget.value as TimezoneMode)}
            className="min-w-0 flex-1 sm:flex-none sm:min-w-[128px]"
          >
            <option value="local">Local Time</option>
            <option value="utc">UTC</option>
          </Select>
          {onOpenAdvanced ? (
            <Button variant="outline" onClick={onOpenAdvanced}>
              Advanced
            </Button>
          ) : null}

          <Button variant="ghost" onClick={onReset} title="Reset uploaded data" aria-label="Reset uploaded data">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant={spotifySession ? 'outline' : 'default'}
            onClick={handleSpotifyAuthButton}
            disabled={spotifyStatus === 'authorizing'}
            className={
              spotifySession
                ? 'w-full justify-center border-[#1DB954]/50 px-4 py-2.5 text-sm text-[#1DB954] hover:border-[#1DB954] hover:text-[#1DB954] sm:w-auto'
                : 'w-full justify-center border-[#1DB954] bg-[#1DB954] px-4 py-2.5 text-sm font-semibold text-black hover:border-[#1DB954] hover:bg-[#1ED760] sm:w-auto'
            }
            title={
              spotifySession
                ? 'Manage Spotify setup'
                : spotifyOauthConfigured
                  ? 'Login with Spotify'
                  : 'Spotify OAuth is not configured in this build. Open Advanced setup for manual token fallback.'
            }
          >
            <Music2 className="h-4 w-4" aria-hidden="true" />
            {spotifyStatus === 'authorizing'
              ? 'Redirecting…'
              : spotifySession
                ? 'Spotify Connected'
                : 'Login with Spotify'}
          </Button>
        </div>
      </div>
    </header>
  )
}
