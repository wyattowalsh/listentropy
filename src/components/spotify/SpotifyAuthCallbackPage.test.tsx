import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { SpotifyAuthCallbackPage } from '@/components/spotify/SpotifyAuthCallbackPage'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

describe('SpotifyAuthCallbackPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigateMock.mockReset()
    useSpotifyAuthStore.setState({
      status: 'disconnected',
      session: null,
      error: null,
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('invokes callback handling once in StrictMode and redirects on successful auth', async () => {
    const handleAuthCallback = vi.fn(async () => {
      useSpotifyAuthStore.setState({
        status: 'connected',
        error: null,
        session: {
          accessToken: 'token',
          expiresAt: Date.now() + 60_000,
          tokenSource: 'pkce',
          scopes: [],
          grantedAt: new Date().toISOString(),
        },
      })
      return true
    })

    useSpotifyAuthStore.setState({
      status: 'authorizing',
      error: null,
      handleAuthCallback,
    })

    render(
      <StrictMode>
        <SpotifyAuthCallbackPage />
      </StrictMode>,
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(handleAuthCallback).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450)
    })

    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
  })

  it('does not auto-redirect when callback ends in error and shows return action', async () => {
    const handleAuthCallback = vi.fn(async () => {
      useSpotifyAuthStore.setState({
        status: 'error',
        error: 'Spotify OAuth state mismatch.',
      })
      return true
    })

    useSpotifyAuthStore.setState({
      status: 'authorizing',
      error: null,
      handleAuthCallback,
    })

    render(<SpotifyAuthCallbackPage />)

    await act(async () => {
      await Promise.resolve()
    })
    expect(handleAuthCallback).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Return to app' })).toBeInTheDocument()
    expect(screen.getByText(/state mismatch/i)).toBeInTheDocument()
  })
})
