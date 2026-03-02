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
    <header className="sticky top-0 z-50 border-b border-border/80 bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-3 px-4 py-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-theme border border-border/80 bg-surface text-accent shadow-surface">
              <Music2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent-muted/80">Private listening ledger</p>
              <h1 className="font-heading text-lg font-semibold leading-tight text-text">Listentropy</h1>
              <p className="truncate text-xs text-text-muted">Your music. Your data. Your story.</p>
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Select
                aria-label="Select theme"
                value={themeKey}
                onChange={(event) =>
                  setTheme(event.currentTarget.value as (typeof themes)[number]['key'])
                }
                className="min-w-0 flex-1 sm:flex-none sm:min-w-[168px]"
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
                className="min-w-0 flex-1 sm:flex-none sm:min-w-[132px]"
              >
                <option value="local">Local Time</option>
                <option value="utc">UTC</option>
              </Select>
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {onOpenAdvanced ? (
                <Button variant="outline" onClick={onOpenAdvanced} className="px-3">
                  Advanced
                </Button>
              ) : null}

              <Button
                variant="ghost"
                onClick={onReset}
                title="Reset uploaded data"
                aria-label="Reset uploaded data"
                className="h-[44px] w-[44px] shrink-0 px-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant={spotifySession ? 'outline' : 'default'}
                onClick={handleSpotifyAuthButton}
                disabled={spotifyStatus === 'authorizing'}
                className={
                  spotifySession
                    ? 'min-h-10 flex-1 justify-center border-[#1DB954]/50 px-4 text-sm text-[#1DB954] hover:border-[#1DB954] hover:text-[#1DB954] sm:flex-none'
                    : 'min-h-10 flex-1 justify-center border-[#1DB954] bg-[#1DB954] px-4 text-sm font-semibold text-black hover:border-[#1DB954] hover:bg-[#1ED760] sm:flex-none'
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
        </div>
      </div>
    </header>
  )
}
