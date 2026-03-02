import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TasteDNA } from '@/components/views/TasteDNA'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

vi.mock('recharts', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    PolarAngleAxis: Wrapper,
    PolarGrid: Wrapper,
    PolarRadiusAxis: Wrapper,
    Radar: Wrapper,
    RadarChart: Wrapper,
    Tooltip: Wrapper,
  }
})

vi.mock('@/components/charts/ChartContainer', () => ({
  ChartContainer: ({ children }: { children?: ReactNode }) => <div data-testid="chart-container">{children}</div>,
}))

vi.mock('@/components/charts/TasteFingerprint', () => ({
  TasteFingerprint: () => <div data-testid="taste-fingerprint" />,
}))

vi.mock('@/lib/spotify-api', () => ({
  fetchSpotifyAudioFeatureProfile: vi.fn(),
}))

vi.mock('@/lib/spotify-auth/oauth', () => ({
  getSpotifyPkceConfig: () => ({
    clientId: 'spotify-test-client',
    redirectUri: 'http://localhost:5173/auth/spotify/callback',
  }),
}))

const data = processRecords(makeSyntheticRecords(64), { timezoneMode: 'local' })

describe('TasteDNA', () => {
  beforeEach(() => {
    useSpotifyAuthStore.setState({
      status: 'disconnected',
      session: null,
      error: null,
      connectSpotify: vi.fn().mockResolvedValue(undefined),
      ensureValidAccessToken: vi.fn().mockResolvedValue(null),
    })
  })

  it(
    'removes duplicate auth controls and exposes a canonical Spotify login CTA when disconnected',
    async () => {
    const onOpenSpotifySetup = vi.fn()
    const connectSpotify = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    useSpotifyAuthStore.setState({ connectSpotify })

    render(<TasteDNA data={data} onOpenSpotifySetup={onOpenSpotifySetup} />)

    expect(screen.queryByPlaceholderText(/spotify api token/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^disconnect$/i })).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: /login with spotify/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open advanced setup/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load spotify overlay/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /login with spotify/i }))
    expect(connectSpotify).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /open advanced setup/i }))
    expect(onOpenSpotifySetup).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /load spotify overlay/i }))
    expect(await screen.findByText(/connect spotify in advanced setup first/i)).toBeInTheDocument()
    },
    15_000,
  )

  it('shows Manage Spotify Setup when a shared Spotify session is connected', () => {
    useSpotifyAuthStore.setState({
      status: 'connected',
      session: {
        accessToken: 'token',
        expiresAt: Date.now() + 60_000,
        tokenSource: 'pkce',
        scopes: [],
        grantedAt: new Date().toISOString(),
      },
      error: null,
    })

    render(<TasteDNA data={data} onOpenSpotifySetup={vi.fn()} />)

    expect(screen.getByRole('button', { name: /manage spotify setup/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open advanced setup/i })).not.toBeInTheDocument()
    expect(screen.getByText(/auth status:\s*connected/i)).toBeInTheDocument()
    expect(screen.getByText(/source pkce/i)).toBeInTheDocument()
  })
})
