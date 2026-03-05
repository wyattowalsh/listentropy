import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SpotifyConnectCard } from '@/components/labs/SpotifyConnectCard'
import { buildDefaultLabDatasetSnapshot } from '@/lib/labs/registry'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'
import { useAudioTraitStore } from '@/store/useAudioTraitStore'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

vi.mock('@/lib/spotify-auth/oauth', () => ({
  getSpotifyPkceConfig: () => ({
    clientId: 'spotify-test-client',
    redirectUri: 'http://localhost:5173/auth/spotify/callback',
  }),
}))

const dataset = buildDefaultLabDatasetSnapshot(processRecords(makeSyntheticRecords(24), { timezoneMode: 'local' }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SpotifyConnectCard', () => {
  beforeEach(() => {
    useSpotifyAuthStore.setState({
      status: 'disconnected',
      session: null,
      error: null,
    })
    useAudioTraitStore.setState({
      snapshotByDatasetFingerprint: {},
      statusByDatasetFingerprint: {},
      errorByDatasetFingerprint: {},
      capabilityStatus: 'unknown',
      lastFetchMeta: null,
    })
  })

  it('describes backend-first enrichment and optional advanced token controls', () => {
    render(<SpotifyConnectCard dataset={dataset} />)

    expect(screen.getByText(/backend-powered enrichment fetches spotify audio traits without login/i)).toBeInTheDocument()
    expect(screen.getByText(/optional oauth\/manual tokens are used only as advanced fallback for restricted capability states/i)).toBeInTheDocument()
    expect(screen.getByText(/no optional token in this tab session/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect spotify \(optional oauth\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prepare audio trait snapshot/i })).toBeInTheDocument()
  })

  it('prepares enrichment while disconnected and keeps oauth/manual controls optional', async () => {
    const user = userEvent.setup()
    const trackId = dataset.records.find((row) => row.spotify_track_uri)?.spotify_track_uri?.split(':')[2] ?? 'track-1'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        data: {
          features: [{
            id: trackId,
            danceability: 0.6,
            energy: 0.7,
            valence: 0.4,
            acousticness: 0.2,
            instrumentalness: 0.1,
            speechiness: 0.05,
            tempo: 120,
            liveness: 0.3,
          }],
          requestStats: {
            requestedUniqueTrackIds: 1,
            cappedUniqueTrackIds: 1,
            truncatedTrackIds: 0,
            requestChunkCount: 1,
          },
        },
      }),
    }))

    render(<SpotifyConnectCard dataset={dataset} />)

    await user.click(screen.getByRole('button', { name: /prepare audio trait snapshot/i }))

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /snapshot status/i })).toHaveTextContent(/ready/i)
    })
    expect(screen.getByText(/^disconnected$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect spotify \(optional oauth\)/i })).toBeInTheDocument()
    expect(screen.getByText(/manual access token \(advanced fallback\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^disconnect$/i })).toBeDisabled()
  })

  it('communicates restricted backend capability states and exposes snapshot status semantics', () => {
    const fingerprint = dataset.datasetIdentity.fingerprint
    useAudioTraitStore.setState((state) => ({
      ...state,
      statusByDatasetFingerprint: {
        ...state.statusByDatasetFingerprint,
        [fingerprint]: 'unsupported',
      },
      errorByDatasetFingerprint: {
        ...state.errorByDatasetFingerprint,
        [fingerprint]: 'Spotify audio-features endpoint is restricted for this app/token (403).',
      },
      capabilityStatus: 'restricted',
    }))

    render(<SpotifyConnectCard dataset={dataset} />)

    expect(screen.getByText(/backend enrichment is currently restricted/i)).toBeInTheDocument()
    expect(screen.getByText(/optional oauth\/manual token fallback will be attempted for restricted capability states/i)).toBeInTheDocument()
    expect(screen.getByRole('status', { name: /snapshot status/i })).toHaveTextContent(/unsupported/i)
  })
})
