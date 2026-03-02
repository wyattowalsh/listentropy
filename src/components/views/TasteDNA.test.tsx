import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TasteDNA } from '@/components/views/TasteDNA'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'
import { fetchSpotifyAudioFeatureProfile } from '@/lib/spotify-api'
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
    vi.mocked(fetchSpotifyAudioFeatureProfile).mockReset()
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

    expect(screen.getByText(/connection state/i)).toBeInTheDocument()
    expect(screen.getByText(/^Disconnected$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login with spotify/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open advanced setup/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /load spotify overlay/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /login with spotify/i }))
    expect(connectSpotify).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /open advanced setup/i }))
    expect(onOpenSpotifySetup).toHaveBeenCalledTimes(1)
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

    expect(screen.getByText(/^Connected$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load spotify overlay/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /manage spotify setup/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open advanced setup/i })).not.toBeInTheDocument()
    expect(screen.getByText(/source pkce/i)).toBeInTheDocument()
  })

  it('surfaces auth callback errors with a danger state while keeping recovery actions available', () => {
    useSpotifyAuthStore.setState({
      status: 'error',
      session: null,
      error: 'Spotify OAuth state mismatch.',
    })

    render(<TasteDNA data={data} onOpenSpotifySetup={vi.fn()} />)

    expect(screen.getByText(/^Auth error$/i)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/state mismatch/i)
    expect(screen.getByRole('button', { name: /login with spotify/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open advanced setup/i })).toBeInTheDocument()
  })

  it('uses progressive disclosure toggles for enriched dimensions and spotify notes', async () => {
    const user = userEvent.setup()
    const ensureValidAccessToken = vi.fn().mockResolvedValue('token')
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
      ensureValidAccessToken,
    })
    vi.mocked(fetchSpotifyAudioFeatureProfile).mockResolvedValue({
      fetchedTrackCount: 48,
      dimensions: [
        { key: 'spectral-width', label: 'Spectral Width', score: 0.61 },
        { key: 'groove-density', label: 'Groove Density', score: 0.54 },
      ],
      warnings: ['Warning 1', 'Warning 2', 'Warning 3', 'Warning 4'],
    })

    render(<TasteDNA data={data} onOpenSpotifySetup={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /load spotify overlay/i }))
    expect(ensureValidAccessToken).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: /refresh spotify overlay/i })).toBeInTheDocument()

    const dimensionToggle = screen.getByRole('button', { name: 'Show all dimensions' })
    expect(dimensionToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Spectral Width')).not.toBeInTheDocument()

    await user.click(dimensionToggle)
    expect(screen.getByRole('button', { name: 'Show fewer dimensions' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Spectral Width')).toBeInTheDocument()

    const notesToggle = screen.getByRole('button', { name: 'Show all notes' })
    expect(notesToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Warning 4')).not.toBeInTheDocument()

    await user.click(notesToggle)
    expect(screen.getByRole('button', { name: 'Show fewer notes' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Warning 4')).toBeInTheDocument()
  })
})
