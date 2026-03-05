import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TimezoneMode } from '@/lib/types'
import { Header } from './Header'

const connectSpotify = vi.fn()
const setTheme = vi.fn()

vi.mock('@/store/useThemeStore', () => ({
  useThemeStore: (selector: (state: { themeKey: 'spotify-dark'; setTheme: typeof setTheme }) => unknown) =>
    selector({ themeKey: 'spotify-dark', setTheme }),
}))

vi.mock('@/store/useSpotifyAuthStore', () => ({
  useSpotifyAuthStore: (
    selector: (state: { status: 'disconnected'; session: null; connectSpotify: typeof connectSpotify }) => unknown,
  ) =>
    selector({ status: 'disconnected', session: null, connectSpotify }),
}))

vi.mock('@/lib/spotify-auth/oauth', () => ({
  getSpotifyPkceConfig: () => ({ clientId: 'spotify-client-id', redirectUri: 'https://example.com/callback' }),
}))

describe('Header', () => {
  beforeEach(() => {
    connectSpotify.mockReset()
    setTheme.mockReset()
  })

  function renderHeader(overrides?: Partial<{ onReset: () => void; timezoneMode: TimezoneMode }>): void {
    render(
      <Header
        onReset={overrides?.onReset ?? vi.fn()}
        timezoneMode={overrides?.timezoneMode ?? 'local'}
        onTimezoneModeChange={vi.fn()}
      />,
    )
  }

  it('requires an explicit confirmation click before resetting uploaded data', () => {
    const onReset = vi.fn()
    renderHeader({ onReset })

    const resetButton = screen.getByRole('button', { name: /reset uploaded data/i })
    fireEvent.click(resetButton)

    expect(onReset).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /confirm data reset/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /confirm data reset/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('shows an accessible tooltip for keyboard-focused shell controls', () => {
    renderHeader()

    const resetButton = screen.getByRole('button', { name: /reset uploaded data/i })
    fireEvent.focus(resetButton)

    expect(screen.getByRole('tooltip')).toHaveTextContent(/reset uploaded data and return to upload/i)

    fireEvent.blur(resetButton)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
