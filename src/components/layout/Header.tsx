import { Music2, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { themes } from '@/themes'
import { useThemeStore } from '@/store/useThemeStore'
import type { TimezoneMode } from '@/lib/types'

interface HeaderProps {
  onReset: () => void
  timezoneMode: TimezoneMode
  onTimezoneModeChange: (mode: TimezoneMode) => void
}

export function Header({ onReset, timezoneMode, onTimezoneModeChange }: HeaderProps): JSX.Element {
  const themeKey = useThemeStore((state) => state.themeKey)
  const setTheme = useThemeStore((state) => state.setTheme)

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

          <Button variant="ghost" onClick={onReset} title="Reset uploaded data" aria-label="Reset uploaded data">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
